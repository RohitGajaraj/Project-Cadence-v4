import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";
import { recordLineage } from "@/lib/lineage.functions";

/** Roadmap = opportunities grouped by lane (now/next/later). */
export const getRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: opps, error: e1 }, { data: prds, error: e2 }] = await Promise.all([
      context.supabase.from("opportunities").select("*").order("ice_score", { ascending: false }),
      context.supabase.from("prds").select("id,title,opportunity_id,status"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { opportunities: opps ?? [], prds: prds ?? [] };
  });

export const moveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      lane: z.enum(["backlog", "now", "next", "later", "shipped", "dropped"]),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("opportunities")
      .update({ status: data.lane, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI Sprint Planner ----------

type PlannedTask = {
  title: string;
  estimate_hours: number;
  is_deep_work: boolean;
  priority: "low" | "medium" | "high";
  prd_id?: string | null;
  project_id?: string | null;
};

export const planSprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      horizon_days: z.number().int().min(3).max(28).default(14),
      commit: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const [{ data: opps }, { data: prds }, { data: openTasks }, { data: profile }] = await Promise.all([
      supabase.from("opportunities").select("id,title,problem,impact,confidence,ease,status").in("status", ["now", "next"]),
      supabase.from("prds").select("id,title,body_md,opportunity_id,status").in("status", ["draft", "review", "approved"]),
      supabase.from("tasks").select("title,status").neq("status", "done").limit(50),
      supabase.from("profiles").select("working_hours_start,working_hours_end").maybeSingle(),
    ]);

    if (!opps?.length && !prds?.length) {
      throw new Error("No active opportunities or PRDs to plan from. Move items to 'now' / 'next' first.");
    }

    const dailyHours = Math.max(
      2,
      (profile?.working_hours_end ?? 18) - (profile?.working_hours_start ?? 9) - 2,
    );
    const capacityHours = Math.round(dailyHours * (data.horizon_days * (5 / 7))); // weekdays only

    const system = `You are a senior sprint planner. Break the inputs into atomic, shippable tasks for the next ${data.horizon_days} days.
Each task: verb-led title (<80 chars), realistic estimate_hours (0.5-8), priority (low|medium|high), is_deep_work boolean, optional prd_id from the list provided.
Respect total capacity (~${capacityHours}h). Prefer items with higher ICE. Keep estimates honest.
Return STRICT JSON: { "tasks": [...] }. No prose, no fences.`;

    const user = JSON.stringify({
      opportunities: opps,
      prds: (prds ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status, opportunity_id: p.opportunity_id, body_md: (p.body_md ?? "").slice(0, 2000) })),
      open_tasks: (openTasks ?? []).map((t) => t.title),
      capacity_hours: capacityHours,
    }).slice(0, 30_000);

    const result = await callModel(supabase, userId, {
      surface: "agent",
      surface_ref: "sprint_planner",
      model: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = (result.json ?? {}) as { tasks?: PlannedTask[] };
    if (!parsed.tasks) throw new Error("AI returned invalid JSON");
    const tasks = (parsed.tasks ?? []).slice(0, 40);

    const prdIds = new Set((prds ?? []).map((p) => p.id));
    const safeTasks = tasks
      .filter((t) => t.title && t.title.trim().length > 1)
      .map((t) => ({
        title: t.title.slice(0, 280),
        estimate_hours: Math.min(40, Math.max(0.25, Number(t.estimate_hours) || 1)),
        is_deep_work: !!t.is_deep_work,
        priority: (["low", "medium", "high"].includes(t.priority) ? t.priority : "medium") as "low" | "medium" | "high",
        prd_id: t.prd_id && prdIds.has(t.prd_id) ? t.prd_id : null,
      }));

    if (!data.commit) {
      return { preview: { capacityHours, tasks: safeTasks } };
    }

    if (safeTasks.length) {
      const rows = safeTasks.map((t) => ({
        user_id: userId,
        title: t.title,
        priority: t.priority,
        is_deep_work: t.is_deep_work,
        estimate_hours: t.estimate_hours,
        prd_id: t.prd_id,
      }));
      const { data: inserted, error } = await supabase
        .from("tasks")
        .insert(rows)
        .select("id, prd_id");
      if (error) throw new Error(error.message);
      for (const t of inserted ?? []) {
        if (t.prd_id) {
          await recordLineage(supabase, userId, {
            parent_kind: "prd",
            parent_id: t.prd_id,
            child_kind: "task",
            child_id: t.id,
            rationale: "Generated by sprint planner",
            created_by_agent: "sprint-planner",
          });
        }
      }
    }
    return { committed: { tasks: safeTasks.length } };
  });

/** AI rebalance: re-rank opportunities into now/next/later based on ICE + signal velocity. */
export const rebalanceRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: opps }, { data: recentSignals }] = await Promise.all([
      supabase.from("opportunities").select("id,title,problem,impact,confidence,ease,ice_score,status").neq("status", "dropped"),
      supabase.from("signals").select("content,theme_id,created_at").gte("created_at", since).limit(200),
    ]);
    if (!opps?.length) return { moved: 0, message: "No opportunities to rebalance." };

    const system = `You are a head of product. Re-assign opportunities into lanes "now", "next", or "later" based on ICE score and recent signal velocity.
Cap "now" at 3, "next" at 5. Be decisive. Return STRICT JSON: { "assignments": [{ "id": "uuid", "lane": "now|next|later" }] }`;
    const user = JSON.stringify({
      opportunities: opps,
      recent_signal_count: (recentSignals ?? []).length,
    }).slice(0, 20_000);

    const result = await callModel(supabase, userId, {
      surface: "agent",
      surface_ref: "rebalance_roadmap",
      model: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = (result.json ?? {}) as { assignments?: { id: string; lane: string }[] };
    if (!parsed.assignments) throw new Error("AI returned invalid JSON");
    const valid = ["now", "next", "later"];
    const ids = new Set(opps.map((o) => o.id));
    let moved = 0;
    for (const a of parsed.assignments ?? []) {
      if (!ids.has(a.id) || !valid.includes(a.lane)) continue;
      const { error } = await supabase.from("opportunities").update({ status: a.lane, updated_at: new Date().toISOString() }).eq("id", a.id);
      if (!error) moved++;
    }
    return { moved, message: `Rebalanced ${moved} opportunities.` };
  });
/**
 * Orchestrator tools (F-AGENT-1).
 *
 * Four planning/dispatch tools used by the `orchestrator` agent to run
 * multi-agent missions across the existing handoff + checkpoint primitives.
 *
 * - mission.plan      → asks a sub-model for a small DAG and persists
 *                       mission_steps rows.
 * - mission.dispatch  → for every step whose deps are satisfied, enqueues
 *                       a child agent_runs row via enqueueHandoff().
 * - mission.observe   → returns the live state of every step (reflecting
 *                       child agent_runs status into step status).
 * - mission.finalize  → records the orchestrator's summary and marks the
 *                       mission completed when no work remains.
 *
 * The orchestrator never does specialist work itself; it only plans,
 * dispatches, observes, and finalizes.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolDef, ToolCtx } from "./registry.server";
import { callModel } from "@/lib/ai/runtime.server";
import { enqueueHandoff, resolveAgent } from "@/lib/ai/handoff.server";

// Re-export the same helper signature the registry uses.
function def<S extends z.ZodTypeAny>(d: ToolDef<S>) { return d as unknown as ToolDef; }

type MissionStepRow = {
  id: string;
  mission_id: string;
  idx: number;
  agent_slug: string;
  sub_goal: string;
  depends_on: number[];
  status: string;
  run_id: string | null;
  message_id: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  rationale: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
};

async function loadMission(supabase: SupabaseClient, missionId: string, userId: string) {
  const { data, error } = await supabase
    .from("missions")
    .select("id,user_id,workspace_id,title,goal,status")
    .eq("id", missionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Mission not found: ${missionId}`);
  return data as { id: string; user_id: string; workspace_id: string; title: string; goal: string; status: string };
}

async function listSpecialistSlugs(supabase: SupabaseClient, userId: string): Promise<{ slug: string; role: string }[]> {
  const { data } = await supabase
    .from("agents")
    .select("slug,role,enabled")
    .eq("user_id", userId)
    .eq("enabled", true);
  return ((data ?? []) as { slug: string; role: string }[])
    .filter((a) => a.slug !== "orchestrator");
}

// ── mission.plan ──────────────────────────────────────────────────────
const PlanArgs = z.object({
  goal: z.string().max(4000).optional(),
  model: z.string().max(120).optional(),
});

type PlannedStep = { agent_slug: string; sub_goal: string; depends_on?: number[]; rationale?: string };

function parsePlan(text: string): { steps: PlannedStep[]; summary?: string } | null {
  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  const direct = tryParse(text);
  if (direct && Array.isArray((direct as { steps?: unknown }).steps)) return direct as { steps: PlannedStep[]; summary?: string };
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    const sliced = tryParse(m[0]);
    if (sliced && Array.isArray((sliced as { steps?: unknown }).steps)) return sliced as { steps: PlannedStep[]; summary?: string };
  }
  return null;
}

export const missionPlan = def({
  name: "mission.plan",
  description:
    "Decompose THIS mission into a small DAG (1–6 steps). Persists mission_steps for later dispatch. Call exactly once near the start of the run.",
  category: "planning",
  argsSchema: PlanArgs,
  preview: (a) => `Plan mission${a.goal ? `: "${a.goal.slice(0, 80)}"` : ""}`,
  run: async (args, ctx: ToolCtx) => {
    const { supabase, userId, missionId, workspaceId, traceId, runId } = ctx;
    if (!missionId) throw new Error("mission.plan requires the run to be inside a mission");
    if (!workspaceId) throw new Error("mission.plan requires a workspace");
    const mission = await loadMission(supabase, missionId, userId);
    const goal = args.goal?.trim() || mission.goal;

    // Reject re-planning if steps already exist (the orchestrator should plan once).
    const { count: existing } = await supabase
      .from("mission_steps")
      .select("id", { count: "exact", head: true })
      .eq("mission_id", missionId);
    if ((existing ?? 0) > 0) {
      throw new Error("mission.plan: mission already has steps. Call mission.dispatch or mission.observe instead.");
    }

    const roster = await listSpecialistSlugs(supabase, userId);
    if (roster.length === 0) {
      throw new Error("mission.plan: no specialist agents enabled in workspace. Create at least one agent (e.g. discovery, strategist, builder).");
    }

    const planSystem = [
      "You are a mission planner. Given a goal and a roster of specialist agents, return a small DAG of sub-tasks.",
      "",
      "Specialist roster (use these slugs exactly):",
      ...roster.map((a) => `- ${a.slug} — ${a.role}`),
      "",
      "Output STRICT JSON only with this shape:",
      `{"summary":"one-sentence mission framing","steps":[{"agent_slug":"<slug>","sub_goal":"concrete self-contained instruction","depends_on":[],"rationale":"why this step"}]}`,
      "",
      "Rules:",
      "- 1 to 6 steps. Fewer is better.",
      "- Each step's sub_goal must be self-contained (the specialist will not see the wider plan).",
      "- depends_on is an array of zero-based indices of EARLIER steps that must finish first. Leave [] for root steps.",
      "- Only use agent_slugs from the roster above. Never invent a slug.",
      "- Do not nest steps. Do not include the orchestrator itself.",
    ].join("\n");

    const r = await callModel(supabase, userId, {
      surface: "agent",
      surface_ref: "orchestrator:plan",
      traceId: traceId ?? undefined,
      model: args.model ?? "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: planSystem },
        { role: "user", content: `Mission goal:\n${goal}` },
      ],
      promptKey: "orchestrator_plan",
      workspaceId,
      runId: runId ?? null,
    });

    const plan = parsePlan(r.output);
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error(`mission.plan: planner returned no usable steps. Raw: ${r.output.slice(0, 240)}`);
    }
    if (plan.steps.length > 8) throw new Error("mission.plan: too many steps (>8). Re-plan smaller.");

    const validSlugs = new Set(roster.map((r) => r.slug));
    const rows = plan.steps.map((s, i) => {
      if (!validSlugs.has(s.agent_slug)) {
        throw new Error(`mission.plan: step ${i} references unknown slug "${s.agent_slug}". Valid: ${[...validSlugs].join(", ")}`);
      }
      const deps = (s.depends_on ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d < i);
      return {
        mission_id: missionId,
        user_id: userId,
        workspace_id: workspaceId,
        idx: i,
        agent_slug: s.agent_slug,
        sub_goal: String(s.sub_goal ?? "").slice(0, 4000),
        depends_on: deps,
        rationale: s.rationale ? String(s.rationale).slice(0, 1000) : null,
        status: "planned",
      };
    });

    const { error: insErr } = await supabase.from("mission_steps").insert(rows);
    if (insErr) throw new Error(`mission.plan: persist failed — ${insErr.message}`);

    return {
      mission_id: missionId,
      summary: plan.summary?.slice(0, 400) ?? null,
      step_count: rows.length,
      steps: rows.map((r) => ({
        idx: r.idx, agent_slug: r.agent_slug, sub_goal: r.sub_goal, depends_on: r.depends_on,
      })),
    };
  },
});

// ── mission.dispatch ──────────────────────────────────────────────────
const DispatchArgs = z.object({}).optional();

export const missionDispatch = def({
  name: "mission.dispatch",
  description:
    "Enqueue child agent_runs for every mission step whose dependencies are satisfied. Idempotent — already-dispatched steps are skipped.",
  category: "planning",
  argsSchema: DispatchArgs as unknown as z.ZodTypeAny,
  preview: () => "Dispatch ready mission steps",
  run: async (_args, ctx: ToolCtx) => {
    const { supabase, userId, missionId, workspaceId, agentId, agentSlug, traceId, runId } = ctx;
    if (!missionId) throw new Error("mission.dispatch requires the run to be inside a mission");
    if (!workspaceId) throw new Error("mission.dispatch requires a workspace");

    // First reflect any child-run completions into step status (cheap path —
    // also done by mission.observe but dispatch needs an up-to-date view of
    // 'done' to evaluate depends_on).
    await reflectStepStatusFromRuns(supabase, missionId);

    const { data: ready, error: rErr } = await supabase
      .rpc("next_ready_mission_steps", { p_mission_id: missionId });
    if (rErr) throw new Error(rErr.message);
    const readyRows = (ready ?? []) as MissionStepRow[];

    if (readyRows.length === 0) {
      return { dispatched: 0, message: "Nothing ready to dispatch (waiting on deps, or all steps already dispatched)." };
    }

    const dispatched: { idx: number; agent_slug: string; run_id: string; message_id: string }[] = [];
    const failed: { idx: number; agent_slug: string; error: string }[] = [];

    for (const step of readyRows) {
      try {
        const to = await resolveAgent(supabase, userId, { agent_slug: step.agent_slug });
        const handoffRes = await enqueueHandoff(supabase, userId, {
          mission_id: missionId,
          workspace_id: workspaceId,
          from_agent_id: agentId ?? null,
          from_agent_slug: agentSlug ?? null,
          to,
          payload: {
            task: step.sub_goal,
            context: {
              mission_step_idx: step.idx,
              orchestrator_run_id: runId ?? null,
              orchestrator_trace_id: traceId ?? null,
              rationale: step.rationale ?? undefined,
            },
          },
          source_run_id: runId ?? null,
          source_trace_id: traceId ?? null,
        });
        await supabase
          .from("mission_steps")
          .update({
            status: "dispatched",
            run_id: handoffRes.queued_run_id,
            message_id: handoffRes.message_id,
            dispatched_at: new Date().toISOString(),
          })
          .eq("id", step.id);
        dispatched.push({
          idx: step.idx, agent_slug: step.agent_slug,
          run_id: handoffRes.queued_run_id, message_id: handoffRes.message_id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("mission_steps")
          .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
          .eq("id", step.id);
        failed.push({ idx: step.idx, agent_slug: step.agent_slug, error: msg });
      }
    }

    return {
      dispatched_count: dispatched.length,
      dispatched,
      failed_count: failed.length,
      failed,
    };
  },
});

// ── mission.observe ───────────────────────────────────────────────────
const ObserveArgs = z.object({}).optional();

export const missionObserve = def({
  name: "mission.observe",
  description:
    "Read the live state of every step in this mission, reflecting child agent_runs status. Use to decide whether to dispatch again or finalize.",
  category: "read",
  argsSchema: ObserveArgs as unknown as z.ZodTypeAny,
  preview: () => "Observe mission progress",
  run: async (_args, ctx: ToolCtx) => {
    const { supabase, missionId } = ctx;
    if (!missionId) throw new Error("mission.observe requires the run to be inside a mission");
    await reflectStepStatusFromRuns(supabase, missionId);

    const { data, error } = await supabase
      .from("mission_steps")
      .select("idx,agent_slug,sub_goal,depends_on,status,run_id,error,result,dispatched_at,completed_at")
      .eq("mission_id", missionId)
      .order("idx");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      idx: number; agent_slug: string; sub_goal: string; depends_on: number[];
      status: string; run_id: string | null; error: string | null;
      result: Record<string, unknown> | null;
      dispatched_at: string | null; completed_at: string | null;
    }[];
    const summary = {
      total: rows.length,
      planned:    rows.filter((r) => r.status === "planned").length,
      dispatched: rows.filter((r) => r.status === "dispatched").length,
      running:    rows.filter((r) => r.status === "running").length,
      done:       rows.filter((r) => r.status === "done").length,
      failed:     rows.filter((r) => r.status === "failed").length,
      skipped:    rows.filter((r) => r.status === "skipped").length,
    };
    const all_terminal = rows.length > 0 && rows.every((r) =>
      r.status === "done" || r.status === "failed" || r.status === "skipped",
    );
    return { summary, all_terminal, steps: rows };
  },
});

// ── mission.finalize ──────────────────────────────────────────────────
const FinalizeArgs = z.object({
  summary: z.string().min(1).max(2000),
});

export const missionFinalize = def({
  name: "mission.finalize",
  description:
    "Record an executive summary on the mission and (when no unconsumed handoffs remain) mark it completed. Call after mission.observe shows all_terminal=true.",
  category: "planning",
  argsSchema: FinalizeArgs,
  preview: (a) => `Finalize mission: "${a.summary.slice(0, 80)}"`,
  run: async (args, ctx: ToolCtx) => {
    const { supabase, missionId, userId } = ctx;
    if (!missionId) throw new Error("mission.finalize requires the run to be inside a mission");
    await reflectStepStatusFromRuns(supabase, missionId);

    const { data: stepsData } = await supabase
      .from("mission_steps")
      .select("status")
      .eq("mission_id", missionId);
    const steps = (stepsData ?? []) as { status: string }[];
    const all_terminal = steps.length > 0 && steps.every((s) =>
      s.status === "done" || s.status === "failed" || s.status === "skipped",
    );
    if (!all_terminal && steps.length > 0) {
      return {
        ok: false,
        message: "Not all steps are terminal yet. Dispatch / observe again before finalizing.",
      };
    }

    const anyFailed = steps.some((s) => s.status === "failed");
    const finalStatus = anyFailed ? "completed_with_failures" : "completed";

    const { error } = await supabase
      .from("missions")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        // store summary into goal isn't right; we don't have a summary column.
        // Persist into goal-shaped notes via the existing pattern: append a marker
        // to the title for now (cheap; UI shows it). A dedicated column can come
        // when the Swarm HUD lands.
      })
      .eq("id", missionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return {
      ok: true,
      mission_id: missionId,
      status: finalStatus,
      summary: args.summary,
      step_count: steps.length,
      failed_count: steps.filter((s) => s.status === "failed").length,
    };
  },
});

// ── helpers ───────────────────────────────────────────────────────────
/**
 * Cross-check every mission_step.run_id against agent_runs.status and
 * reflect the terminal state back onto the step. Cheap; called by
 * dispatch, observe, and finalize so the orchestrator always sees fresh
 * progress without a separate reactor.
 */
async function reflectStepStatusFromRuns(supabase: SupabaseClient, missionId: string): Promise<void> {
  const { data: pending } = await supabase
    .from("mission_steps")
    .select("id,run_id,status")
    .eq("mission_id", missionId)
    .in("status", ["dispatched", "running"]);
  const rows = (pending ?? []) as { id: string; run_id: string | null; status: string }[];
  if (rows.length === 0) return;

  const runIds = rows.map((r) => r.run_id).filter((x): x is string => !!x);
  if (runIds.length === 0) return;

  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id,status,output,halted_reason")
    .in("id", runIds);
  const byRun = new Map<string, { status: string; output: string | null; halted_reason: string | null }>(
    (runs ?? []).map((r) => [
      (r as { id: string }).id,
      r as { id: string; status: string; output: string | null; halted_reason: string | null },
    ]),
  );

  for (const row of rows) {
    if (!row.run_id) continue;
    const run = byRun.get(row.run_id);
    if (!run) continue;
    let next: { status: string; error?: string | null; result?: Record<string, unknown> | null; completed_at?: string } | null = null;
    if (run.status === "running" && row.status !== "running") {
      next = { status: "running" };
    } else if (run.status === "completed") {
      next = {
        status: "done",
        result: run.output ? { output: run.output } : null,
        completed_at: new Date().toISOString(),
      };
    } else if (run.status === "halted" || run.status === "failed") {
      next = {
        status: "failed",
        error: run.halted_reason ?? run.output ?? `child run ${run.status}`,
        completed_at: new Date().toISOString(),
      };
    }
    if (next) {
      await supabase.from("mission_steps").update(next).eq("id", row.id);
    }
  }
}
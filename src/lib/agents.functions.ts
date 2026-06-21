import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { agents: data ?? [] };
  });

export const listAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

/**
 * Live-state counts for the sidebar status line (DESIGN.md "Status
 * placement" contract). A dedicated tiny select rather than counting from
 * listAgentRuns — its 20-row window can drop a long-running run, and the
 * sidebar must never under-report live work. RLS scopes to the caller.
 */
export const getLiveRunCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_runs")
      .select("status")
      .in("status", ["running", "queued"]);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const running = rows.filter((r) => r.status === "running").length;
    // The cooking banner names what's running (DESIGN.md banner contract) —
    // ride the newest running mission's title along with the counts. Null
    // falls back to count-only copy; never an invented name.
    let runningMissionTitle: string | null = null;
    if (running > 0) {
      const { data: m } = await context.supabase
        .from("missions")
        .select("title")
        .eq("status", "running")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      runningMissionTitle = m?.title ?? null;
    }
    return {
      running,
      queued: rows.filter((r) => r.status === "queued").length,
      runningMissionTitle,
    };
  });

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentId: z.string().uuid(),
        input: z.string().min(1).max(4000),
        model: z.string().min(1).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: agent, error: aerr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", data.agentId)
      .single();
    if (aerr || !agent) throw new Error("Agent not found");
    // Operator-initiated "run now": refuse to run a disabled agent. Enable it
    // first if you want it to run.
    if (agent.enabled === false) {
      throw new Error("This agent is disabled. Enable it before running.");
    }

    // Lightweight grounding context
    const [{ data: tasks }, { data: projects }] = await Promise.all([
      supabase.from("tasks").select("title,status,priority,is_deep_work").limit(30),
      supabase.from("projects").select("name,north_star,status").limit(10),
    ]);
    const ctx = JSON.stringify({ projects, tasks }).slice(0, 4000);

    const t0 = Date.now();
    const { data: runRow } = await supabase
      .from("agent_runs")
      .insert({
        user_id: userId,
        agent_id: agent.id,
        agent_slug: agent.slug,
        agent_name: agent.name,
        input: data.input,
        status: "running",
      })
      .select()
      .single();

    try {
      const model = data.model ?? DEFAULT_MODEL;
      const r = await callModel(supabase as never, userId, {
        surface: "agent",
        surface_ref: agent.id,
        model,
        messages: [
          {
            role: "system",
            content: `${agent.system_prompt}\n\nUSER WORKSPACE CONTEXT (JSON):\n${ctx}`,
          },
          { role: "user", content: data.input },
        ],
      });
      const { output, via, provider } = r;
      const duration = Date.now() - t0;
      const tag = via === "byo" ? `\n\n_via your ${provider} key_` : "";
      const { data: updated } = await supabase
        .from("agent_runs")
        .update({ output: output + tag, status: "complete", duration_ms: duration })
        .eq("id", runRow!.id)
        .select()
        .single();
      return { run: updated };
    } catch (e) {
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          output: e instanceof Error ? e.message : "Failed",
          duration_ms: Date.now() - t0,
        })
        .eq("id", runRow!.id);
      throw e;
    }
  });

const ScheduleSchema = z.object({
  agentId: z.string().uuid(),
  cron_schedule: z.string().max(40).nullable(),
  cron_input: z.string().max(2000).nullable().optional(),
});

export const updateAgentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ScheduleSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("agents")
      .update({
        cron_schedule: data.cron_schedule,
        cron_input: data.cron_input ?? null,
      })
      .eq("id", data.agentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// FND-0.5 — set a per-agent blast-radius cap (max_tool_risk). null clears the cap (unrestricted).
// The agent loop drops any enabled tool whose tier exceeds this when dispatching the agent.
const ToolCapSchema = z.object({
  agentId: z.string().uuid(),
  maxToolRisk: z.enum(["low", "medium", "high"]).nullable(),
});

export const setAgentToolCap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ToolCapSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("agents")
      .update({ max_tool_risk: data.maxToolRisk })
      .eq("id", data.agentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * F-AGENT-2 — Recent reflections for an agent. Reads via the
 * `recent_agent_reflections` SECURITY DEFINER RPC so it can't leak across
 * users (the RPC scopes by `for_user`).
 */
export type ReflectionMetadata = {
  run_id?: string | null;
  trace_id?: string | null;
  what_worked?: string | null;
  what_to_change?: string | null;
  goal?: string | null;
};

export type AgentReflection = {
  id: string;
  content: string;
  importance: number;
  metadata: ReflectionMetadata | null;
  created_at: string;
};

export const listAgentReflections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentSlug: z.string().min(1).max(60),
        limit: z.number().int().min(1).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("recent_agent_reflections", {
      for_user: userId,
      for_agent_slug: data.agentSlug,
      match_count: data.limit ?? 5,
    });
    if (error) throw new Error(error.message);
    return { reflections: (rows ?? []) as AgentReflection[] };
  });

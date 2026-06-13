/**
 * Mission server functions (Bundle 4).
 *
 * A mission groups multiple agent_runs under one operator intent. These fns
 * feed the /missions/$id page: the mission row, its ordered hops (runs), and
 * the structured A2A messages between them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSideEffectingTool } from "@/lib/tool-consequences";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type MissionDetail = {
  mission: {
    id: string;
    title: string;
    goal: string;
    status: string;
    current_agent_id: string | null;
    hop_count: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  };
  /** Aggregated from ai_events over the mission's run traces (F-DESIGN-EMBER
   * screen 4: the detail hero's started/cost/tokens/trace stat row). */
  usage: {
    cost_usd: number;
    tokens_in: number;
    tokens_out: number;
    /** First hop's trace id — the mission's entry point into /traces. */
    trace_id: string | null;
  };
  hops: {
    run_id: string;
    agent_slug: string;
    agent_name: string;
    status: string;
    input: string;
    output: string | null;
    created_at: string;
    last_checkpoint_at: string | null;
    trace_id: string | null;
    step_index: number;
    steps: HopStep[];
    tool_calls: HopToolCall[];
    recalled_memories: string[];
  }[];
  messages: {
    id: string;
    from_agent_slug: string | null;
    to_agent_slug: string;
    kind: string;
    payload: JsonValue;
    source_run_id: string | null;
    source_trace_id: string | null;
    consumed_by_run_id: string | null;
    created_at: string;
  }[];
};

export type HopStep =
  | { kind: "thought"; text: string }
  | {
      kind: "tool_call";
      name: string;
      args: JsonValue;
      reason?: string;
      ok: boolean;
      result?: JsonValue;
      error?: string;
      approval_id?: string;
      status: "executed" | "queued" | "error" | "denied";
    }
  | { kind: "final"; message: string };

export type HopToolCall = {
  id: string;
  tool_name: string;
  ok: boolean;
  error: string | null;
  latency_ms: number;
  created_at: string;
  /**
   * v6 Phase 2 (W2): true when this was a side-effecting tool that ran inline
   * with no human gate (the agent's trust arc dialed it to auto). Every
   * tool_calls row IS an inline execution — gated tools queue an approval
   * instead of writing here — so a side-effecting one is unattended delegation.
   */
  is_unattended: boolean;
};

export type MissionListRow = {
  id: string;
  title: string;
  goal: string;
  status: string;
  hop_count: number;
  current_agent_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Ordered step statuses for the row's StepDot strip — mission_steps when
   * orchestrated, else the run statuses. Empty for queued missions. */
  steps: { status: string }[];
  /** Summed ai_events est_cost_usd over the mission's traces; null = unknown
   * (no checkpointed traces yet) — render "—", never a fake $0.00. */
  cost_usd: number | null;
};

export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ missions: MissionListRow[] }> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("missions")
      .select("id,title,goal,status,hop_count,current_agent_id,created_at,updated_at,completed_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const missions = data ?? [];
    if (missions.length === 0) return { missions: [] };
    const ids = missions.map((m) => m.id);

    // Batched enrichment (3 queries across ALL rows, never per-mission):
    // step dots from mission_steps; run fallback + trace ids from agent_runs +
    // latest checkpoints; cost from ai_events over those traces. Best-effort —
    // any failure degrades to empty dots / unknown cost.
    const stepsByMission = new Map<string, { status: string }[]>();
    const runsByMission = new Map<string, { status: string }[]>();
    const costByMission = new Map<string, number>();
    try {
      const [{ data: planSteps }, { data: runs }] = await Promise.all([
        supabase
          .from("mission_steps")
          .select("mission_id,idx,status")
          .in("mission_id", ids)
          .order("idx", { ascending: true }),
        supabase
          .from("agent_runs")
          .select("id,mission_id,status,created_at")
          .in("mission_id", ids)
          .order("created_at", { ascending: true }),
      ]);
      for (const s of planSteps ?? []) {
        const arr = stepsByMission.get(s.mission_id) ?? [];
        arr.push({ status: s.status });
        stepsByMission.set(s.mission_id, arr);
      }
      const missionByRun = new Map<string, string>();
      for (const r of runs ?? []) {
        if (!r.mission_id) continue;
        missionByRun.set(r.id, r.mission_id);
        const arr = runsByMission.get(r.mission_id) ?? [];
        arr.push({ status: r.status });
        runsByMission.set(r.mission_id, arr);
      }
      const runIds = [...missionByRun.keys()];
      if (runIds.length) {
        const { data: cps } = await supabase
          .from("agent_run_checkpoints")
          .select("run_id,step_index,state")
          .in("run_id", runIds)
          .order("step_index", { ascending: false });
        const missionByTrace = new Map<string, string>();
        const seenRun = new Set<string>();
        for (const cp of cps ?? []) {
          if (seenRun.has(cp.run_id)) continue;
          seenRun.add(cp.run_id);
          const traceId = (cp.state as { traceId?: string } | null)?.traceId;
          const missionId = missionByRun.get(cp.run_id);
          if (traceId && missionId) missionByTrace.set(traceId, missionId);
        }
        const traceIds = [...missionByTrace.keys()];
        if (traceIds.length) {
          const { data: events } = await supabase
            .from("ai_events")
            .select("trace_id,est_cost_usd")
            .in("trace_id", traceIds);
          for (const e of events ?? []) {
            const missionId = e.trace_id ? missionByTrace.get(e.trace_id) : undefined;
            if (!missionId) continue;
            costByMission.set(
              missionId,
              (costByMission.get(missionId) ?? 0) + Number(e.est_cost_usd ?? 0),
            );
          }
        }
      }
    } catch (e) {
      console.error("[missions] list enrichment failed (degrading):", e);
    }

    return {
      missions: missions.map((m) => ({
        ...m,
        steps: stepsByMission.get(m.id) ?? runsByMission.get(m.id) ?? [],
        cost_usd: costByMission.has(m.id) ? costByMission.get(m.id)! : null,
      })),
    };
  });

export const getMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { missionId: string }) => z.object({ missionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<MissionDetail> => {
    const { supabase } = context;
    const { data: mission, error } = await supabase
      .from("missions")
      .select("id,title,goal,status,current_agent_id,hop_count,created_at,updated_at,completed_at")
      .eq("id", data.missionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mission) throw new Error("Mission not found");

    // Pull trace_id from the first ai_events row per run (cheap, no join).
    const { data: runs } = await supabase
      .from("agent_runs")
      .select("id,agent_slug,agent_name,status,input,output,created_at,last_checkpoint_at")
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: true });

    const { data: messages } = await supabase
      .from("agent_messages")
      .select(
        "id,from_agent_slug,to_agent_slug,kind,payload,source_run_id,source_trace_id,consumed_by_run_id,created_at",
      )
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: true });

    const runIds = (runs ?? []).map((r) => r.id);
    // Latest checkpoint per run gives us in-flight progress: steps[] + traceId.
    const { data: cps } = runIds.length
      ? await supabase
          .from("agent_run_checkpoints")
          .select("run_id,step_index,state,created_at")
          .in("run_id", runIds)
          .order("step_index", { ascending: false })
      : {
          data: [] as {
            run_id: string;
            step_index: number;
            state: Record<string, unknown>;
            created_at: string;
          }[],
        };
    const latestByRun = new Map<string, { step_index: number; state: Record<string, unknown> }>();
    for (const row of (cps ?? []) as {
      run_id: string;
      step_index: number;
      state: Record<string, unknown>;
    }[]) {
      if (!latestByRun.has(row.run_id))
        latestByRun.set(row.run_id, { step_index: row.step_index, state: row.state });
    }
    const traceIds = [...latestByRun.values()]
      .map((cp) => (cp.state as { traceId?: string }).traceId)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    const { data: tcs } = traceIds.length
      ? await supabase
          .from("tool_calls")
          .select("id,trace_id,tool_name,ok,error,latency_ms,created_at")
          .in("trace_id", traceIds)
          .order("created_at", { ascending: true })
      : {
          data: [] as {
            id: string;
            trace_id: string;
            tool_name: string;
            ok: boolean;
            error: string | null;
            latency_ms: number;
            created_at: string;
          }[],
        };
    const tcByTrace = new Map<string, HopToolCall[]>();
    for (const t of (tcs ?? []) as {
      id: string;
      trace_id: string;
      tool_name: string;
      ok: boolean;
      error: string | null;
      latency_ms: number;
      created_at: string;
    }[]) {
      const arr = tcByTrace.get(t.trace_id) ?? [];
      arr.push({
        id: t.id,
        tool_name: t.tool_name,
        ok: t.ok,
        error: t.error,
        latency_ms: t.latency_ms,
        created_at: t.created_at,
        is_unattended: isSideEffectingTool(t.tool_name),
      });
      tcByTrace.set(t.trace_id, arr);
    }

    // Hero stat row (screen 4): cost + tokens summed from ai_events over the
    // mission's traces; trace_id = the FIRST hop's trace (runs are ordered
    // created_at asc; traceIds order follows the checkpoint query, not hops).
    const firstHopTrace =
      (runs ?? [])
        .map((r) => (latestByRun.get(r.id)?.state as { traceId?: string } | undefined)?.traceId)
        .find((t): t is string => typeof t === "string" && t.length > 0) ?? null;
    const usage: MissionDetail["usage"] = {
      cost_usd: 0,
      tokens_in: 0,
      tokens_out: 0,
      trace_id: firstHopTrace,
    };
    if (traceIds.length) {
      const { data: events } = await supabase
        .from("ai_events")
        .select("est_cost_usd,prompt_tokens,completion_tokens")
        .in("trace_id", traceIds);
      for (const e of events ?? []) {
        usage.cost_usd += Number(e.est_cost_usd ?? 0);
        usage.tokens_in += e.prompt_tokens ?? 0;
        usage.tokens_out += e.completion_tokens ?? 0;
      }
    }

    return {
      mission: mission as MissionDetail["mission"],
      usage,
      hops: (runs ?? []).map((r) => {
        const cp = latestByRun.get(r.id);
        const state = (cp?.state ?? {}) as {
          traceId?: string;
          steps?: HopStep[];
          recalledMemories?: string[];
        };
        const traceId = state.traceId ?? null;
        return {
          run_id: r.id,
          agent_slug: r.agent_slug,
          agent_name: r.agent_name,
          status: r.status,
          input: r.input,
          output: r.output,
          created_at: r.created_at,
          last_checkpoint_at: (r as { last_checkpoint_at?: string }).last_checkpoint_at ?? null,
          trace_id: traceId,
          step_index: cp?.step_index ?? 0,
          steps: Array.isArray(state.steps) ? state.steps : [],
          tool_calls: traceId ? (tcByTrace.get(traceId) ?? []) : [],
          recalled_memories: Array.isArray(state.recalledMemories) ? state.recalledMemories : [],
        };
      }),
      messages: (messages ?? []) as MissionDetail["messages"],
    };
  });

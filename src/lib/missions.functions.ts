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
  | { kind: "tool_call"; name: string; args: JsonValue; reason?: string; ok: boolean; result?: JsonValue; error?: string; approval_id?: string; status: "executed" | "queued" | "error" | "denied" }
  | { kind: "final"; message: string };

export type HopToolCall = {
  id: string;
  tool_name: string;
  ok: boolean;
  error: string | null;
  latency_ms: number;
  created_at: string;
};

export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("missions")
      .select("id,title,goal,status,hop_count,current_agent_id,created_at,updated_at,completed_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { missions: data ?? [] };
  });

export const getMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { missionId: string }) =>
    z.object({ missionId: z.string().uuid() }).parse(d),
  )
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
      .select("id,from_agent_slug,to_agent_slug,kind,payload,source_run_id,source_trace_id,consumed_by_run_id,created_at")
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
      : { data: [] as { run_id: string; step_index: number; state: Record<string, unknown>; created_at: string }[] };
    const latestByRun = new Map<string, { step_index: number; state: Record<string, unknown> }>();
    for (const row of (cps ?? []) as { run_id: string; step_index: number; state: Record<string, unknown> }[]) {
      if (!latestByRun.has(row.run_id)) latestByRun.set(row.run_id, { step_index: row.step_index, state: row.state });
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
      : { data: [] as { id: string; trace_id: string; tool_name: string; ok: boolean; error: string | null; latency_ms: number; created_at: string }[] };
    const tcByTrace = new Map<string, HopToolCall[]>();
    for (const t of (tcs ?? []) as { id: string; trace_id: string; tool_name: string; ok: boolean; error: string | null; latency_ms: number; created_at: string }[]) {
      const arr = tcByTrace.get(t.trace_id) ?? [];
      arr.push({ id: t.id, tool_name: t.tool_name, ok: t.ok, error: t.error, latency_ms: t.latency_ms, created_at: t.created_at });
      tcByTrace.set(t.trace_id, arr);
    }

    return {
      mission: mission as MissionDetail["mission"],
      hops: (runs ?? []).map((r) => {
        const cp = latestByRun.get(r.id);
        const state = (cp?.state ?? {}) as { traceId?: string; steps?: HopStep[] };
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
          tool_calls: traceId ? tcByTrace.get(traceId) ?? [] : [],
        };
      }),
      messages: (messages ?? []) as MissionDetail["messages"],
    };
  });
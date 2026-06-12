/**
 * Server functions for the Trace Viewer (/traces):
 * - listTraces: distinct trace_ids with aggregates (last 7d)
 * - getTrace: full waterfall (events + guardrail hits + evals) for a single trace_id
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type EventRow = {
  id: string;
  trace_id: string | null;
  parent_event_id: string | null;
  created_at: string;
  surface: string;
  surface_ref: string | null;
  model: string;
  provider: string;
  via: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  est_cost_usd: number;
  latency_ms: number;
  fallback: boolean;
  input_preview: string | null;
  output_preview: string | null;
  error_message: string | null;
};

export const listTraces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        days: z.number().int().min(1).max(30).default(7),
        surface: z.string().max(40).optional(),
        status: z.enum(["all", "ok", "error"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    let q = context.supabase
      .from("ai_events")
      .select(
        "id,trace_id,parent_event_id,created_at,surface,model,status,total_tokens,est_cost_usd,latency_ms",
      )
      .gte("created_at", since)
      .not("trace_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.surface) q = q.eq("surface", data.surface);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const byTrace = new Map<
      string,
      {
        trace_id: string;
        first_at: string;
        last_at: string;
        surfaces: Set<string>;
        models: Set<string>;
        spans: number;
        tokens: number;
        cost: number;
        latency_ms: number;
        errors: number;
        root_surface: string | null;
        root_at: string;
      }
    >();
    for (const r of (rows ?? []) as EventRow[]) {
      if (!r.trace_id) continue;
      const t = byTrace.get(r.trace_id) ?? {
        trace_id: r.trace_id,
        first_at: r.created_at,
        last_at: r.created_at,
        surfaces: new Set(),
        models: new Set(),
        spans: 0,
        tokens: 0,
        cost: 0,
        latency_ms: 0,
        errors: 0,
        root_surface: null,
        root_at: r.created_at,
      };
      t.spans += 1;
      t.tokens += r.total_tokens || 0;
      t.cost += Number(r.est_cost_usd || 0);
      t.latency_ms += r.latency_ms || 0;
      if (r.status !== "ok") t.errors += 1;
      t.surfaces.add(r.surface);
      t.models.add(r.model);
      if (r.created_at < t.first_at) {
        t.first_at = r.created_at;
        t.root_surface = r.surface;
        t.root_at = r.created_at;
      }
      if (r.created_at > t.last_at) t.last_at = r.created_at;
      byTrace.set(r.trace_id, t);
    }
    const traces = [...byTrace.values()]
      .map((t) => ({
        trace_id: t.trace_id,
        first_at: t.first_at,
        last_at: t.last_at,
        spans: t.spans,
        tokens: t.tokens,
        cost: t.cost,
        latency_ms: t.latency_ms,
        errors: t.errors,
        surfaces: [...t.surfaces],
        models: [...t.models],
        root_surface: t.root_surface ?? [...t.surfaces][0] ?? "unknown",
        wall_ms: new Date(t.last_at).getTime() - new Date(t.first_at).getTime(),
      }))
      .filter((t) =>
        data.status === "all" ? true : data.status === "error" ? t.errors > 0 : t.errors === 0,
      )
      .sort((a, b) => b.last_at.localeCompare(a.last_at))
      .slice(0, data.limit);

    return { traces };
  });

export const getTrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ traceId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: events, error } = await supabase
      .from("ai_events")
      .select("*")
      .eq("user_id", userId)
      .eq("trace_id", data.traceId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (events ?? []) as EventRow[];
    const ids = rows.map((r) => r.id);

    // Mission reverse-lookup (additive — screen 7 trace drill). The agent loop
    // stamps state.traceId on agent_run_checkpoints (canonical join precedent:
    // missions.functions.ts / studio.functions.ts); run → agent_runs.mission_id
    // → missions.title. Fallback: agent_messages.source_trace_id. Returns null
    // for chat/prd/seeded traces — the UI then keeps the surface/trace-id title.
    // Note: state->>traceId is an unindexed JSONB expression — fine at current
    // volume with .limit(1); revisit with an index if checkpoints grow.
    const resolveMission = async (): Promise<{ id: string; title: string } | null> => {
      let missionId: string | null = null;
      const { data: cps } = await supabase
        .from("agent_run_checkpoints")
        .select("run_id")
        .filter("state->>traceId", "eq", data.traceId)
        .limit(1);
      const runId = (cps?.[0] as { run_id?: string } | undefined)?.run_id;
      if (runId) {
        const { data: run } = await supabase
          .from("agent_runs")
          .select("mission_id")
          .eq("id", runId)
          .maybeSingle();
        missionId = (run as { mission_id?: string | null } | null)?.mission_id ?? null;
      }
      if (!missionId) {
        const { data: msgs } = await supabase
          .from("agent_messages")
          .select("mission_id")
          .eq("source_trace_id", data.traceId)
          .limit(1);
        missionId = (msgs?.[0] as { mission_id?: string | null } | undefined)?.mission_id ?? null;
      }
      if (!missionId) return null;
      const { data: mission } = await supabase
        .from("missions")
        .select("id,title")
        .eq("id", missionId)
        .maybeSingle();
      return (mission as { id: string; title: string } | null) ?? null;
    };

    const [hitsRes, evalRes, toolRes, mission] = await Promise.all([
      ids.length
        ? supabase
            .from("guardrail_hits")
            .select("id,event_id,rule_name,side,action,kind,matched,created_at")
            .in("event_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      ids.length
        ? supabase
            .from("ai_evals")
            .select(
              "event_id,relevance,groundedness,coherence,hallucination_score,toxicity,pii_risk,judge_rationale",
            )
            .in("event_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      // Tool-call hops (additive — screen 7 trace drill). CRITICAL: the agent
      // loop never populates tool_calls.event_id, so tools join to the trace
      // by trace_id and interleave with LLM spans by created_at only.
      supabase
        .from("tool_calls")
        .select(
          "id,event_id,trace_id,agent_id,tool_name,args,result,ok,error,latency_ms,created_at",
        )
        .eq("user_id", userId)
        .eq("trace_id", data.traceId)
        .order("created_at", { ascending: true }),
      resolveMission(),
    ]);

    return {
      traceId: data.traceId,
      events: rows,
      hits: (hitsRes.data ?? []) as {
        id: string;
        event_id: string;
        rule_name: string;
        side: string;
        action: string;
        kind: string;
        matched: string | null;
        created_at: string;
      }[],
      evals: (evalRes.data ?? []) as {
        event_id: string;
        relevance: number | null;
        groundedness: number | null;
        coherence: number | null;
        hallucination_score: number | null;
        toxicity: number | null;
        pii_risk: number | null;
        judge_rationale: string | null;
      }[],
      toolCalls: (toolRes.data ?? []) as {
        id: string;
        event_id: string | null;
        trace_id: string;
        agent_id: string | null;
        tool_name: string;
        // Json (not unknown) so server-fn return types stay serializable.
        args: Json;
        result: Json;
        ok: boolean;
        error: string | null;
        latency_ms: number;
        created_at: string;
      }[],
      mission,
    };
  });

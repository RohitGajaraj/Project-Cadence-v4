/**
 * Server functions for the Trace Viewer (/traces):
 * - listTraces: distinct trace_ids with aggregates (last 7d)
 * - getTrace: full waterfall (events + guardrail hits + evals) for a single trace_id
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const [hitsRes, evalRes] = await Promise.all([
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
    };
  });

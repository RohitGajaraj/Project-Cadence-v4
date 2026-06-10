import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DaysSchema = z.object({ days: z.number().int().min(1).max(90).default(7) });

type EventRow = {
  id: string;
  created_at: string;
  surface: string;
  model: string;
  via: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  est_cost_usd: number;
  latency_ms: number;
  input_preview: string | null;
  output_preview: string | null;
  error_message: string | null;
};

export const getAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DaysSchema.parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("ai_events")
      .select("id,created_at,surface,model,via,status,total_tokens,est_cost_usd,latency_ms")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const events = (rows ?? []) as Pick<
      EventRow,
      | "id"
      | "created_at"
      | "surface"
      | "model"
      | "via"
      | "status"
      | "total_tokens"
      | "est_cost_usd"
      | "latency_ms"
    >[];
    const totalRuns = events.length;
    const errors = events.filter((e) => e.status !== "ok").length;
    const totalTokens = events.reduce((s, e) => s + (e.total_tokens || 0), 0);
    const totalCost = events.reduce((s, e) => s + Number(e.est_cost_usd || 0), 0);
    const latencies = events
      .filter((e) => e.latency_ms > 0)
      .map((e) => e.latency_ms)
      .sort((a, b) => a - b);
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
      : 0;
    const p95Latency = latencies.length
      ? (latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1])
      : 0;

    const bySurface = new Map<
      string,
      { runs: number; tokens: number; cost: number; errors: number }
    >();
    const byModel = new Map<string, { runs: number; tokens: number; cost: number }>();
    for (const e of events) {
      const s = bySurface.get(e.surface) ?? { runs: 0, tokens: 0, cost: 0, errors: 0 };
      s.runs += 1;
      s.tokens += e.total_tokens || 0;
      s.cost += Number(e.est_cost_usd || 0);
      if (e.status !== "ok") s.errors += 1;
      bySurface.set(e.surface, s);
      const m = byModel.get(e.model) ?? { runs: 0, tokens: 0, cost: 0 };
      m.runs += 1;
      m.tokens += e.total_tokens || 0;
      m.cost += Number(e.est_cost_usd || 0);
      byModel.set(e.model, m);
    }

    // daily sparkline (cost + runs)
    const dayBuckets = new Map<string, { runs: number; cost: number }>();
    for (const e of events) {
      const k = e.created_at.slice(0, 10);
      const v = dayBuckets.get(k) ?? { runs: 0, cost: 0 };
      v.runs += 1;
      v.cost += Number(e.est_cost_usd || 0);
      dayBuckets.set(k, v);
    }
    const daily = Array.from(dayBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, ...v }));

    return {
      summary: { totalRuns, errors, totalTokens, totalCost, avgLatency, p95Latency },
      bySurface: Array.from(bySurface.entries())
        .map(([k, v]) => ({ surface: k, ...v }))
        .sort((a, b) => b.runs - a.runs),
      byModel: Array.from(byModel.entries())
        .map(([k, v]) => ({ model: k, ...v }))
        .sort((a, b) => b.runs - a.runs),
      daily,
    };
  });

export const listAiEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        surface: z.string().max(40).optional(),
        status: z.string().max(20).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("ai_events")
      .select(
        "id,created_at,surface,surface_ref,model,via,provider,status,prompt_tokens,completion_tokens,total_tokens,est_cost_usd,latency_ms,input_preview,output_preview,error_message",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.surface) q = q.eq("surface", data.surface);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

export const getEventDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const [evt, evals, hits, fb] = await Promise.all([
      context.supabase.from("ai_events").select("*").eq("id", data.eventId).maybeSingle(),
      context.supabase.from("ai_evals").select("*").eq("event_id", data.eventId).maybeSingle(),
      context.supabase
        .from("guardrail_hits")
        .select("rule_name,side,action,kind,matched")
        .eq("event_id", data.eventId),
      context.supabase.from("ai_feedback").select("rating,comment").eq("event_id", data.eventId),
    ]);
    return {
      event: evt.data,
      eval: evals.data,
      guardrailHits: hits.data ?? [],
      feedback: fb.data ?? [],
    };
  });

export const getGuardrailStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await context.supabase
      .from("guardrail_hits")
      .select("rule_name,action,side")
      .gte("created_at", since)
      .limit(2000);
    if (error) throw new Error(error.message);
    const byRule = new Map<string, { name: string; action: string; count: number }>();
    for (const h of data ?? []) {
      const k = `${h.rule_name}|${h.action}`;
      const cur = byRule.get(k) ?? {
        name: h.rule_name as string,
        action: h.action as string,
        count: 0,
      };
      cur.count += 1;
      byRule.set(k, cur);
    }
    return { hits: Array.from(byRule.values()).sort((a, b) => b.count - a.count) };
  });

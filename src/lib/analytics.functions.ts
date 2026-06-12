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
    // Screen-7 additive key (scout-sanctioned): median latency, same
    // percentile-index pattern as p95 above.
    const p50Latency = latencies.length
      ? (latencies[Math.floor(latencies.length * 0.5)] ?? latencies[latencies.length - 1])
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
      summary: { totalRuns, errors, totalTokens, totalCost, avgLatency, p50Latency, p95Latency },
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

// ---------------------------------------------------------------------------
// Screen-7 additive exports — per-agent spend rollup + the agent drill detail.
//
// surface_ref heterogeneity (the trap, mapped 2026-06-12): for surface='agent'
// the agent loop writes agents.slug, the legacy direct runAgent wrote
// agents.id (uuid), and orchestrator/reflection/roadmap write pseudo-refs
// ('orchestrator:plan', 'reflect:{slug}', 'sprint_planner',
// 'rebalance_roadmap'). Refs are resolved against agents.slug AND agents.id
// so one agent's two real refs merge into one row; pseudo-refs stay their own
// honest rows — never silently folded into a named agent.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AgentRow = { id: string; slug: string; name: string; role: string | null };

/** Per-agent spend rows for the "Spend by agent" bento. pct is of the
 *  agent-surface SUBTOTAL (not whole-spend totalCost) so the bars are an
 *  honest share of agent spend and the largest sums read against 100%. */
export const getAgentSpendBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DaysSchema.parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [evts, ags] = await Promise.all([
      context.supabase
        .from("ai_events")
        .select("surface_ref,total_tokens,est_cost_usd")
        .eq("surface", "agent")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      context.supabase.from("agents").select("id,slug,name,role"),
    ]);
    if (evts.error) throw new Error(evts.error.message);
    if (ags.error) throw new Error(ags.error.message);

    const byRef = new Map<string, AgentRow>();
    for (const a of (ags.data ?? []) as AgentRow[]) {
      byRef.set(a.slug, a);
      byRef.set(a.id, a);
    }

    const groups = new Map<
      string,
      {
        slug: string;
        name: string;
        role: string | null;
        cost: number;
        calls: number;
        tokens: number;
      }
    >();
    let subtotal = 0;
    for (const e of evts.data ?? []) {
      // A null ref is a real bucket of agent calls that carried no ref.
      const ref = (e.surface_ref as string | null) ?? "unattributed";
      const agent = byRef.get(ref);
      const key = agent ? agent.slug : ref;
      const g = groups.get(key) ?? {
        slug: key,
        name: agent ? agent.name : ref,
        role: agent ? agent.role : null,
        cost: 0,
        calls: 0,
        tokens: 0,
      };
      const cost = Number(e.est_cost_usd || 0);
      g.cost += cost;
      g.calls += 1;
      g.tokens += (e.total_tokens as number) || 0;
      subtotal += cost;
      groups.set(key, g);
    }

    const agents = Array.from(groups.values())
      .sort((a, b) => b.cost - a.cost)
      .map((g) => ({ ...g, pct: subtotal > 0 ? (g.cost / subtotal) * 100 : 0 }));
    return { agents, subtotal };
  });

const AgentDetailSchema = z.object({
  agentSlug: z.string().min(1).max(120),
  days: z.number().int().min(1).max(90).default(30),
});

/** Everything the per-agent drill needs in one call: the agents row, the
 *  ai_events rollup (spend / tokens / p50 / 8-day daily spend), and the
 *  agent_runs ledger (runs count, top missions by cost, recent runs). */
export const getAgentAnalyticsDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AgentDetailSchema.parse(i))
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    // (1) Resolve the agents row — by slug first; a pasted uuid still resolves.
    let agent: AgentRow | null = null;
    const bySlug = await context.supabase
      .from("agents")
      .select("id,slug,name,role")
      .eq("slug", data.agentSlug)
      .maybeSingle();
    if (bySlug.error) throw new Error(bySlug.error.message);
    agent = (bySlug.data as AgentRow | null) ?? null;
    if (!agent && UUID_RE.test(data.agentSlug)) {
      const byId = await context.supabase
        .from("agents")
        .select("id,slug,name,role")
        .eq("id", data.agentSlug)
        .maybeSingle();
      if (byId.error) throw new Error(byId.error.message);
      agent = (byId.data as AgentRow | null) ?? null;
    }

    // (2) ai_events — the authoritative spend/token/latency ledger. The same
    // agent legitimately appears under both its slug (loop calls) and its
    // uuid (legacy direct runs); read both refs and merge.
    const refs = agent
      ? Array.from(new Set([agent.slug, agent.id, data.agentSlug]))
      : [data.agentSlug];
    const evts = await context.supabase
      .from("ai_events")
      .select("created_at,total_tokens,est_cost_usd,latency_ms")
      .eq("surface", "agent")
      .in("surface_ref", refs)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (evts.error) throw new Error(evts.error.message);
    const events = evts.data ?? [];
    const cost = events.reduce((s, e) => s + Number(e.est_cost_usd || 0), 0);
    const tokens = events.reduce((s, e) => s + ((e.total_tokens as number) || 0), 0);
    const latencies = events
      .map((e) => (e.latency_ms as number) || 0)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const p50Latency = latencies.length
      ? (latencies[Math.floor(latencies.length * 0.5)] ?? latencies[latencies.length - 1])
      : 0;

    // Daily spend — last 8 UTC days, zero-filled (a day with no events is a
    // real $0, not an invention). Same created_at.slice(0,10) bucketing as
    // getAnalyticsOverview.
    const dayBuckets = new Map<string, number>();
    for (const e of events) {
      const k = (e.created_at as string).slice(0, 10);
      dayBuckets.set(k, (dayBuckets.get(k) ?? 0) + Number(e.est_cost_usd || 0));
    }
    const dailySpend: { day: string; cost: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dailySpend.push({ day, cost: dayBuckets.get(day) ?? 0 });
    }

    // (3) agent_runs — the runs ledger. A run = many model calls, and its
    // tokens_used / spend_used_usd only count runId-tied calls after
    // migration 20260603205441 — so these columns will NOT sum to the
    // ai_events stats above. That disagreement is real, by design.
    const slug = agent?.slug ?? data.agentSlug;
    const [runCount, runRows] = await Promise.all([
      context.supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("agent_slug", slug)
        .gte("created_at", since),
      context.supabase
        .from("agent_runs")
        .select("id,created_at,mission_id,tokens_used,duration_ms,spend_used_usd,status")
        .eq("agent_slug", slug)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (runCount.error) throw new Error(runCount.error.message);
    if (runRows.error) throw new Error(runRows.error.message);
    type RunRow = {
      id: string;
      created_at: string;
      mission_id: string | null;
      tokens_used: number | null;
      duration_ms: number | null;
      spend_used_usd: number | string | null;
      status: string;
    };
    const runs = (runRows.data ?? []) as RunRow[];

    // Top missions by cost — group by mission_id. The NULL bucket is the real
    // set of direct (pre-mission) runs; it renders unlinked, exactly like the
    // reference's id-less rows.
    const missionGroups = new Map<
      string,
      { missionId: string | null; runs: number; cost: number }
    >();
    for (const r of runs) {
      const key = r.mission_id ?? "__direct__";
      const g = missionGroups.get(key) ?? { missionId: r.mission_id, runs: 0, cost: 0 };
      g.runs += 1;
      g.cost += Number(r.spend_used_usd || 0);
      missionGroups.set(key, g);
    }
    const topMissionsRaw = Array.from(missionGroups.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
    const recent = runs.slice(0, 12);

    const missionIds = Array.from(
      new Set(
        [...topMissionsRaw.map((m) => m.missionId), ...recent.map((r) => r.mission_id)].filter(
          (x): x is string => !!x,
        ),
      ),
    );
    const titles = new Map<string, string>();
    if (missionIds.length) {
      const ms = await context.supabase.from("missions").select("id,title").in("id", missionIds);
      if (ms.error) throw new Error(ms.error.message);
      for (const m of ms.data ?? []) titles.set(m.id as string, m.title as string);
    }

    return {
      agent,
      stats: {
        cost,
        tokens,
        p50Latency,
        runs: runCount.count ?? runs.length,
        calls: events.length,
      },
      dailySpend,
      topMissions: topMissionsRaw.map((m) => ({
        ...m,
        title: m.missionId ? (titles.get(m.missionId) ?? null) : null,
      })),
      recentRuns: recent.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        mission_id: r.mission_id,
        missionTitle: r.mission_id ? (titles.get(r.mission_id) ?? null) : null,
        tokens_used: r.tokens_used,
        duration_ms: r.duration_ms,
        spend_used_usd: Number(r.spend_used_usd || 0),
        status: r.status,
      })),
    };
  });

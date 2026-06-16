/**
 * Today surface server functions (F-V5-RITUAL).
 *
 * Backs the "Needs you" Calls queue on the Today page: the operator's
 * pending approval gates, specs awaiting their call, Critic-challenged
 * opportunities, and today's AI spend. One query, one card list — the
 * daily ritual reads from here.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSideEffectingTool } from "@/lib/tool-consequences";
import type { CriticReview } from "@/lib/discovery.functions";

export type NeedsYou = {
  approvals: {
    id: string;
    agent_slug: string;
    tool_name: string;
    rationale: string | null;
    escalation_state: string;
    expires_at: string | null;
    created_at: string;
    /** The agent run trace behind the gate (for cost/model + Open). */
    trace_id: string | null;
    /** Model the gated call ran on (Appendix D), or null if no spend recorded. */
    model: string | null;
    /** Spend on this call so far in USD (Appendix D), or null if none recorded. */
    est_cost_usd: number | null;
  }[];
  prdCalls: {
    id: string;
    title: string;
    status: string;
    critic_review: CriticReview | null;
    updated_at: string;
  }[];
  oppCalls: {
    id: string;
    title: string;
    critic_review: CriticReview | null;
    created_at: string;
  }[];
  spendTodayUsd: number;
  /** Median minutes from gate raised to human decision, last 7 days.
   *  Null until at least one gate has been decided. Backs the Today
   *  throughput panel ("Gate response · your median"). */
  gateMedianMinutes: number | null;
};

export const getNeedsYou = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NeedsYou> => {
    const { supabase, userId } = context;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [approvals, prds, opps, events, decided] = await Promise.all([
      supabase
        .from("agent_approvals")
        .select("id,agent_slug,tool_name,rationale,escalation_state,expires_at,created_at,trace_id")
        .eq("user_id", userId)
        .in("escalation_state", ["pending", "expired"])
        .order("expires_at", { ascending: true })
        .limit(10),
      supabase
        .from("prds")
        .select("id,title,status,critic_review,updated_at")
        .eq("status", "review")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("opportunities")
        .select("id,title,critic_review,created_at")
        .filter("critic_review->>verdict", "in", '("revise","kill")')
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("ai_events")
        .select("est_cost_usd")
        .gte("created_at", dayStart.toISOString())
        .limit(1000),
      supabase
        .from("agent_approvals")
        .select("created_at,decided_at")
        .eq("user_id", userId)
        .not("decided_at", "is", null)
        .gte("decided_at", weekAgo)
        .limit(200),
    ]);

    const spendTodayUsd = (events.data ?? []).reduce(
      (s, e) => s + Number((e as { est_cost_usd: number | null }).est_cost_usd || 0),
      0,
    );

    // Gate response — median raised→decided latency over the last week.
    const latencies = ((decided.data ?? []) as { created_at: string; decided_at: string }[])
      .map((a) => (+new Date(a.decided_at) - +new Date(a.created_at)) / 60_000)
      .filter((m) => Number.isFinite(m) && m >= 0)
      .sort((a, b) => a - b);
    const gateMedianMinutes = latencies.length
      ? Math.round(latencies[Math.floor(latencies.length / 2)])
      : null;

    // Per-call cost + model (Appendix D): join each gate's trace to its
    // ai_events. One batched query; honest nulls when a call has no recorded
    // spend yet. RLS scopes ai_events to the caller.
    const approvalRows = (approvals.data ?? []) as Array<{
      id: string;
      agent_slug: string;
      tool_name: string;
      rationale: string | null;
      escalation_state: string;
      expires_at: string | null;
      created_at: string;
      trace_id: string | null;
    }>;
    const traceIds = [
      ...new Set(approvalRows.map((a) => a.trace_id).filter((t): t is string => !!t)),
    ];
    const costByTrace = new Map<string, number>();
    const modelByTrace = new Map<string, string>();
    if (traceIds.length > 0) {
      const { data: ev } = await supabase
        .from("ai_events")
        .select("trace_id,model,est_cost_usd")
        .in("trace_id", traceIds)
        .limit(500);
      for (const e of (ev ?? []) as {
        trace_id: string | null;
        model: string;
        est_cost_usd: number | null;
      }[]) {
        if (!e.trace_id) continue;
        costByTrace.set(
          e.trace_id,
          (costByTrace.get(e.trace_id) ?? 0) + Number(e.est_cost_usd || 0),
        );
        if (!modelByTrace.has(e.trace_id)) modelByTrace.set(e.trace_id, e.model);
      }
    }
    const enrichedApprovals: NeedsYou["approvals"] = approvalRows.map((a) => ({
      ...a,
      model: a.trace_id ? (modelByTrace.get(a.trace_id) ?? null) : null,
      est_cost_usd:
        a.trace_id && costByTrace.has(a.trace_id) ? (costByTrace.get(a.trace_id) ?? null) : null,
    }));

    return {
      approvals: enrichedApprovals,
      prdCalls: (prds.data ?? []) as NeedsYou["prdCalls"],
      oppCalls: (opps.data ?? []) as NeedsYou["oppCalls"],
      spendTodayUsd,
      gateMedianMinutes,
    };
  });

/**
 * Cold-start gate (v6 Phase 0 / W4). A workspace is "cold" when it has no
 * signals, opportunities, or specs yet — the agents have nothing to work from.
 * This is REAL emptiness, distinct from an all-clear queue (data exists, no
 * pending calls). Today shows the narrated on-ramp only when isCold is true, so
 * the seeded demo workspace never sees it. Cheap head-count queries (no rows
 * fetched); RLS scopes to the caller.
 */
export const getColdStart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isCold: boolean }> => {
    const { supabase, userId } = context;
    const [sig, opp, prd] = await Promise.all([
      supabase.from("signals").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase.from("prds").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const total = (sig.count ?? 0) + (opp.count ?? 0) + (prd.count ?? 0);
    return { isCold: total === 0 };
  });

// ---------------------------------------------------------------------------
// M-A Slice 2: "Executed unattended" Today card.
//
// What the loop ran on its OWN (no human gate). The honest source is tool_calls:
// every tool_calls row is an inline auto-mode execution (gated tools queue an
// agent_approvals row instead), so a SUCCESSFUL (ok=true) SIDE-EFFECTING one is a
// write the agent's trust arc carried without your call. We do NOT read
// agent_approvals(status='executed'): those are calls YOU approved, not
// unattended. Effect, reversibility, and how-to-reverse come from the static
// tool-consequences catalogue (never the model), so the claim never outruns the
// wiring; there is deliberately no "undo" action (no compensating-call flow
// exists yet, and a fake one on an already-done side effect would be dishonest),
// only the honest reverse-path text per tool, surfaced by the card.

export type ExecutedUnattended = {
  tool_name: string;
  /** Display name of the agent that ran it, or null if not resolvable. */
  agent_name: string | null;
  created_at: string;
  latency_ms: number | null;
};

export const getRecentExecutedUnattended = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ runs: ExecutedUnattended[] }> => {
    const { supabase, userId } = context;
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("tool_calls")
      .select("tool_name,agent_id,created_at,latency_ms")
      .eq("user_id", userId)
      .eq("ok", true) // successful inline executions only (a failed attempt did not carry the work)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    // Side-effecting only = the writes the loop carried unattended (read tools run
    // inline too but are not delegation). Catalogue-gated via isSideEffectingTool.
    const sideEffecting = (
      (rows ?? []) as {
        tool_name: string;
        agent_id: string | null;
        created_at: string;
        latency_ms: number | null;
      }[]
    )
      .filter((r) => isSideEffectingTool(r.tool_name))
      .slice(0, 6);

    // Batched agent-name lookup; best-effort (degrade to null, never block the card).
    const agentIds = [
      ...new Set(sideEffecting.map((r) => r.agent_id).filter((x): x is string => !!x)),
    ];
    const nameById = new Map<string, string>();
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from("agents")
        .select("id,name")
        .in("id", agentIds)
        .limit(50);
      for (const a of (agents ?? []) as { id: string; name: string }[]) nameById.set(a.id, a.name);
    }

    return {
      runs: sideEffecting.map((r) => ({
        tool_name: r.tool_name,
        agent_name: r.agent_id ? (nameById.get(r.agent_id) ?? null) : null,
        created_at: r.created_at,
        latency_ms: r.latency_ms,
      })),
    };
  });

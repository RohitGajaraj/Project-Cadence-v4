/**
 * Today surface server functions (F-V5-RITUAL).
 *
 * Backs the "Needs you" Calls queue on the Today page: the operator's
 * pending approval gates, specs awaiting their call, Critic-challenged
 * opportunities, and today's AI spend. One query, one card list — the
 * daily ritual reads from here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSideEffectingTool } from "@/lib/tool-consequences";
import type { CriticReview } from "@/lib/discovery.functions";
import { entitlementsFor, normalizePlanTier, type PlanTier } from "@/lib/entitlements";
import { assessMemoryExpiry, type MemoryExpiryState } from "@/lib/plg-memory-expiry";
import {
  type CompoundingLearning,
  type CompoundingSummary,
  type Rescore,
  rescoresOf,
  summarizeCompounding,
} from "@/lib/moat-vis";

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
// F-TODAY-LOOPPULSE — "what the loop did while you were away".
//
// A tight count of what the autonomous loop produced in the last 24h: new
// signals sensed, opportunities framed, specs drafted, agent runs executed, and
// memories distilled. Read-only, RLS-scoped (every table is keyed on user_id +
// indexed on created_at). Each count degrades to 0 on error, so a missing column
// can never break Today. Surfaced as one line in the Today hero — the second
// half of the Today mandate (what needs me + what the loop did while I was away).

export type LoopPulse = {
  windowHours: number;
  signals: number;
  opportunities: number;
  specs: number;
  runs: number;
  memories: number;
  total: number;
};

export const getLoopPulse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LoopPulse> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const countSince = (table: string) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
    const [sig, opp, prd, runs, mem] = await Promise.all([
      countSince("signals"),
      countSince("opportunities"),
      countSince("prds"),
      countSince("agent_runs"),
      countSince("agent_memory"),
    ]);
    const signals = sig.count ?? 0;
    const opportunities = opp.count ?? 0;
    const specs = prd.count ?? 0;
    const runsCount = runs.count ?? 0;
    const memories = mem.count ?? 0;
    return {
      windowHours: 24,
      signals,
      opportunities,
      specs,
      runs: runsCount,
      memories,
      total: signals + opportunities + specs + runsCount + memories,
    };
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

// MOAT-VIS — make the compounding visible. The outcome loop (recordOutcome) writes
// a `learnings` row carrying prior_ice/new_ice + the verdict that moved the score.
// This is the canonical rescore-cause read that both Today's "what changed" card and
// the Brain's Learnings tab consume, so the compounding story has one source of truth
// (the pure summarizer in moat-vis.ts). RLS-scoped via the authed client; fail-safe.

export type CompoundingResult = {
  /** Newest-first, capped; each rescore carries its cause (verdict + summary). */
  rescores: Rescore[];
  summary: CompoundingSummary;
};

export const getCompounding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompoundingResult> => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data, error } = await db
      .from("learnings")
      .select(
        "id, verdict, summary, prior_ice, new_ice, created_at, opportunity:opportunities(title)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    // Flatten the to-one opportunity embed (PostgREST may widen it to an array),
    // mirroring listLearnings so the wire shape stays flat + back-compatible.
    type Wire = {
      id: string;
      verdict: "validated" | "missed" | "mixed";
      summary: string;
      prior_ice: number | string | null;
      new_ice: number | string | null;
      created_at: string;
      opportunity: { title: string | null } | { title: string | null }[] | null;
    };
    const learnings: CompoundingLearning[] = ((data ?? []) as Wire[]).map(
      ({ opportunity, ...rest }) => {
        const opp = Array.isArray(opportunity) ? opportunity[0] : opportunity;
        return { ...rest, opportunity_title: opp?.title ?? null };
      },
    );

    // One pure path feeds both halves so the feed and the summary never drift: the
    // query is created_at desc, so rescoresOf preserves newest-first ordering.
    const rescores = rescoresOf(learnings);
    const summary = summarizeCompounding(learnings);
    return { rescores, summary };
  });

// ─────────────────────────────────────────────────────────────────────────────
// PLG Phase 3 — memory-retention upgrade nudge (getMemoryExpiry).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a workspace's plan tier: the account's plan wins, falling back to the
 * workspace `plan_tier` shim, then free. Pre-migration tolerant. (A minimal, read-
 * only mirror of limits.functions.ts' private resolver — duplicated rather than
 * exported across a server-fn boundary to keep each module self-contained.)
 */
async function resolveTier(supabase: SupabaseClient, workspaceId: string): Promise<PlanTier> {
  let tier: PlanTier = "free";
  let accountId: string | null = null;
  try {
    const { data: ws, error } = await supabase
      .from("workspaces")
      .select("plan_tier,account_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    const w = (ws ?? {}) as { plan_tier?: string | null; account_id?: string | null };
    tier = normalizePlanTier(w.plan_tier);
    accountId = w.account_id ?? null;
  } catch {
    try {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("plan_tier")
        .eq("id", workspaceId)
        .maybeSingle();
      tier = normalizePlanTier((ws as { plan_tier?: string | null } | null)?.plan_tier);
    } catch {
      /* keep the free default */
    }
  }
  if (accountId) {
    try {
      const { data: acct } = await supabase
        .from("accounts")
        .select("plan_tier")
        .eq("id", accountId)
        .maybeSingle();
      const a = (acct ?? {}) as { plan_tier?: string | null };
      if (a.plan_tier != null) tier = normalizePlanTier(a.plan_tier);
    } catch {
      /* account row not readable yet; keep the workspace/free tier */
    }
  }
  return tier;
}

/**
 * PLG: the memory-retention nudge state for the active workspace. Free plans keep
 * decision memory on a rolling window then it fades; this surfaces the upgrade
 * value when the workspace's own memory nears that window. Paid plans always read
 * `show:false`. RLS-scoped (the authed client only sees the caller's memory) and
 * fail-safe — any error returns a non-showing state so it can never break Today.
 */
export const getMemoryExpiry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i ?? {}))
  .handler(async ({ context, data }): Promise<MemoryExpiryState> => {
    const supabase = context.supabase as unknown as SupabaseClient;
    try {
      const tier = await resolveTier(supabase, data.workspaceId);
      const retentionDays = entitlementsFor(tier).memoryRetentionDays;
      // Paid: short-circuit before any memory read (memory never fades).
      if (retentionDays === null) {
        return { show: false, total: 0, retentionDays: null, expiringCount: 0, soonestDays: null };
      }
      const { data: rows } = await supabase
        .from("agent_memory")
        .select("created_at,expires_at")
        .eq("workspace_id", data.workspaceId)
        .limit(2000);
      return assessMemoryExpiry({
        memories: (rows ?? []) as { created_at: string | null; expires_at: string | null }[],
        retentionDays,
        nowMs: Date.now(),
      });
    } catch {
      return { show: false, total: 0, retentionDays: null, expiringCount: 0, soonestDays: null };
    }
  });

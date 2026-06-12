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
        .select("id,agent_slug,tool_name,rationale,escalation_state,expires_at,created_at")
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

    return {
      approvals: (approvals.data ?? []) as NeedsYou["approvals"],
      prdCalls: (prds.data ?? []) as NeedsYou["prdCalls"],
      oppCalls: (opps.data ?? []) as NeedsYou["oppCalls"],
      spendTodayUsd,
      gateMedianMinutes,
    };
  });

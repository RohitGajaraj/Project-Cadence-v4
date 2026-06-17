/**
 * ENG-06 (Part B1) — cost-per-outcome for the calm front.
 *
 * The Engine-Room-Doctrine-safe expression of the founder's "how much are the
 * agents consuming" ask: the user meets the OUTCOME ("what you got for what you
 * spent"), never raw token/API telemetry. The deep per-agent unit economics
 * live behind the Engine Room door (see getUnitEconomics in analytics.functions.ts).
 * One tight line on Today's "This week" pulse.
 *
 * Engine-Room: per-run AI spend + outcome counts -> stays a single calm "shipped
 * this week for $X" line on Today -> full per-mission/per-artifact cost behind
 * Engine Room > Analytics.
 *
 * Decision: docs/strategy/session-decisions.md (2026-06-17, agent-manager framing).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CostPerOutcome = {
  /** Specs (PRDs) created in the trailing 7-day window. */
  specs: number;
  /** Decisions recorded in the same window. */
  decisions: number;
  /** Missions completed in the same window. */
  missions: number;
  /** AI spend over the same 7-day window, USD. Matches Today's "This week" frame. */
  weekSpendUsd: number;
  /** Month-to-date spend from the user's budget, USD (0 if no budget row). */
  monthUsedUsd: number;
  /** Monthly cap, USD, or null when the user has set no budget. */
  monthCapUsd: number | null;
};

export const getCostPerOutcome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CostPerOutcome> => {
    const { supabase, userId } = context;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [specsRes, decisionsRes, missionsRes, runsRes, budgetRes] = await Promise.all([
      supabase
        .from("prds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", weekAgo),
      supabase
        .from("decisions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", weekAgo),
      supabase
        .from("missions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", weekAgo),
      supabase
        .from("agent_runs")
        .select("spend_used_usd")
        .eq("user_id", userId)
        .gte("created_at", weekAgo),
      supabase
        .from("ai_budgets")
        .select("monthly_usd_used, monthly_usd_cap")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (specsRes.error) throw new Error(specsRes.error.message);
    if (decisionsRes.error) throw new Error(decisionsRes.error.message);
    if (missionsRes.error) throw new Error(missionsRes.error.message);
    if (runsRes.error) throw new Error(runsRes.error.message);
    // A missing ai_budgets row is expected (no budget set); only a hard error throws.
    if (budgetRes.error) throw new Error(budgetRes.error.message);

    const weekSpendUsd = (runsRes.data ?? []).reduce((sum, r) => sum + Number(r.spend_used_usd), 0);

    return {
      specs: specsRes.count ?? 0,
      decisions: decisionsRes.count ?? 0,
      missions: missionsRes.count ?? 0,
      weekSpendUsd,
      monthUsedUsd: Number(budgetRes.data?.monthly_usd_used ?? 0),
      monthCapUsd:
        budgetRes.data?.monthly_usd_cap != null ? Number(budgetRes.data.monthly_usd_cap) : null,
    };
  });

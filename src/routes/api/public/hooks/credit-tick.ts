import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { grantMonthlyAllowance, resetCreditCycle } from "@/lib/credits.functions";
import type { PlanTier } from "@/lib/entitlements";

/**
 * credit-tick hook (WM-M11).
 *
 * Drives the credit cycle: grants un-granted accounts their tier's monthly INCLUDED
 * allowance, and re-grants (resets) accounts whose billing cycle has rolled over
 * (~30 days since cycle_anchor), preserving purchased top-ups. Strict no-op while
 * credits_enabled() is false (today's dormant state) and pre-migration tolerant
 * (a missing account_credits table counts as zero). Idempotent; poke via pg_cron.
 */
const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

type CreditTickRow = {
  account_id: string;
  monthly_grant_credits: number | null;
  cycle_anchor: string | null;
  accounts: { plan_tier?: string | null } | { plan_tier?: string | null }[] | null;
};

function planTierOf(row: CreditTickRow): PlanTier {
  const a = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
  return (a?.plan_tier ?? "free") as PlanTier;
}

export const Route = createFileRoute("/api/public/hooks/credit-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireHookCaller(request);
        if (unauth) return unauth;
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        try {
          const { data: enabled } = await (supabaseAdmin as unknown as SupabaseClient).rpc(
            "credits_enabled",
          );
          if (enabled !== true) {
            return json({ ok: true, skipped: "dormant", granted: 0, reset: 0 });
          }
          const cutoff = new Date(Date.now() - CYCLE_MS).toISOString();
          const { data, error } = await (supabaseAdmin as unknown as SupabaseClient)
            .from("account_credits")
            .select("account_id, monthly_grant_credits, cycle_anchor, accounts(plan_tier)")
            .limit(1000);
          if (error || !data) {
            return json({ ok: true, granted: 0, reset: 0, note: "no credit pool yet" });
          }
          let granted = 0;
          let reset = 0;
          for (const row of data as CreditTickRow[]) {
            const monthly = Number(row.monthly_grant_credits ?? 0);
            if (monthly <= 0) {
              await grantMonthlyAllowance(row.account_id, planTierOf(row));
              granted++;
            } else if (!row.cycle_anchor || row.cycle_anchor < cutoff) {
              await resetCreditCycle(row.account_id);
              reset++;
            }
          }
          return json({ ok: true, granted, reset });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
        }
      },
    },
  },
});

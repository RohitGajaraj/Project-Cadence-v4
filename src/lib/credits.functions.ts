/**
 * WM-M11: per-tier credit grant + monthly cycle reset (the credit-engine grant side).
 *
 * `grantMonthlyAllowance` sets an account's INCLUDED balance to its tier's monthly
 * allowance (on signup / plan change); `resetCreditCycle` re-grants the included
 * balance each billing cycle while PRESERVING the purchased top-up balance. Both write
 * the service-role-only `credit_ledger` (reason 'grant' / 'reset') and are a strict
 * no-op while `credits_enabled()` is false (today's dormant state). The amounts come
 * from `entitlements.creditMonthlyBase` (founder-tunable placeholders, plan §7).
 *
 * Server-only: writes the service-role credit tables via `supabaseAdmin`. Relative
 * imports keep the pure helpers (`monthlyGrantCredits`, `resetDelta`) unit-testable
 * without pulling a path alias into the test runner; the lazy `supabaseAdmin` Proxy is
 * never constructed unless a DB-writing function actually runs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { entitlementsFor, type PlanTier } from "./entitlements";

/**
 * The monthly INCLUDED credit allowance for a tier. Returns 0 when the tier carries no
 * metered base (enterprise = a negotiated custom model). Pure + deterministic.
 */
export function monthlyGrantCredits(tier: PlanTier): number {
  const base = entitlementsFor(tier).creditMonthlyBase;
  return typeof base === "number" && base > 0 ? Math.floor(base) : 0;
}

/**
 * The signed ledger delta that moves an account's included balance from
 * `currentIncluded` to its `monthlyGrant` (positive = top back up, negative = a
 * leftover above the grant is reset down). Pure: `currentIncluded + resetDelta == grant`.
 */
export function resetDelta(currentIncluded: number, monthlyGrant: number): number {
  return Math.floor(monthlyGrant) - Math.floor(currentIncluded);
}

async function creditsEngineEnabled(): Promise<boolean> {
  try {
    const { data, error } = await (supabaseAdmin as unknown as SupabaseClient).rpc(
      "credits_enabled",
    );
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * Grant a tier's monthly INCLUDED allowance to an account (signup / plan change). Sets
 * the included balance to the tier amount, records the cycle anchor, and writes a
 * 'grant' ledger row; the purchased top-up balance is untouched. No-op while dormant.
 */
export async function grantMonthlyAllowance(accountId: string, tier: PlanTier): Promise<void> {
  if (!(await creditsEngineEnabled())) return;
  const amount = monthlyGrantCredits(tier);
  if (amount <= 0) return;
  const admin = supabaseAdmin as unknown as SupabaseClient;
  try {
    const { data } = await admin
      .from("account_credits")
      .select("balance_credits")
      .eq("account_id", accountId)
      .maybeSingle();
    const currentIncluded = Number(
      (data as { balance_credits?: number } | null)?.balance_credits ?? 0,
    );
    await admin
      .from("account_credits")
      .update({
        balance_credits: amount,
        monthly_grant_credits: amount,
        cycle_anchor: new Date().toISOString(),
      })
      .eq("account_id", accountId);
    await admin.from("credit_ledger").insert({
      account_id: accountId,
      delta_credits: amount - currentIncluded,
      reason: "grant",
    });
  } catch (e) {
    console.error("grantMonthlyAllowance failed:", e);
  }
}

/**
 * Re-grant the account's INCLUDED allowance for a new billing cycle: reset the included
 * balance to its stored monthly grant, anchor the new cycle, and PRESERVE the purchased
 * top-up balance. Writes a 'reset' ledger row for the net movement. No-op while dormant.
 * Never-granted accounts (monthly grant 0) are left for `grantMonthlyAllowance`.
 */
export async function resetCreditCycle(accountId: string): Promise<void> {
  if (!(await creditsEngineEnabled())) return;
  const admin = supabaseAdmin as unknown as SupabaseClient;
  try {
    const { data } = await admin
      .from("account_credits")
      .select("balance_credits, monthly_grant_credits")
      .eq("account_id", accountId)
      .maybeSingle();
    const row = (data ?? {}) as { balance_credits?: number; monthly_grant_credits?: number };
    const monthlyGrant = Number(row.monthly_grant_credits ?? 0);
    if (monthlyGrant <= 0) return;
    const delta = resetDelta(Number(row.balance_credits ?? 0), monthlyGrant);
    await admin
      .from("account_credits")
      .update({ balance_credits: monthlyGrant, cycle_anchor: new Date().toISOString() })
      .eq("account_id", accountId);
    if (delta !== 0) {
      await admin.from("credit_ledger").insert({
        account_id: accountId,
        delta_credits: delta,
        reason: "reset",
      });
    }
  } catch (e) {
    console.error("resetCreditCycle failed:", e);
  }
}

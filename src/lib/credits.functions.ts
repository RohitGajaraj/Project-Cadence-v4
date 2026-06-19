/**
 * WM-M11: per-tier credit grant + monthly cycle reset (the credit-engine grant side).
 * WM-M14: per-product / per-member attribution rollup + the pure cap math.
 *
 * `grantMonthlyAllowance` sets an account's INCLUDED balance to its tier's monthly
 * allowance (on signup / plan change); `resetCreditCycle` re-grants the included
 * balance each billing cycle while PRESERVING the purchased top-up balance. Both write
 * the service-role-only `credit_ledger` (reason 'grant' / 'reset') and are a strict
 * no-op while `credits_enabled()` is false (today's dormant state). The amounts come
 * from `entitlements.creditMonthlyBase` (founder-tunable placeholders, plan §7).
 *
 * WM-M14 adds the attribution side: `rollupAttribution` (pure, groups ledger debits by
 * product + member, reconciles to the total), `computeCreditAttribution` (the
 * RLS-scoped read for the Usage panel, consumed by WM-M16), and the pure cap math
 * (`capExceeded`, `creditWindowStartIso`, `sumDebitCredits`) that the runtime cap check
 * (runtime.server.ts assertCreditCaps) drives on the hot path.
 *
 * Server-only: writes the service-role credit tables via `supabaseAdmin`. Relative
 * imports keep the pure helpers unit-testable without pulling a path alias into the test
 * runner; the lazy `supabaseAdmin` Proxy is never constructed unless a DB-writing
 * function actually runs. The RLS-scoped read takes an injected client, so it stays here
 * (in the credits domain) without dragging createServerFn / auth-middleware imports into
 * the test graph; the authed HTTP boundary pairs with its consumer (WM-M16).
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

// --- WM-M14: per-product / per-member attribution + the pure cap math ---------
// The pool is account-level; owners need to SEE where credits went (attribution) and may
// optionally CAP a single product or member. The attribution rollup + cap math are pure
// (unit-tested); the RLS-scoped read takes an injected client; the runtime drives the cap
// math on the hot path (runtime.server.ts assertCreditCaps). All inert until the founder
// flips credits_enabled() and an owner sets a cap.

/** A single credit_ledger debit row, projected to just what attribution needs. */
export type LedgerDebitRow = {
  delta_credits: number;
  product_id: string | null;
  user_id: string | null;
};

/** One attribution bucket: a product id / member id (null = unattributed) and its spend. */
export type AttributionBucket = { id: string | null; credits: number };

/** The per-product + per-member rollup of an account's debits over a window. */
export type CreditAttribution = {
  byProduct: AttributionBucket[];
  byMember: AttributionBucket[];
  totalDebited: number;
};

/**
 * Total credits debited across ledger debit rows, as a POSITIVE number (debits are stored
 * negative). Non-finite / positive deltas are ignored defensively. Pure.
 */
export function sumDebitCredits(rows: LedgerDebitRow[]): number {
  let total = 0;
  for (const r of rows) {
    const d = Number(r.delta_credits);
    if (Number.isFinite(d) && d < 0) total += -d;
  }
  return total;
}

/**
 * Group ledger debit rows into per-product and per-member spend (positive credits), sorted
 * high to low, with a null bucket for unattributed rows. The reconciliation invariant the
 * spec requires holds by construction: sum(byProduct) === sum(byMember) === totalDebited.
 * Pure + deterministic.
 */
export function rollupAttribution(rows: LedgerDebitRow[]): CreditAttribution {
  const products = new Map<string | null, number>();
  const members = new Map<string | null, number>();
  for (const r of rows) {
    const d = Number(r.delta_credits);
    if (!Number.isFinite(d) || d >= 0) continue; // only real debits attribute
    const credits = -d;
    const pid = r.product_id ?? null;
    const uid = r.user_id ?? null;
    products.set(pid, (products.get(pid) ?? 0) + credits);
    members.set(uid, (members.get(uid) ?? 0) + credits);
  }
  const toBuckets = (m: Map<string | null, number>): AttributionBucket[] =>
    [...m.entries()]
      .map(([id, credits]) => ({ id, credits }))
      .sort((a, b) => b.credits - a.credits);
  return {
    byProduct: toBuckets(products),
    byMember: toBuckets(members),
    totalDebited: sumDebitCredits(rows),
  };
}

/**
 * Would drawing `projected` more credits push `spent` over `cap`? A cap of 0 blocks any
 * billable draw; a non-finite cap means "no cap" (never exceeded). Pure.
 */
export function capExceeded(spent: number, projected: number, cap: number): boolean {
  if (!Number.isFinite(cap)) return false;
  return Math.max(0, spent) + Math.max(0, projected) > cap;
}

/**
 * The ISO start of a cap's spend window. 'day' / 'month' are calendar windows (mirroring
 * the ai_budgets day/month windows); 'cycle' uses the account's billing cycle_anchor when
 * present, else falls back to the month start. `nowIso` is injected so the math is pure.
 */
export function creditWindowStartIso(
  windowKind: "cycle" | "day" | "month",
  cycleAnchorIso: string | null | undefined,
  nowIso: string,
): string {
  if (windowKind === "day") return nowIso.slice(0, 10) + "T00:00:00.000Z";
  const monthStart = nowIso.slice(0, 7) + "-01T00:00:00.000Z";
  if (windowKind === "month") return monthStart;
  // cycle: prefer the account's billing anchor, else the month start.
  return cycleAnchorIso && cycleAnchorIso.length >= 10 ? cycleAnchorIso : monthStart;
}

/**
 * Read an account's credit attribution over an optional window, RLS-scoped to account
 * membership. Returns the per-product + per-member rollup; renders an empty rollup
 * gracefully before the engine has any debits. Never throws. Consumed by the WM-M16
 * Usage panel.
 *
 * SECURITY: `supabase` MUST be the caller's AUTHED, RLS-scoped client (the credit_ledger
 * member-read policy is what filters foreign accounts). Never pass the service-role
 * `supabaseAdmin` here, or every account's spend leaks to anyone who can name an accountId.
 * The WM-M16 server-fn wrapper (createServerFn + requireSupabaseAuth) supplies that client.
 */
export async function computeCreditAttribution(
  supabase: SupabaseClient,
  accountId: string,
  opts: { sinceIso?: string | null } = {},
): Promise<CreditAttribution> {
  const empty: CreditAttribution = { byProduct: [], byMember: [], totalDebited: 0 };
  try {
    let q = supabase
      .from("credit_ledger")
      .select("delta_credits, product_id, user_id")
      .eq("account_id", accountId)
      .eq("reason", "debit");
    if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);
    const { data, error } = await q;
    if (error || !data) return empty;
    return rollupAttribution(data as LedgerDebitRow[]);
  } catch {
    return empty;
  }
}

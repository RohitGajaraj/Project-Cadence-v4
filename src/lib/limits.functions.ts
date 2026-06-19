/**
 * WM-M5: tier limit gates (the server-side nice path).
 *
 * The DB triggers enforce_product_limit / enforce_workspace_limit (migration
 * 20260619200000_wm_m5_tier_limit_gates.sql) are the AUTHORITATIVE, unbypassable
 * guard: the client inserts products straight from the browser (AppShell), so a
 * server-only check is bypassable. This module is the friendly path -- a server
 * pre-check on the createProject server fn that throws a typed LimitReachedError
 * (carrying an upsell target) so the UI can react before the raw trigger error
 * ever surfaces.
 *
 * Limit NUMBERS are owned by entitlements.ts (limitFor) -- the single TS source
 * of truth. The SQL functions tier_product_limit / tier_workspace_limit in the
 * migration MIRROR these and must be kept in sync (the migration documents it).
 *
 * Dormant by default: gated behind limit_gates_enabled() (= false) just like the
 * trigger, so the server pre-check and the DB guard agree. Until the founder
 * flips the flag, this is a strict no-op and behavior is unchanged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_TIERS,
  limitFor,
  normalizePlanTier,
  type LimitKind,
  type PlanTier,
} from "@/lib/entitlements";

/**
 * The next tier up whose cap for `kind` is higher than the current tier's (or
 * unlimited). null when the current tier is already unlimited or the top tier.
 * Pure -- unit-tested.
 */
export function nextUpsellTier(tier: PlanTier, kind: LimitKind): PlanTier | null {
  const current = limitFor(tier, kind);
  if (current === null) return null; // already generous/unlimited
  const start = PLAN_TIERS.indexOf(tier);
  for (let i = start + 1; i < PLAN_TIERS.length; i++) {
    const next = PLAN_TIERS[i];
    const lim = limitFor(next, kind);
    if (lim === null || lim > current) return next;
  }
  return null;
}

/**
 * Whether creating one more of `kind` would exceed the cap. A null limit means
 * unlimited, so it is never over. Pure -- unit-tested.
 */
export function isOverLimit(currentCount: number, limit: number | null): boolean {
  return limit !== null && currentCount >= limit;
}

/** The structured error the UI consumes to render a gain-framed upgrade nudge. */
export class LimitReachedError extends Error {
  readonly kind: LimitKind;
  readonly currentTier: PlanTier;
  readonly limit: number;
  readonly upsellTier: PlanTier | null;

  constructor(kind: LimitKind, currentTier: PlanTier, limit: number) {
    const noun = kind === "product" ? "product" : "workspace";
    super(
      `You have reached your plan limit of ${limit} ${noun}${limit === 1 ? "" : "s"}. ` +
        `Upgrade your plan to add more.`,
    );
    this.name = "LimitReachedError";
    this.kind = kind;
    this.currentTier = currentTier;
    this.limit = limit;
    this.upsellTier = nextUpsellTier(currentTier, kind);
  }
}

// limit_gates_enabled() is a rarely-flipped flag; cache it in-process so the
// dormant path costs at most one RPC per process per TTL. A missing function or
// any error keeps the gate dormant (false) and never blocks a create. Mirrors
// the creditsEnabled() cache in runtime.server.ts.
let _limitGatesCache: { value: boolean; at: number } | null = null;
const LIMIT_FLAG_TTL_MS = 5 * 60 * 1000;

async function limitGatesEnabled(supabase: SupabaseClient): Promise<boolean> {
  const now = Date.now();
  if (_limitGatesCache && now - _limitGatesCache.at < LIMIT_FLAG_TTL_MS) {
    return _limitGatesCache.value;
  }
  let value = false;
  try {
    const { data, error } = await supabase.rpc("limit_gates_enabled");
    if (!error) value = data === true;
  } catch {
    value = false;
  }
  _limitGatesCache = { value, at: now };
  return value;
}

/**
 * Resolve the plan tier for a workspace: the account's plan wins, falling back to
 * the workspace plan_tier shim, then free. Pre-migration tolerant (accounts /
 * account_id land on a later sync). Returns the tier plus the account id (null
 * pre-migration) so the caller can count account-wide.
 */
async function resolveWorkspaceTier(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ tier: PlanTier; accountId: string | null }> {
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
    // pre-migration (no account_id column): read the known column for the shim.
    try {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("plan_tier")
        .eq("id", workspaceId)
        .maybeSingle();
      tier = normalizePlanTier((ws as { plan_tier?: string | null } | null)?.plan_tier);
    } catch {
      // keep the free default.
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
      // accounts table absent yet: keep the workspace shim tier.
    }
  }

  return { tier, accountId };
}

/**
 * Server-side pre-check before createProject inserts. Best-effort and pre-migration
 * tolerant: a no-op while limit_gates_enabled() is false; otherwise it resolves the
 * account tier and counts the account's active (non-archived) products across all
 * its workspaces (account-wide, matching the DB trigger), and throws a typed
 * LimitReachedError when at/over the cap. Any DB-shape error is swallowed so this
 * never throws a non-LimitReachedError -- the DB trigger stays the real guard.
 */
export async function assertCanCreateProduct(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<void> {
  if (!(await limitGatesEnabled(supabase))) return;

  const { tier, accountId } = await resolveWorkspaceTier(supabase, workspaceId);
  const limit = limitFor(tier, "product");
  if (limit === null) return; // generous/unlimited tier.

  // The cap is account-wide. Resolve the account's workspace set (falling back to
  // the single workspace pre-migration), then count active products across it.
  let workspaceIds: string[] = [workspaceId];
  if (accountId) {
    try {
      const { data: rows } = await supabase
        .from("workspaces")
        .select("id")
        .eq("account_id", accountId);
      const ids = (rows ?? []).map((r) => (r as { id: string }).id);
      if (ids.length > 0) workspaceIds = ids;
    } catch {
      // keep the single-workspace fallback.
    }
  }

  let count = 0;
  try {
    const res = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("workspace_id", workspaceIds)
      .is("archived_at", null);
    count = res.count ?? 0;
  } catch {
    return; // best-effort; the DB trigger is the authoritative guard.
  }

  if (isOverLimit(count, limit)) {
    throw new LimitReachedError("product", tier, limit);
  }
}

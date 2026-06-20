/**
 * Map a Stripe price `lookup_key` to a Cadence PlanTier.
 *
 * Lookup keys follow a stable prefix convention seeded with the Stripe catalog:
 *   cluster_*       -> pro
 *   constellation_* -> max
 *   galaxy_*        -> team
 *   topup_*         -> null (one-time, never changes plan)
 *
 * Single source of truth used by the webhook to flip accounts.plan_tier and by
 * the checkout UI to pick a sensible default bundle for an upgrade.
 */
import type { PlanTier } from "@/lib/entitlements";

export function tierFromLookupKey(lookupKey: string | null | undefined): PlanTier | null {
  if (!lookupKey) return null;
  if (lookupKey.startsWith("cluster_")) return "pro";
  if (lookupKey.startsWith("constellation_")) return "max";
  if (lookupKey.startsWith("galaxy_")) return "team";
  return null;
}

/** Default monthly bundle lookup key for a tier, used when the user clicks "Upgrade" without picking a bundle size. */
export function defaultMonthlyLookupKey(tier: PlanTier): string | null {
  switch (tier) {
    case "pro":  return "cluster_1k_monthly";
    case "max":  return "constellation_5k_monthly";
    case "team": return "galaxy_1k_seat_monthly";
    default:     return null;
  }
}

/** Tier slug -> Stripe lookup_key prefix. */
const TIER_PREFIX: Record<Exclude<PlanTier, "free" | "enterprise">, string> = {
  pro: "cluster",
  max: "constellation",
  team: "galaxy",
};

/**
 * Build the Stripe `lookup_key` for a (tier, credits, interval) bundle.
 * Convention: `<prefix>_<credits-shorthand>[_seat]_<monthly|yearly>`.
 * - credits < 1000 -> raw number (e.g. `500`)
 * - credits >= 1000 and a multiple of 1000 -> `Nk` (e.g. `1k`, `10k`)
 * - otherwise -> raw number
 * - team adds `_seat` (per-seat pricing).
 */
export function lookupKeyFor(
  tier: PlanTier,
  credits: number,
  interval: "monthly" | "yearly",
): string | null {
  if (tier === "free" || tier === "enterprise") return null;
  const prefix = TIER_PREFIX[tier];
  const shorthand =
    credits >= 1000 && credits % 1000 === 0 ? `${credits / 1000}k` : `${credits}`;
  const seat = tier === "team" ? "_seat" : "";
  return `${prefix}_${shorthand}${seat}_${interval}`;
}

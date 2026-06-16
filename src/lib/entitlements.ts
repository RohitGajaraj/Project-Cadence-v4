/**
 * M-C entitlements: the pure plan-to-capability map (v7 section 9 pricing).
 *
 * No DB and no side effects, so it is unit-tested directly. The plan tier lives
 * on workspaces.plan_tier (set only by billing); this module turns it into the
 * booleans the app gates on. Enforcement of each gate is wired separately and
 * incrementally; this module is the single source of truth for what each tier
 * is entitled to.
 */

export type PlanTier = "free" | "pro" | "team";

export const PLAN_TIERS: readonly PlanTier[] = ["free", "pro", "team"] as const;

/** Free decision memory is kept this many days, then expires. Paid keeps it forever. */
export const FREE_MEMORY_RETENTION_DAYS = 14;

export type Entitlements = {
  /** Distilled decision memory persists (paid) or expires (free). The core charge. */
  memoryPersists: boolean;
  /** Days free memory is retained before expiry; null means it never expires. */
  memoryRetentionDays: number | null;
  /** Critic red-teams every spec and bet, not only on request (paid). */
  criticEverywhere: boolean;
  /** Shareable decision links. Live for every tier today. */
  shareLinks: boolean;
  /** Shared workspace memory across members (team). */
  sharedWorkspaceMemory: boolean;
  /** Per-role approval lanes (team). */
  perRoleApprovalLanes: boolean;
};

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "free" || value === "pro" || value === "team";
}

/** Coerce any stored or wire value to a known tier, defaulting to free. */
export function normalizePlanTier(value: unknown): PlanTier {
  return isPlanTier(value) ? value : "free";
}

export function entitlementsFor(tier: PlanTier): Entitlements {
  const paid = tier === "pro" || tier === "team";
  return {
    memoryPersists: paid,
    memoryRetentionDays: paid ? null : FREE_MEMORY_RETENTION_DAYS,
    criticEverywhere: paid,
    // Share links stay available on every tier (the feature is already live for
    // all users); v7 lists it as a Pro highlight, not a paid-only gate.
    shareLinks: true,
    sharedWorkspaceMemory: tier === "team",
    perRoleApprovalLanes: tier === "team",
  };
}

export type PlanPresentation = {
  tier: PlanTier;
  name: string;
  /** Display price. Team is intentionally not a fixed number (v7 section 9). */
  price: string;
  tagline: string;
  highlights: string[];
};

export function planPresentation(tier: PlanTier): PlanPresentation {
  switch (tier) {
    case "pro":
      return {
        tier: "pro",
        name: "Pro",
        price: "$39/mo",
        tagline: "Your decision memory never expires.",
        highlights: [
          "Persistent decision memory (never expires)",
          "Critic red-teams every spec and bet",
          "Shareable decision links",
          "Unlimited ritual",
        ],
      };
    case "team":
      return {
        tier: "team",
        name: "Team",
        price: "Custom",
        tagline: "Shared memory and approval lanes for the whole product org.",
        highlights: [
          "Everything in Pro",
          "Shared workspace memory across members",
          "Per-role approval lanes",
          "Outcome-based pricing, in design with partners",
        ],
      };
    case "free":
    default:
      return {
        tier: "free",
        name: "Free",
        price: "$0",
        tagline: "Run the loop. Memory is kept for " + FREE_MEMORY_RETENTION_DAYS + " days.",
        highlights: [
          "The full daily loop and rituals",
          "Decision memory kept " + FREE_MEMORY_RETENTION_DAYS + " days, then it expires",
          "Shareable decision links",
        ],
      };
  }
}

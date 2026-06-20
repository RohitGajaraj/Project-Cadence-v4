/**
 * Entitlements: the pure plan-to-capability map (the Constellation tier ladder).
 *
 * No DB and no side effects, so it is unit-tested directly. The plan tier is a
 * canonical SLUG (free | pro | max | team | enterprise) that lives on the
 * account (workspaces.plan_tier is a transition-era compat shim, set only by
 * billing). This module turns a slug into the limits + capability booleans the
 * app gates on, and into the display presentation. Enforcement of each gate is
 * wired separately and incrementally (WM-M2..WM-M16); this module is the single
 * source of truth for what each tier is entitled to.
 *
 * Naming is presentation-only: the database, Stripe, and RLS key on the slugs;
 * the Constellation display names (Star / Cluster / Constellation / Galaxy /
 * Cosmos) live only in planPresentation(), so any tier can be renamed or
 * re-themed later with a one-file edit and no migration. Build against slugs.
 *
 * Credit and price NUMBERS here are deliberate placeholders, founder-tunable
 * (plan §7); the mechanism is final. The credit engine stays dormant behind
 * credits_enabled() until the founder flips it (WM-M10..WM-M16).
 */

export type PlanTier = "free" | "pro" | "max" | "team" | "enterprise";

export const PLAN_TIERS: readonly PlanTier[] = [
  "free",
  "pro",
  "max",
  "team",
  "enterprise",
] as const;

/**
 * Free decision memory is kept this many days on a rolling window, then it
 * fades; paid keeps it forever. Bumped 14 -> 30 with the account model.
 */
export const FREE_MEMORY_RETENTION_DAYS = 30;

/**
 * Placeholder monthly AI-credit grant for the free tier (the 1x base). Higher
 * tiers multiply it (Pro 5x, Max 20x). Founder-tunable (plan §7.2 / WM-M11);
 * only the meter, never the value driver (we price the decision layer).
 */
export const FREE_MONTHLY_CREDITS = 500;

/**
 * Placeholder per-cycle ceiling on purchased fair-use top-ups (paid tiers).
 * Off by default and capped so the one-subscription promise stays honest;
 * founder-tunable (plan §7.2 / WM-M13).
 */
export const TOP_UP_CAP_PER_CYCLE = 5000;

export type Entitlements = {
  // --- Memory (the core charge) ---
  /** Distilled decision memory persists (paid) or fades (free). The core charge. */
  memoryPersists: boolean;
  /** Days free memory is retained before it fades; null means it never expires. */
  memoryRetentionDays: number | null;
  /** Recall pools across all the account's workspaces (any paid tier; the flywheel). */
  crossWorkspaceMemory: boolean;

  // --- Limits (null = generous / pooled / custom) ---
  /** Workspaces allowed; free = 1, paid pooled (null). */
  workspaceLimit: number | null;
  /** Products (projects) allowed; Free 2 / Pro 3 / Max ~5, team/enterprise generous (null). */
  productLimit: number | null;

  // --- Collaboration ---
  /** Seats; solo tiers = 1, team/enterprise = many (null). */
  seats: number | null;
  /** Role-based access control (owner/admin/member/viewer). */
  rbac: boolean;
  /** Per-role approval lanes for agent actions. */
  approvalLanes: boolean;

  // --- Decision-layer capabilities ---
  /** Critic red-teams every spec and bet, not only on request (paid). */
  criticEverywhere: boolean;
  /** Shareable decision links. Live for every tier today. */
  shareLinks: boolean;
  /** Full data export. On every tier on purpose (lock-in is gravity, not a wall). */
  dataExport: boolean;

  // --- Credits (the meter; engine dormant behind credits_enabled()) ---
  /** Monthly credit multiplier vs the free base; null = custom (enterprise). */
  creditMultiplier: number | null;
  /** Included monthly credit grant; null = pooled / custom. */
  creditMonthlyBase: number | null;
  /** Capped fair-use top-ups available (paid tiers only; off by default). */
  creditTopUps: boolean;
  /** Per-cycle top-up ceiling; 0 = none (free), null = custom (enterprise). */
  topUpCapPerCycle: number | null;
  /** Negotiated, custom credit model (enterprise only). */
  enterpriseCreditModel: boolean;
  /** Priority routing / capacity. */
  priority: boolean;

  // --- Legacy aliases (kept so existing consumers do not break) ---
  /** @deprecated Prefer crossWorkspaceMemory. Shared workspace memory across members. */
  sharedWorkspaceMemory: boolean;
  /** @deprecated Prefer approvalLanes. Per-role approval lanes. */
  perRoleApprovalLanes: boolean;
};

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    value === "free" ||
    value === "pro" ||
    value === "max" ||
    value === "team" ||
    value === "enterprise"
  );
}

/** Coerce any stored or wire value to a known tier, defaulting to free (fail-safe). */
export function normalizePlanTier(value: unknown): PlanTier {
  return isPlanTier(value) ? value : "free";
}

export function entitlementsFor(tier: PlanTier): Entitlements {
  const paid = tier !== "free";
  const collab = tier === "team" || tier === "enterprise";
  const enterprise = tier === "enterprise";

  // Credit multiplier vs the free base. team is a pooled per-seat placeholder;
  // enterprise is a negotiated custom model (null). All numbers are founder-tunable.
  const creditMultiplier =
    tier === "free" ? 1 : tier === "pro" ? 5 : tier === "max" ? 20 : tier === "team" ? 20 : null;

  const productLimit = tier === "free" ? 2 : tier === "pro" ? 3 : tier === "max" ? 5 : null;

  return {
    memoryPersists: paid,
    memoryRetentionDays: paid ? null : FREE_MEMORY_RETENTION_DAYS,
    crossWorkspaceMemory: paid,

    workspaceLimit: tier === "free" ? 1 : null,
    productLimit,

    seats: collab ? null : 1,
    rbac: collab,
    approvalLanes: collab,

    criticEverywhere: paid,
    // Share links stay available on every tier (the feature is already live for
    // all users); a Pro highlight, not a paid-only gate.
    shareLinks: true,
    dataExport: true,

    creditMultiplier,
    creditMonthlyBase: creditMultiplier === null ? null : FREE_MONTHLY_CREDITS * creditMultiplier,
    creditTopUps: paid,
    topUpCapPerCycle: tier === "free" ? 0 : enterprise ? null : TOP_UP_CAP_PER_CYCLE,
    enterpriseCreditModel: enterprise,
    priority: tier === "max" || collab,

    // Legacy aliases.
    sharedWorkspaceMemory: collab,
    perRoleApprovalLanes: collab,
  };
}

export type LimitKind = "workspace" | "product";

/** The numeric limit for a tier + kind; null means generous / pooled / unlimited. */
export function limitFor(tier: PlanTier, kind: LimitKind): number | null {
  const e = entitlementsFor(tier);
  return kind === "workspace" ? e.workspaceLimit : e.productLimit;
}

export type PlanPresentation = {
  tier: PlanTier;
  /** Constellation display name (a skin over the slug; rename-able anytime). */
  name: string;
  /** Display price. team/enterprise are intentionally not fixed numbers (plan §7). */
  price: string;
  tagline: string;
  highlights: string[];
};

export function planPresentation(tier: PlanTier): PlanPresentation {
  switch (tier) {
    case "pro":
      return {
        tier: "pro",
        name: "Cluster",
        price: "$39/mo",
        tagline: "Your decision memory never fades, and it starts to compound.",
        highlights: [
          "Everything in Star, plus:",
          "Persistent decision memory that never fades",
          "5x the monthly AI credits",
          "Critic red-teams every spec and bet",
          "Memory pools across all your workspaces",
          "3 products, pooled workspaces",
          "Capped fair-use top-ups when you run hot",
          "Monthly or yearly billing (save with yearly)",
          "Unlimited shareable decision links",
          "Email support, next-business-day",
        ],
      };
    case "max":
      return {
        tier: "max",
        name: "Constellation",
        // Placeholder price, founder-gated (plan §7.1).
        price: "$99/mo",
        tagline: "More room to run, with priority and deeper memory.",
        highlights: [
          "Everything in Cluster, plus:",
          "20x the monthly AI credits, priority routing",
          "Around 5 products, pooled workspaces",
          "Higher top-up ceiling for big weeks",
          "Early access to new agents and tools",
          "Longer context windows on heavy missions",
          "Advanced Critic profiles and custom guardrails",
          "Bring-your-own model keys (BYOK)",
          "Usage analytics with cost-per-outcome view",
          "Priority email support",
        ],
      };
    case "team":
      return {
        tier: "team",
        name: "Galaxy",
        // Placeholder per-seat price, founder-gated (plan §7.1).
        price: "$25/seat/mo",
        tagline: "Shared memory and approval lanes for the whole product team.",
        highlights: [
          "Everything in Constellation, plus:",
          "Members, seats, and roles (RBAC)",
          "Cross-workspace shared memory for the whole team",
          "Per-role approval lanes for agent actions",
          "Transparent per-seat pricing",
          "Centralized billing and usage view",
          "Shared prompt and playbook library",
          "Team-wide audit trail of agent actions",
          "Slack and Teams notifications",
          "Workspace-level guardrails and budgets",
          "Onboarding session with our team",
          "Chat support with same-business-day SLA",
        ],
      };
    case "enterprise":
      return {
        tier: "enterprise",
        name: "Cosmos",
        price: "Contact sales",
        tagline: "Your whole product org, governed end to end.",
        highlights: [
          "Everything in Constellation and Galaxy, plus:",
          "SSO, SCIM, and full audit logs",
          "Data residency and a custom credit model",
          "Dedicated support with a signed SLA",
          "Security review, DPA, and procurement help",
          "Single-tenant or VPC deployment options",
          "Custom retention and legal-hold controls",
          "Private model routing and approved-model lists",
          "Custom integrations and connector development",
          "Dedicated CSM and quarterly business reviews",
          "Volume pricing on credits and seats",
          "Custom MSA, indemnification, and IP terms",
          "24/7 incident response with named contacts",
        ],
      };
    case "free":
    default:
      return {
        tier: "free",
        name: "Star",
        price: "$0",
        tagline: "Run the loop. Memory is kept for " + FREE_MEMORY_RETENTION_DAYS + " days.",
        highlights: [
          "The full daily loop and rituals",
          "Decision memory kept " + FREE_MEMORY_RETENTION_DAYS + " days, then it fades",
          "2 products, 1 workspace",
          "Shareable decision links",
          "Community support",
        ],
      };
  }
}

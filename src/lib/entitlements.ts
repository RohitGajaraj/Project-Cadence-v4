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

/**
 * The four publicly marketed tiers (pricing-strategy.md 2026-06-26 decision).
 * `max` remains a valid DB slug for backward compat but is not a public tier.
 * `team` is presented as "Business" (slug unchanged; display name is a skin).
 */
export const PUBLIC_PLAN_TIERS: readonly PlanTier[] = [
  "free",
  "pro",
  "team",
  "enterprise",
] as const;

/**
 * Credit dropdown ladder for Pro and Business (team) tiers.
 * Linear pricing — no volume discount on credit selection.
 * The annual/monthly toggle is the only discount mechanism (~17% off annual).
 * Source: pricing-strategy.md §2.
 */
export const CREDIT_DROPDOWN_TIERS = [
  100, 200, 400, 800, 1200, 2000, 3000, 4000, 5000, 7500, 10000,
] as const;
export type CreditTier = (typeof CREDIT_DROPDOWN_TIERS)[number];

/** Annual discount factor (pay for ~10 months, get 12 = ~16.7% off). */
export const ANNUAL_DISCOUNT_FACTOR = 10 / 12;

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
  /**
   * Public display name. Slug is canonical for DB/Stripe/RLS; name is a skin.
   * 4-tier model (pricing-strategy.md 2026-06-26): Free / Pro / Business / Enterprise.
   * `max` is internal-only (not a public tier); `team` slug displays as "Business".
   */
  name: string;
  /**
   * Base display price (lowest credit tier, monthly). The pricing page computes the
   * actual price reactively via priceForCredits() in billing-tier.ts as the user
   * adjusts the credit dropdown. Pro and Business show "from $X/mo".
   */
  price: string;
  tagline: string;
  forWhom: string;
  highlights: string[];
  /** Whether this tier shows the credit dropdown (Pro + Business only). */
  hasCreditDropdown: boolean;
  /** Whether this tier shows the monthly/annual billing toggle. */
  hasBillingToggle: boolean;
};

export function planPresentation(tier: PlanTier): PlanPresentation {
  switch (tier) {
    case "pro":
      return {
        tier: "pro",
        name: "Pro",
        price: "from $20/mo",
        tagline: "Persistent memory, no expiration. Pick how many credits your loop needs each month.",
        forWhom: "For solo PMs and founders who keep losing context between sprints and tool switches.",
        hasCreditDropdown: true,
        hasBillingToggle: true,
        highlights: [
          "Everything in Free, plus:",
          "Persistent decision memory that never fades",
          "100-10,000 monthly credits (your choice)",
          "Critic red-teams every spec and bet, automatically",
          "Memory recalls across all your workspaces",
          "Up to 3 products, pooled workspaces",
          "Fair-use top-ups when you need a boost",
          "Save around 17% with annual billing",
          "Shareable decision links",
          "Email support, next-business-day",
        ],
      };
    case "max":
      // Internal-only tier (not on public pricing page). Backward-compat slug.
      return {
        tier: "max",
        name: "Pro (legacy)",
        price: "from $99/mo",
        tagline: "Internal tier. Use Pro with a high credit tier instead.",
        forWhom: "Internal tier.",
        hasCreditDropdown: false,
        hasBillingToggle: false,
        highlights: ["Everything in Pro, plus:", "High credit allocation", "Priority routing"],
      };
    case "team":
      return {
        tier: "team",
        name: "Business",
        price: "from $50/mo",
        tagline: "One shared memory for the whole team. Everyone moves from the same picture, every time.",
        forWhom: "For product teams who spend meetings re-explaining what was already decided.",
        hasCreditDropdown: true,
        hasBillingToggle: true,
        highlights: [
          "Everything in Pro, plus:",
          "Shared credit pool across the whole team",
          "Members, seats, and role-based access",
          "Per-role approval lanes for agent actions",
          "Shared playbook library for the team",
          "Admin controls: per-user credit limits and spend caps",
          "Team-wide audit trail of agent actions",
          "Workspace-level guardrails and budgets",
          "Centralized billing and usage view",
          "Onboarding session with our team",
          "Chat support, same-business-day SLA",
        ],
      };
    case "enterprise":
      return {
        tier: "enterprise",
        name: "Enterprise",
        price: "Platform fee",
        tagline: "Enterprise controls, security reviews, DPA, and a dedicated CSM. Shaped to your scale.",
        forWhom: "For orgs that require SSO, audit trails, and procurement sign-off before adopting any tool.",
        hasCreditDropdown: false,
        hasBillingToggle: false,
        highlights: [
          "Everything in Business, plus:",
          "Platform fee based on company size",
          "Per-seat pricing with usage at API rates",
          "SSO, SCIM, and full audit logs",
          "Data residency and custom credit model",
          "Dedicated support with a signed SLA",
          "Security review, DPA, and procurement help",
          "Custom integrations and connector development",
          "Dedicated CSM and quarterly business reviews",
          "Volume pricing on credits and seats",
          "24/7 incident response with named contacts",
        ],
      };
    case "free":
    default:
      return {
        tier: "free",
        name: "Free",
        price: "$0",
        tagline: "The full loop, no credit card. Memory fades after 30 days. Upgrade when it starts to matter.",
        forWhom: "For anyone testing the waters or building their first product on Cadence.",
        hasCreditDropdown: false,
        hasBillingToggle: false,
        highlights: [
          "The full daily loop and rituals",
          "50 monthly credits",
          "Decision memory kept " + FREE_MEMORY_RETENTION_DAYS + " days, then it fades",
          "2 products, 1 workspace",
          "Shareable decision links",
          "Community support",
        ],
      };
  }
}

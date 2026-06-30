// CONNECTORS-V11 (v11 #14) — the pure connector CATALOG model.
//
// Connectors are scattered across three surfaces (Settings → Accounts, Settings →
// Integrations, and /sync) and re-rendered in three different shapes, with no
// grouping — so the same providers read as a repetitive, confusing list. This
// module derives ONE canonical, de-duped, CATEGORIZED catalog from the connector
// registry: the single source of truth for "what can I connect, what does it do,
// which way does data move, and how do I connect it". Any surface that renders
// connectors consumes this, so the lists stop being repetitive and inconsistent,
// and every available source is visible from day one (the OAuth wiring itself —
// F-CONN / SEN-01 — stays founder-gated; this is the presentation layer).
//
// PURE: derives from CONNECTOR_REGISTRY only; no db / network / React. The
// invariants (every user-facing provider categorized exactly once, the flow +
// connect derivations) are unit-verified.
import { CONNECTOR_REGISTRY, type ProviderId, type ProviderSpec } from "./registry";
import type { PlanTier } from "@/lib/entitlements";

export type ConnectorCategory =
  | "code"
  | "issues"
  | "docs"
  | "support"
  // SF-CONNECTORS (Signal Fabric Phase 2): the inside-out customer-voice categories.
  | "crm"
  | "revenue"
  | "feedback"
  | "chat"
  | "calendar"
  | "design";

/** How data moves for a connector, in one plain phrase. */
export type FlowLabel = "Two-way sync" | "In & out" | "Pulls in" | "Pushes out" | "Reference";

export type ConnectMethod = "oauth" | "github_app";

export type CatalogEntry = {
  id: ProviderId;
  label: string;
  description: string;
  category: ConnectorCategory;
  flow: { inflow: boolean; outflow: boolean; sync: boolean };
  flowLabel: FlowLabel;
  connectMethod: ConnectMethod;
  /** The thing you bind after connecting (Repository / Team / Database / …), or null. */
  resourceLabel: string | null;
  /**
   * The minimum plan tier needed to connect this provider.
   * - Inflow-only (no outflow): 'pro' — readable on Pro+
   * - Outflow capable: 'team' — write-back requires Business+
   * Strategy: pricing-strategy.md §3.3 (2026-06-27).
   */
  minTier: PlanTier;
};

export type CatalogCategoryGroup = {
  id: ConnectorCategory;
  label: string;
  blurb: string;
  entries: CatalogEntry[];
};

// Stable display order + human framing for each category.
const CATEGORY_META: Record<ConnectorCategory, { label: string; blurb: string }> = {
  code: { label: "Code", blurb: "Ship work as issues and detect what shipped." },
  issues: { label: "Issue tracking", blurb: "Push planned work out and pull issue state back." },
  docs: { label: "Docs & knowledge", blurb: "Read and publish documents and source material." },
  support: { label: "Support", blurb: "Pull customer conversations and tickets in as signals." },
  crm: {
    label: "CRM & win/loss",
    blurb: "Pull closed-lost deals and their reasons in as signals.",
  },
  revenue: {
    label: "Revenue & churn",
    blurb: "Pull cancellations and churn reasons in as signals.",
  },
  feedback: {
    label: "Feedback & surveys",
    blurb: "Pull feature requests, notes, and NPS/CSAT in as signals.",
  },
  chat: { label: "Team chat", blurb: "Pull messages from a feedback channel in as signals." },
  calendar: { label: "Calendar", blurb: "Two-way sync of meetings and events." },
  design: { label: "Design", blurb: "Reference design files from PRDs and briefs." },
};

const CATEGORY_ORDER: ConnectorCategory[] = [
  "code",
  "issues",
  "docs",
  "support",
  "crm",
  "revenue",
  "feedback",
  "chat",
  "calendar",
  "design",
];

// Which category each provider belongs to. Keyed explicitly (not inferred) so the
// grouping is deliberate and a new provider must be placed on purpose.
const PROVIDER_CATEGORY: Record<ProviderId, ConnectorCategory | null> = {
  github: "code",
  intercom: "support",
  // SF-CONNECTORS (Signal Fabric Phase 2): the inside-out customer-voice fleet.
  zendesk: "support",
  stripe: "revenue",
  hubspot: "crm",
  salesforce: "crm",
  canny: "feedback",
  productboard: "feedback",
  delighted: "feedback",
  slack: "chat",
  linear: "issues",
  jira: "issues",
  notion: "docs",
  google_docs: "docs",
  google_calendar: "calendar",
  microsoft_outlook: "calendar",
  figma: "design",
  firecrawl: null, // platform infra, not user-facing
};

/** PURE — the plain-language "which way does data move" phrase for a connector. */
export function flowLabelFor(caps: {
  inflow: boolean;
  outflow: boolean;
  sync: boolean;
}): FlowLabel {
  if (caps.sync) return "Two-way sync";
  if (caps.inflow && caps.outflow) return "In & out";
  if (caps.inflow) return "Pulls in";
  if (caps.outflow) return "Pushes out";
  return "Reference";
}

/** PURE — the category a provider sits in (null = not user-facing / uncategorized). */
export function categoryOf(id: ProviderId): ConnectorCategory | null {
  return PROVIDER_CATEGORY[id] ?? null;
}

function toEntry(spec: ProviderSpec): CatalogEntry {
  const category = PROVIDER_CATEGORY[spec.id];
  const connectMethod: ConnectMethod =
    spec.authMethods[0]?.kind === "github_app" ? "github_app" : "oauth";
  // Outflow-capable connectors require Business (team); read-only require Pro.
  const minTier: PlanTier = spec.capabilities.outflow ? "team" : "pro";
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    // category is guaranteed non-null for the user-facing set we build from.
    category: category as ConnectorCategory,
    flow: { ...spec.capabilities },
    flowLabel: flowLabelFor(spec.capabilities),
    connectMethod,
    resourceLabel: spec.resourceTypes[0]?.label ?? null,
    minTier,
  };
}

/**
 * PURE — the one canonical, de-duped, categorized connector catalog. Only
 * user-facing providers that have a category are included (platform infra like
 * Firecrawl is excluded). Categories come back in CATEGORY_ORDER; entries within
 * a category are sorted by label. Empty categories are dropped.
 */
export function buildConnectorCatalog(): CatalogCategoryGroup[] {
  const byCategory = new Map<ConnectorCategory, CatalogEntry[]>();
  for (const spec of Object.values(CONNECTOR_REGISTRY)) {
    if (spec.userFacing === false) continue;
    const category = PROVIDER_CATEGORY[spec.id];
    if (!category) continue;
    const list = byCategory.get(category) ?? [];
    list.push(toEntry(spec));
    byCategory.set(category, list);
  }
  const groups: CatalogCategoryGroup[] = [];
  for (const id of CATEGORY_ORDER) {
    const entries = byCategory.get(id);
    if (!entries || entries.length === 0) continue;
    entries.sort((a, b) => a.label.localeCompare(b.label));
    groups.push({ id, label: CATEGORY_META[id].label, blurb: CATEGORY_META[id].blurb, entries });
  }
  return groups;
}

/** PURE — total count of user-facing connectors in the catalog. */
export function catalogEntryCount(): number {
  return buildConnectorCatalog().reduce((n, g) => n + g.entries.length, 0);
}

// The user-facing agent vocabulary (AGENT-EXP, 2026-06-18).
//
// Three tiers the product is built around:
//   - STATIONS (6): the standing spine the user navigates (Sense -> Decide ->
//     Define -> Build -> Ship -> Learn). Phases, not personnel.
//   - The CAST: named agents that appear IN MOTION under a station (the relay).
//     Each carries its own identity (name, hue, glyph, one-liner).
//   - CREW: engine-only mechanisms (event fan-out, memory consolidation) that
//     never surface to the end user; we see them only in the Engine Room.
//
// The SPECIALIST_CATALOG below is the single source of truth and the one
// growable axis: adding a specialist is one entry and it auto-folds into a
// station + face + identity with no other code change.
//
// Hard rule (rename-disclaimer pattern): DB slugs are NEVER renamed. This module
// is a pure DISPLAY mapping. `agents.slug` stays `discovery-scout`, `builder`,
// `customer-insights`, ... in the database and every server function; only what
// the human reads on screen changes. That is why several cast agents reuse an
// existing slug (e.g. `customer-insights` is shown as "Voice", `qa` as
// "Reviewer", `release` as "Herald", `data-analyst` as "Echo").
//
// The five legacy "faces" (scout/strategist/critic/scribe/chief-of-staff) are
// retained as a coarse grouping for back-compat with existing consumers; every
// catalog entry declares the face it rolls up to.
//
// This file is client-safe (no server imports) so route components and panels
// can call it directly while rendering agent identities.

export type AgentFace = "scout" | "strategist" | "critic" | "scribe" | "chief-of-staff";
export type AgentStation = "sense" | "decide" | "define" | "build" | "ship" | "learn";
export type AgentTier = "cast" | "crew";

export interface AgentFaceMeta {
  /** The name shown to the user. */
  name: string;
  /** One-word function (the legacy v6 framing). */
  verb: string;
  /** One honest line about what this face does. */
  blurb: string;
}

/** The five legacy faces, kept for back-compat (coarse grouping). */
export const AGENT_FACES: Record<AgentFace, AgentFaceMeta> = {
  scout: { name: "Scout", verb: "senses", blurb: "Reads your sources and surfaces what changed." },
  strategist: {
    name: "Strategist",
    verb: "ranks",
    blurb: "Scores and re-ranks opportunities by impact.",
  },
  critic: { name: "Critic", verb: "challenges", blurb: "Red-teams the call before you make it." },
  scribe: {
    name: "Scribe",
    verb: "drafts",
    blurb: "Turns a decision into the artifact that follows.",
  },
  "chief-of-staff": {
    name: "Chief of Staff",
    verb: "orchestrates",
    blurb: "Runs the loop and brings you the calls that need you.",
  },
};

/** Ordered list of the five faces for legacy roster / sheet rendering. */
export const AGENT_FACE_ORDER: AgentFace[] = [
  "scout",
  "strategist",
  "critic",
  "scribe",
  "chief-of-staff",
];

export interface AgentStationMeta {
  id: AgentStation;
  /** The label shown on the loop spine. */
  name: string;
  /** Present-tense verb for the station. */
  verb: string;
  /** One outcome-framed line: what this station is for. */
  blurb: string;
}

/** The six stations, in loop order. The standing spine the user navigates. */
export const AGENT_STATIONS: Record<AgentStation, AgentStationMeta> = {
  sense: {
    id: "sense",
    name: "Sense",
    verb: "senses",
    blurb: "Reads the world and surfaces what changed.",
  },
  decide: {
    id: "decide",
    name: "Decide",
    verb: "decides",
    blurb: "Ranks the bets and challenges the call.",
  },
  define: {
    id: "define",
    name: "Define",
    verb: "defines",
    blurb: "Turns the decision into a spec and a plan.",
  },
  build: {
    id: "build",
    name: "Build",
    verb: "builds",
    blurb: "Ships the change behind your gates.",
  },
  ship: {
    id: "ship",
    name: "Ship",
    verb: "ships",
    blurb: "Takes it to the world and says what changed.",
  },
  learn: {
    id: "learn",
    name: "Learn",
    verb: "learns",
    blurb: "Reads the outcome and feeds it back.",
  },
};

export const AGENT_STATION_ORDER: AgentStation[] = [
  "sense",
  "decide",
  "define",
  "build",
  "ship",
  "learn",
];

export type SpecialistStatus = "active" | "deprecated";

export interface CatalogEntry {
  /** The DB slug. Never renamed. */
  slug: string;
  /** The friendly name shown to the user. */
  name: string;
  /** The station this agent serves. */
  station: AgentStation;
  /** The coarse legacy face this agent rolls up to. */
  face: AgentFace;
  /** cast = can appear in the relay; crew = engine-only, never user-facing. */
  tier: AgentTier;
  /** Present-tense phrase for the relay ("reading your sources"). */
  relayVerb: string;
  /** One outcome-framed line. */
  blurb: string;
  /** Per-agent hue from the agent palette (violet -> magenta -> indigo range,
   *  deliberately disjoint from the status colors: ember/green/blue/red). */
  hue: string;
  /** A lucide icon name, the agent's geometric mark. Color is never the only signal. */
  glyph: string;
  /** active = seeded + shown; deprecated = map-only, renders a name on historical runs. */
  status: SpecialistStatus;
  /** The orchestrator/conductor: routes work, never a station occupant in the relay. */
  conductor?: boolean;
}

// THE CANONICAL CATALOG. Order = roster order within a station.
// Cast (active) first, then crew, then deprecated aliases (map-only).
export const SPECIALIST_CATALOG: CatalogEntry[] = [
  // --- CAST: Sense ---
  {
    slug: "discovery-scout",
    name: "Watch",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "reading your sources",
    blurb: "Watches your connected sources and surfaces what changed.",
    hue: "oklch(0.56 0.12 320)",
    glyph: "radar",
    status: "active",
  },
  {
    slug: "researcher",
    name: "Research",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "digging into the question",
    blurb: "Digs into a question across the web and your workspace.",
    hue: "oklch(0.54 0.115 312)",
    glyph: "search",
    status: "active",
  },
  {
    slug: "customer-insights",
    name: "Listen",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "clustering customer signals",
    blurb: "Clusters what customers are saying into themes.",
    hue: "oklch(0.58 0.12 332)",
    glyph: "messages-square",
    status: "active",
  },
  // --- CAST: Decide ---
  {
    slug: "strategist",
    name: "Prioritize",
    station: "decide",
    face: "strategist",
    tier: "cast",
    relayVerb: "ranking the bets",
    blurb: "Ranks and re-scores opportunities by impact.",
    hue: "oklch(0.55 0.13 328)",
    glyph: "target",
    status: "active",
  },
  {
    slug: "critic",
    name: "Challenge",
    station: "decide",
    face: "critic",
    tier: "cast",
    relayVerb: "red-teaming the call",
    blurb: "Red-teams the decision before you commit.",
    hue: "oklch(0.53 0.13 336)",
    glyph: "shield-alert",
    status: "active",
  },
  // --- CAST: Define ---
  {
    slug: "prd-writer",
    name: "Draft",
    station: "define",
    face: "scribe",
    tier: "cast",
    relayVerb: "drafting the spec",
    blurb: "Turns the decision into a clear spec.",
    hue: "oklch(0.57 0.115 316)",
    glyph: "file-text",
    status: "active",
  },
  {
    slug: "ux-architect",
    name: "Design",
    station: "define",
    face: "scribe",
    tier: "cast",
    relayVerb: "mapping the experience",
    blurb: "Maps the experience and the flows.",
    hue: "oklch(0.585 0.12 322)",
    glyph: "pen-tool",
    status: "active",
  },
  {
    slug: "sprint-planner",
    name: "Plan",
    station: "define",
    face: "strategist",
    tier: "cast",
    relayVerb: "breaking it into work",
    blurb: "Breaks the spec into sprint-ready work.",
    hue: "oklch(0.55 0.11 308)",
    glyph: "list-checks",
    status: "active",
  },
  // --- CAST: Build ---
  {
    slug: "builder",
    name: "Engineer",
    station: "build",
    face: "scribe",
    tier: "cast",
    relayVerb: "writing the change",
    blurb: "Writes the change in your codebase.",
    hue: "oklch(0.525 0.12 314)",
    glyph: "code",
    status: "active",
  },
  {
    slug: "qa",
    name: "Review",
    station: "build",
    face: "critic",
    tier: "cast",
    relayVerb: "checking the diff",
    blurb: "Checks the diff before it ships.",
    hue: "oklch(0.55 0.135 334)",
    glyph: "check-check",
    status: "active",
  },
  // --- CAST: Ship ---
  {
    slug: "release",
    name: "Announce",
    station: "ship",
    face: "scribe",
    tier: "cast",
    relayVerb: "announcing the release",
    blurb: "Announces what shipped: notes, changelog, post.",
    hue: "oklch(0.60 0.12 338)",
    glyph: "megaphone",
    status: "active",
  },
  // --- CAST: Learn ---
  {
    slug: "data-analyst",
    name: "Measure",
    station: "learn",
    face: "strategist",
    tier: "cast",
    relayVerb: "reading the outcome",
    blurb: "Reads the outcome against the bet and feeds memory.",
    hue: "oklch(0.565 0.11 318)",
    glyph: "activity",
    status: "active",
  },
  // --- CAST: the conductor ---
  {
    slug: "orchestrator",
    name: "Chief of Staff",
    station: "decide",
    face: "chief-of-staff",
    tier: "cast",
    relayVerb: "running the loop",
    blurb: "Runs the loop and brings you the calls that need you.",
    hue: "oklch(0.55 0.12 315)",
    glyph: "compass",
    status: "active",
    conductor: true,
  },

  // --- CREW: engine-only mechanisms, never user-facing (not seeded as loop agents) ---
  {
    slug: "reactor",
    name: "Reactor",
    station: "sense",
    face: "chief-of-staff",
    tier: "crew",
    relayVerb: "routing events",
    blurb: "Wakes the right agent when something happens.",
    hue: "oklch(0.55 0.11 308)",
    glyph: "zap",
    status: "active",
  },
  {
    slug: "archivist",
    name: "Archivist",
    station: "learn",
    face: "chief-of-staff",
    tier: "crew",
    relayVerb: "consolidating memory",
    blurb: "Consolidates what was learned into durable memory.",
    hue: "oklch(0.565 0.11 318)",
    glyph: "archive",
    status: "active",
  },

  // --- DEPRECATED / aliases: map-only, render a friendly name on historical runs ---
  {
    slug: "operations",
    name: "Chief of Staff",
    station: "decide",
    face: "chief-of-staff",
    tier: "cast",
    relayVerb: "running the loop",
    blurb: "Runs the loop and brings you the calls that need you.",
    hue: "oklch(0.55 0.12 315)",
    glyph: "compass",
    status: "deprecated",
  },
  {
    slug: "copilot",
    name: "Chief of Staff",
    station: "decide",
    face: "chief-of-staff",
    tier: "cast",
    relayVerb: "running the loop",
    blurb: "Runs the loop and brings you the calls that need you.",
    hue: "oklch(0.55 0.12 315)",
    glyph: "compass",
    status: "deprecated",
  },
  {
    slug: "support",
    name: "Chief of Staff",
    station: "decide",
    face: "chief-of-staff",
    tier: "cast",
    relayVerb: "running the loop",
    blurb: "Runs the loop and brings you the calls that need you.",
    hue: "oklch(0.55 0.12 315)",
    glyph: "compass",
    status: "deprecated",
  },
  {
    slug: "growth-strategist",
    name: "Prioritize",
    station: "decide",
    face: "strategist",
    tier: "cast",
    relayVerb: "ranking the bets",
    blurb: "Ranks and re-scores opportunities by impact.",
    hue: "oklch(0.55 0.13 328)",
    glyph: "target",
    status: "deprecated",
  },
  {
    slug: "quant",
    name: "Prioritize",
    station: "decide",
    face: "strategist",
    tier: "cast",
    relayVerb: "ranking the bets",
    blurb: "Ranks and re-scores opportunities by impact.",
    hue: "oklch(0.55 0.13 328)",
    glyph: "target",
    status: "deprecated",
  },
  {
    slug: "pricer",
    name: "Prioritize",
    station: "decide",
    face: "strategist",
    tier: "cast",
    relayVerb: "ranking the bets",
    blurb: "Ranks and re-scores opportunities by impact.",
    hue: "oklch(0.55 0.13 328)",
    glyph: "target",
    status: "deprecated",
  },
  {
    slug: "discovery",
    name: "Watch",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "reading your sources",
    blurb: "Watches your connected sources and surfaces what changed.",
    hue: "oklch(0.56 0.12 320)",
    glyph: "radar",
    status: "deprecated",
  },
  {
    slug: "scout",
    name: "Watch",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "reading your sources",
    blurb: "Watches your connected sources and surfaces what changed.",
    hue: "oklch(0.56 0.12 320)",
    glyph: "radar",
    status: "deprecated",
  },
  {
    slug: "listener",
    name: "Watch",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "reading your sources",
    blurb: "Watches your connected sources and surfaces what changed.",
    hue: "oklch(0.56 0.12 320)",
    glyph: "radar",
    status: "deprecated",
  },
  {
    slug: "research",
    name: "Research",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "digging into the question",
    blurb: "Digs into a question across the web and your workspace.",
    hue: "oklch(0.54 0.115 312)",
    glyph: "search",
    status: "deprecated",
  },
  {
    slug: "competitor-watcher",
    name: "Watch",
    station: "sense",
    face: "scout",
    tier: "cast",
    relayVerb: "reading your sources",
    blurb: "Watches your connected sources and surfaces what changed.",
    hue: "oklch(0.56 0.12 320)",
    glyph: "radar",
    status: "deprecated",
  },
  {
    slug: "historian",
    name: "Measure",
    station: "learn",
    face: "strategist",
    tier: "cast",
    relayVerb: "reading the outcome",
    blurb: "Reads the outcome against the bet and feeds memory.",
    hue: "oklch(0.565 0.11 318)",
    glyph: "activity",
    status: "deprecated",
  },
  {
    slug: "planner",
    name: "Plan",
    station: "define",
    face: "strategist",
    tier: "cast",
    relayVerb: "breaking it into work",
    blurb: "Breaks the spec into sprint-ready work.",
    hue: "oklch(0.55 0.11 308)",
    glyph: "list-checks",
    status: "deprecated",
  },
  {
    slug: "designer",
    name: "Design",
    station: "define",
    face: "scribe",
    tier: "cast",
    relayVerb: "mapping the experience",
    blurb: "Maps the experience and the flows.",
    hue: "oklch(0.585 0.12 322)",
    glyph: "pen-tool",
    status: "deprecated",
  },
  {
    slug: "scribe",
    name: "Draft",
    station: "define",
    face: "scribe",
    tier: "cast",
    relayVerb: "drafting the spec",
    blurb: "Turns the decision into a clear spec.",
    hue: "oklch(0.57 0.115 316)",
    glyph: "file-text",
    status: "deprecated",
  },
  {
    slug: "engineer",
    name: "Engineer",
    station: "build",
    face: "scribe",
    tier: "cast",
    relayVerb: "writing the change",
    blurb: "Writes the change in your codebase.",
    hue: "oklch(0.525 0.12 314)",
    glyph: "code",
    status: "deprecated",
  },
  {
    slug: "studio",
    name: "Engineer",
    station: "build",
    face: "scribe",
    tier: "cast",
    relayVerb: "writing the change",
    blurb: "Writes the change in your codebase.",
    hue: "oklch(0.525 0.12 314)",
    glyph: "code",
    status: "deprecated",
  },
  {
    slug: "inspector",
    name: "Review",
    station: "build",
    face: "critic",
    tier: "cast",
    relayVerb: "checking the diff",
    blurb: "Checks the diff before it ships.",
    hue: "oklch(0.55 0.135 334)",
    glyph: "check-check",
    status: "deprecated",
  },
  {
    slug: "releaser",
    name: "Announce",
    station: "ship",
    face: "scribe",
    tier: "cast",
    relayVerb: "announcing the release",
    blurb: "Announces what shipped: notes, changelog, post.",
    hue: "oklch(0.60 0.12 338)",
    glyph: "megaphone",
    status: "deprecated",
  },
  {
    slug: "marketer",
    name: "Announce",
    station: "ship",
    face: "scribe",
    tier: "cast",
    relayVerb: "announcing the release",
    blurb: "Announces what shipped: notes, changelog, post.",
    hue: "oklch(0.60 0.12 338)",
    glyph: "megaphone",
    status: "deprecated",
  },
  {
    slug: "stakeholder",
    name: "Announce",
    station: "ship",
    face: "scribe",
    tier: "cast",
    relayVerb: "announcing the release",
    blurb: "Announces what shipped: notes, changelog, post.",
    hue: "oklch(0.60 0.12 338)",
    glyph: "megaphone",
    status: "deprecated",
  },
];

// Lower-cased slug -> entry. Built once from the catalog.
const SLUG_TO_ENTRY: Record<string, CatalogEntry> = Object.fromEntries(
  SPECIALIST_CATALOG.map((e) => [e.slug.toLowerCase(), e]),
);

/** The catalog entry for a slug, or null. */
export function catalogEntry(slug: string | null | undefined): CatalogEntry | null {
  if (!slug) return null;
  return SLUG_TO_ENTRY[slug.toLowerCase()] ?? null;
}

/** The legacy face a slug rolls up to, or null when unknown. */
export function agentFace(slug: string | null | undefined): AgentFace | null {
  return catalogEntry(slug)?.face ?? null;
}

/** The station a slug serves, or null when unknown. */
export function agentStation(slug: string | null | undefined): AgentStation | null {
  return catalogEntry(slug)?.station ?? null;
}

/** Total station resolver: never null for a non-empty slug. Unknown work defaults to BUILD (execute). */
export function resolveStationTotal(slug: string | null | undefined): AgentStation {
  return agentStation(slug) ?? "build";
}

/** cast | crew for a slug; defaults to cast for unknown slugs (they would surface in a relay). */
export function agentTier(slug: string | null | undefined): AgentTier {
  return catalogEntry(slug)?.tier ?? "cast";
}

/** True when the slug is the orchestrator/conductor (never a station occupant). */
export function isConductor(slug: string | null | undefined): boolean {
  return catalogEntry(slug)?.conductor === true;
}

/**
 * The name to SHOW for a slug. Catalog name first (per-agent identity), then the
 * DB-provided fallback name, then a title-cased slug, so a raw slug never leaks.
 */
export function agentDisplayName(
  slug: string | null | undefined,
  fallbackName?: string | null,
): string {
  const entry = catalogEntry(slug);
  if (entry) return entry.name;
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  if (slug && slug.trim()) return titleCase(slug);
  return "Agent";
}

/** The one-line blurb for a slug (per-agent), falling back to the face blurb, else null. */
export function agentBlurb(slug: string | null | undefined): string | null {
  const entry = catalogEntry(slug);
  if (entry) return entry.blurb;
  const face = agentFace(slug);
  return face ? AGENT_FACES[face].blurb : null;
}

/** The legacy short verb ("senses" / "ranks" / ...) for a slug's face, or null. Back-compat. */
export function agentVerb(slug: string | null | undefined): string | null {
  const face = agentFace(slug);
  return face ? AGENT_FACES[face].verb : null;
}

/** The present-tense relay phrase ("reading your sources") for a slug, or null. */
export function agentRelayVerb(slug: string | null | undefined): string | null {
  return catalogEntry(slug)?.relayVerb ?? null;
}

export interface AgentMark {
  /** Hue from the agent palette (safe: never a status color). */
  hue: string;
  /** lucide icon name. */
  glyph: string;
}

/** The visual identity (hue + glyph) for a slug. Falls back to the orchid anchor + a generic mark. */
export function agentMark(slug: string | null | undefined): AgentMark {
  const entry = catalogEntry(slug);
  if (entry) return { hue: entry.hue, glyph: entry.glyph };
  return { hue: "oklch(0.55 0.12 315)", glyph: "bot" };
}

/** Active cast entries (the user-facing roster), excluding crew + deprecated. */
export function castEntries(): CatalogEntry[] {
  return SPECIALIST_CATALOG.filter((e) => e.tier === "cast" && e.status === "active");
}

/** Active crew entries (engine-only). */
export function crewEntries(): CatalogEntry[] {
  return SPECIALIST_CATALOG.filter((e) => e.tier === "crew" && e.status === "active");
}

/** The active cast at a station, in catalog order, excluding the conductor. */
export function castByStation(station: AgentStation): CatalogEntry[] {
  return castEntries().filter((e) => e.station === station && !e.conductor);
}

/** The conductor (Chief of Staff) entry, or null. */
export function conductorEntry(): CatalogEntry | null {
  return SPECIALIST_CATALOG.find((e) => e.conductor && e.status === "active") ?? null;
}

function titleCase(slug: string): string {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// v6 Phase 0 / W2 — the user-facing agent vocabulary.
//
// Users meet FIVE agents through their output: Scout · Strategist · Critic ·
// Scribe · Chief of Staff (v6 doc §5). The engine runs a larger mesh of
// specialist slugs (the 19-agent expansion map); we fold those internal slugs
// into the five faces at the DISPLAY LAYER ONLY.
//
// Hard rule (rename-disclaimer pattern): DB slugs are NEVER renamed. This
// module is a pure display mapping — `agents.slug` stays `orchestrator`,
// `discovery`, `builder`, … in the database and every server function. Only
// what the human reads on screen changes.
//
// This file is client-safe (no server imports) so route components and panels
// can call it directly while rendering agent identities.

export type AgentFace = "scout" | "strategist" | "critic" | "scribe" | "chief-of-staff";

export interface AgentFaceMeta {
  /** The name shown to the user. */
  name: string;
  /** One-word function (matches the v6 §5 framing). */
  verb: string;
  /** One honest line about what this face does — no overclaiming. */
  blurb: string;
}

/** The five faces, in loop order (sense → rank → challenge → draft → orchestrate). */
export const AGENT_FACES: Record<AgentFace, AgentFaceMeta> = {
  scout: {
    name: "Scout",
    verb: "senses",
    blurb: "Reads your sources and surfaces what changed.",
  },
  strategist: {
    name: "Strategist",
    verb: "ranks",
    blurb: "Scores and re-ranks opportunities by impact.",
  },
  critic: {
    name: "Critic",
    verb: "challenges",
    blurb: "Red-teams the call before you make it.",
  },
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

/** Ordered list of the five faces for roster / sheet rendering. */
export const AGENT_FACE_ORDER: AgentFace[] = [
  "scout",
  "strategist",
  "critic",
  "scribe",
  "chief-of-staff",
];

// Internal engine slug → the user-facing face it is met through. Lower-cased
// keys; lookups normalize. Every durable + mesh slug we know about maps here;
// unknown slugs are handled gracefully by the helpers below.
const SLUG_TO_FACE: Record<string, AgentFace> = {
  // Chief of Staff — orchestration / events / ops
  orchestrator: "chief-of-staff",
  reactor: "chief-of-staff",
  support: "chief-of-staff",
  // Scout — sensing / gathering / recall
  discovery: "scout",
  scout: "scout",
  listener: "scout",
  researcher: "scout",
  research: "scout",
  historian: "scout",
  // Strategist — ranking / analysis / planning / pricing
  strategist: "strategist",
  quant: "strategist",
  planner: "strategist",
  pricer: "strategist",
  // Critic — challenge / review / verification
  critic: "critic",
  inspector: "critic",
  qa: "critic",
  // Scribe — drafting / producing the artifacts that follow a decision
  scribe: "scribe",
  "prd-writer": "scribe",
  "ux-architect": "scribe",
  designer: "scribe",
  builder: "scribe",
  studio: "scribe",
  engineer: "scribe",
  release: "scribe",
  releaser: "scribe",
  marketer: "scribe",
};

/** The face an internal slug is met through, or null if unmapped. */
export function agentFace(slug: string | null | undefined): AgentFace | null {
  if (!slug) return null;
  return SLUG_TO_FACE[slug.toLowerCase()] ?? null;
}

/**
 * The name to SHOW for an internal agent slug. Maps to one of the five faces
 * when known; otherwise falls back to the DB-provided name, then a title-cased
 * slug — so a raw mesh slug never leaks to the UI.
 */
export function agentDisplayName(
  slug: string | null | undefined,
  fallbackName?: string | null,
): string {
  const face = agentFace(slug);
  if (face) return AGENT_FACES[face].name;
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  if (slug && slug.trim()) return titleCase(slug);
  return "Agent";
}

/** The one-line blurb for a slug's face, or null when the slug is unmapped. */
export function agentBlurb(slug: string | null | undefined): string | null {
  const face = agentFace(slug);
  return face ? AGENT_FACES[face].blurb : null;
}

/** The function verb ("senses" / "ranks" / …) for a slug's face, or null. */
export function agentVerb(slug: string | null | undefined): string | null {
  const face = agentFace(slug);
  return face ? AGENT_FACES[face].verb : null;
}

function titleCase(slug: string): string {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

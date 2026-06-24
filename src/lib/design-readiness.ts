// DEF-04 (v11 #27) — design readiness from a spec (the deterministic slice).
//
// DEF-04's headline is "spec -> mockup -> sandbox preview", but the mockup + live
// preview need the AI chokepoint / the gated SANDBOX provider. THIS is the part a
// spec answers on its own: is it READY to design? A designer (or a generator) needs
// the spec to name the things that make a screen real — its states, edge cases,
// accessibility, responsive behaviour, copy, permissions, data, and flows. This pure
// module checks the spec text for each and returns a readiness score + the specific
// gaps, so a PRD becomes design-ready (or its holes are named) before any build.
//
// Pure + deterministic on purpose: no AI, no key, no DB — unit-tested over plain
// strings, runs client-side on the already-loaded PRD body. The generative mockup +
// sandbox preview are the named gated remainder.

export type ReadinessCheck = {
  key: string;
  /** what a design-ready spec should specify. */
  label: string;
  /** detected in the spec text. */
  present: boolean;
  /** what to add when missing. */
  hint: string;
};

export type ReadinessLevel = "early" | "developing" | "ready";

export type DesignReadiness = {
  /** the spec is effectively empty (nothing to assess). */
  empty: boolean;
  /** count of satisfied checks. */
  score: number;
  total: number;
  /** 0-100. */
  pct: number;
  level: ReadinessLevel;
  checks: ReadinessCheck[];
};

type Dimension = { key: string; label: string; hint: string; terms: string[] };

// The eight things a spec must say before a surface can be designed. Terms are
// intentionally generous: presence of the TOPIC (any term) counts as "addressed".
const DIMENSIONS: Dimension[] = [
  {
    key: "states",
    label: "Screen states (empty, loading, error, success)",
    hint: "Name what each surface shows when empty, loading, on error, and on success.",
    terms: ["empty state", "zero state", "loading", "skeleton", "spinner", "error state", "success state", "no results", "placeholder"],
  },
  {
    key: "edgeCases",
    label: "Edge cases, limits & validation",
    hint: "Call out edge cases, boundaries/limits, and the validation rules.",
    terms: ["edge case", "boundary", "limit", "maximum", "minimum", "overflow", "truncat", "validation", "invalid", "constraint", "rate limit"],
  },
  {
    key: "accessibility",
    label: "Accessibility (keyboard, screen reader, contrast)",
    hint: "Add accessibility requirements: keyboard, screen-reader/ARIA, contrast, focus order.",
    terms: ["accessib", "a11y", "wcag", "keyboard", "screen reader", "aria", "contrast", "focus order", "alt text", "tab order"],
  },
  {
    key: "responsive",
    label: "Responsive behaviour (mobile, tablet, desktop)",
    hint: "Specify how it adapts across mobile, tablet, and desktop.",
    terms: ["responsive", "mobile", "breakpoint", "small screen", "tablet", "viewport", "desktop", "narrow screen"],
  },
  {
    key: "content",
    label: "Copy & microcopy (labels, messages, CTA wording)",
    hint: "Define the copy: labels, messages, empty-state text, and CTA wording.",
    terms: ["copy", "microcopy", "label", "wording", "message", "tone of voice", "cta", "headline", "placeholder text"],
  },
  {
    key: "permissions",
    label: "Permissions & roles (who can see/do this)",
    hint: "State who can see and do this — the roles and permissions.",
    terms: ["permission", "role", "who can", "rbac", "authoriz", "owner", "admin", "member", "viewer", "access control"],
  },
  {
    key: "data",
    label: "Data shape (fields, sorting/filtering, volume)",
    hint: "Describe the data: the fields shown, sorting/filtering, pagination, and volume.",
    terms: ["pagination", "sort", "filter", "field", "column", "schema", "data shape", "how many", "records", "volume"],
  },
  {
    key: "flows",
    label: "User flow (steps, navigation, interactions)",
    hint: "Map the flow: the steps, navigation, and key interactions.",
    terms: ["flow", "step", "journey", "navigat", "interaction", "click", "tap", "wizard", "next screen", "transition"],
  },
];

/** Strip markdown noise so term matching reads the prose, not the syntax. */
function normalize(body: string): string {
  return (body ?? "")
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/[#>*_`|~-]+/g, " ") // markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function levelFor(pct: number): ReadinessLevel {
  if (pct < 35) return "early";
  if (pct < 70) return "developing";
  return "ready";
}

/**
 * Assess how design-ready a spec is. Deterministic: each dimension is "present" when
 * the spec mentions its topic. Returns the per-dimension checks, a score, and a level.
 * An effectively-empty spec returns `empty: true` with everything unmet.
 */
export function analyzeDesignReadiness(body: string): DesignReadiness {
  const text = normalize(body);
  const empty = text.length < 40;

  const checks: ReadinessCheck[] = DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    hint: d.hint,
    present: !empty && d.terms.some((t) => text.includes(t)),
  }));

  const total = DIMENSIONS.length;
  const score = checks.filter((c) => c.present).length;
  const pct = Math.round((score / total) * 100);

  return { empty, score, total, pct, level: levelFor(pct), checks };
}

/** The gaps a PM should close before handing the spec to design — missing checks. */
export function readinessGaps(r: DesignReadiness): ReadinessCheck[] {
  return r.checks.filter((c) => !c.present);
}

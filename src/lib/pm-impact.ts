/**
 * PM-IMPACT-LEDGER (v11 #18) — PURE engine for a PM's portable decision+outcome record.
 *
 * v11's strongest un-named opportunity (pains research): PMs are "seen as ticket-writers and
 * can't prove their impact." Cadence already holds the raw proof — the decisions a PM made,
 * the outcomes those decisions drove, and which beliefs were later revised — but it was only
 * ever shown as in-product surfaces, never as a PORTABLE artifact the PM can carry to a
 * performance review or their next role. This module turns the existing decision/outcome
 * data into that artifact: a track record (the calls + the results) plus a clean,
 * copy-anywhere summary.
 *
 * It composes EXISTING data only (`decisions`, `learnings`, and a precomputed superseded set
 * from the bitemporal lineage the Trust Ledger already derives). PURE: no db, no network, no
 * AI; the math + the rendered artifact are unit-verifiable. The server adapter does the I/O
 * and passes primitives in, so this file never imports a server module. NO migration, NO
 * chokepoint.
 */

/** Verdict vocabulary, shared with the Brain so "a recorded outcome" means the same thing. */
const POSITIVE = new Set(["validated", "confirmed", "win"]);
const NEGATIVE = new Set(["missed", "invalidated", "refuted", "loss"]);
const NEUTRAL = new Set(["mixed", "inconclusive", "partial"]);

export type ImpactDecisionRow = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  /** null/blank = a human (the PM) made the call; set = an agent decided it. */
  decided_by_agent_slug?: string | null;
};

export type ImpactLearningRow = {
  verdict?: string | null;
  prior_ice?: number | null;
  new_ice?: number | null;
  metric_label?: string | null;
  metric_value?: string | null;
  summary?: string | null;
  created_at?: string | null;
};

export type ImpactOutcomes = {
  total: number;
  validated: number;
  missed: number;
  mixed: number;
  other: number;
  /** validated / (validated + missed); null when there is no decisive outcome yet. */
  hitRate: number | null;
};

export type ImpactSpan = {
  firstAt: string | null;
  lastAt: string | null;
  /** Distinct calendar months that carry a decision (activity breadth, not raw duration). */
  activeMonths: number;
};

export type ImpactHighlight = {
  summary: string;
  metricLabel: string | null;
  metricValue: string | null;
  iceShift: number | null;
};

export type ImpactLedger = {
  decisionsTotal: number;
  /** Decisions the PM made directly (no deciding agent). */
  humanLed: number;
  /** Decisions an agent made (still part of the PM's portfolio of governed work). */
  agentLed: number;
  decisionsByStatus: Record<string, number>;
  /** Decisions a later decision superseded — evidence of learning, not failure. */
  beliefsRevised: number;
  outcomes: ImpactOutcomes;
  /** Net ICE movement the PM's recorded outcomes drove (impact signal). */
  iceShiftTotal: number;
  iceShiftAvg: number | null;
  measuredOutcomes: number;
  span: ImpactSpan;
  /** A few standout validated wins (largest positive ICE shift first), for the artifact. */
  highlights: ImpactHighlight[];
  /** One honest plain-language headline; degrades gracefully on sparse data. */
  headline: string;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function monthKey(iso: string | null | undefined): string | null {
  if (typeof iso !== "string" || iso.length < 7) return null;
  const k = iso.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(k) ? k : null;
}

function iceShift(l: ImpactLearningRow): number | null {
  return typeof l.new_ice === "number" && typeof l.prior_ice === "number"
    ? round1(l.new_ice - l.prior_ice)
    : null;
}

export type ImpactLedgerInput = {
  decisions?: readonly ImpactDecisionRow[];
  learnings?: readonly ImpactLearningRow[];
  /** Decision ids a current `supersedes` edge retired (from the Trust Ledger's lineage). */
  supersededDecisionIds?: ReadonlySet<string>;
  /** Cap on highlights returned. */
  maxHighlights?: number;
};

/**
 * PURE. Aggregate a PM's decisions + recorded outcomes into a portable track record.
 * Empty input yields an all-zero ledger with an honest "no record yet" headline — never
 * throws, never fabricates.
 */
export function computeImpactLedger(input: ImpactLedgerInput): ImpactLedger {
  const decisions = Array.isArray(input.decisions) ? input.decisions : [];
  const learnings = Array.isArray(input.learnings) ? input.learnings : [];
  const superseded = input.supersededDecisionIds ?? new Set<string>();
  const maxHighlights = Math.max(1, input.maxHighlights ?? 3);

  let humanLed = 0;
  let agentLed = 0;
  let beliefsRevised = 0;
  const byStatus: Record<string, number> = {};
  const months = new Set<string>();
  let firstAt: string | null = null;
  let lastAt: string | null = null;

  for (const d of decisions) {
    if (!d || typeof d.id !== "string") continue;
    const agent = typeof d.decided_by_agent_slug === "string" && d.decided_by_agent_slug.trim();
    if (agent) agentLed += 1;
    else humanLed += 1;
    const status = typeof d.status === "string" && d.status.trim() ? d.status.trim() : "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (superseded.has(d.id)) beliefsRevised += 1;
    const mk = monthKey(d.created_at);
    if (mk) months.add(mk);
    if (typeof d.created_at === "string" && d.created_at) {
      if (!firstAt || d.created_at < firstAt) firstAt = d.created_at;
      if (!lastAt || d.created_at > lastAt) lastAt = d.created_at;
    }
  }

  let validated = 0;
  let missed = 0;
  let mixed = 0;
  let other = 0;
  let iceShiftTotal = 0;
  let measuredOutcomes = 0;
  const wins: ImpactHighlight[] = [];

  for (const l of learnings) {
    const v = typeof l?.verdict === "string" ? l.verdict.trim().toLowerCase() : "";
    if (POSITIVE.has(v)) validated += 1;
    else if (NEGATIVE.has(v)) missed += 1;
    else if (NEUTRAL.has(v)) mixed += 1;
    else other += 1;
    const shift = iceShift(l);
    if (shift !== null) {
      iceShiftTotal += shift;
      measuredOutcomes += 1;
    }
    if (POSITIVE.has(v)) {
      wins.push({
        summary: (l.summary ?? "").trim(),
        metricLabel: l.metric_label ?? null,
        metricValue: l.metric_value ?? null,
        iceShift: shift,
      });
    }
  }
  iceShiftTotal = round1(iceShiftTotal);

  const decisive = validated + missed;
  const outcomes: ImpactOutcomes = {
    total: learnings.length,
    validated,
    missed,
    mixed,
    other,
    hitRate: decisive > 0 ? Math.round((validated / decisive) * 100) / 100 : null,
  };

  // Largest positive ICE shift first; ties keep input order (newest-first from the loader).
  wins.sort((a, b) => (b.iceShift ?? -Infinity) - (a.iceShift ?? -Infinity));
  const highlights = wins.filter((w) => w.summary).slice(0, maxHighlights);

  const span: ImpactSpan = { firstAt, lastAt, activeMonths: months.size };

  const headline = buildHeadline({
    decisionsTotal: decisions.length,
    outcomes,
    beliefsRevised,
    iceShiftTotal,
  });

  return {
    decisionsTotal: decisions.length,
    humanLed,
    agentLed,
    decisionsByStatus: byStatus,
    beliefsRevised,
    outcomes,
    iceShiftTotal,
    iceShiftAvg: measuredOutcomes > 0 ? round1(iceShiftTotal / measuredOutcomes) : null,
    measuredOutcomes,
    span,
    highlights,
    headline,
  };
}

function buildHeadline(x: {
  decisionsTotal: number;
  outcomes: ImpactOutcomes;
  beliefsRevised: number;
  iceShiftTotal: number;
}): string {
  if (x.decisionsTotal === 0) {
    return "No decisions on record yet — your track record fills in as you make and resolve calls.";
  }
  const parts: string[] = [`${x.decisionsTotal} decisions on record`];
  if (x.outcomes.hitRate !== null) {
    parts.push(
      `${Math.round(x.outcomes.hitRate * 100)}% validated where the outcome was decisive (${x.outcomes.validated}/${x.outcomes.validated + x.outcomes.missed})`,
    );
  } else if (x.outcomes.total > 0) {
    parts.push(`${x.outcomes.total} outcomes recorded, none decisive yet`);
  }
  if (x.beliefsRevised > 0) {
    parts.push(`${x.beliefsRevised} belief${x.beliefsRevised === 1 ? "" : "s"} revised on evidence`);
  }
  return parts.join(" · ") + ".";
}

/** Human-month label, e.g. "Jun 2026", from a YYYY-MM-DD(...) stamp. */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function humanMonth(iso: string | null): string {
  const k = monthKey(iso);
  if (!k) return "—";
  const [y, m] = k.split("-");
  const idx = Number(m) - 1;
  return `${MONTHS[idx] ?? m} ${y}`;
}

export type RenderImpactOptions = {
  /** The PM's name for the artifact header; falls back to a neutral title. */
  name?: string | null;
  workspace?: string | null;
  /** As-of date stamp (YYYY-MM-DD); the caller passes it so this stays pure/deterministic. */
  asOf?: string | null;
};

/**
 * PURE. Render the ledger as a portable, copy-anywhere Markdown record in Cadence's voice
 * (signal-first, honest on sparse data, zero AI fingerprints). This is the artifact a PM
 * takes OUT of the product — to a review, a brag doc, or their next role.
 */
export function renderImpactMarkdown(ledger: ImpactLedger, opts: RenderImpactOptions = {}): string {
  const who = opts.name?.trim() ? opts.name.trim() : "Product decision record";
  const lines: string[] = [];
  lines.push(`# ${who}`);
  if (opts.workspace?.trim()) lines.push(`_${opts.workspace.trim()}_`);
  if (opts.asOf?.trim()) lines.push(`As of ${opts.asOf.trim()}`);
  lines.push("");
  lines.push(ledger.headline);
  lines.push("");

  lines.push("## The record");
  lines.push(`- Decisions made: ${ledger.decisionsTotal} (${ledger.humanLed} yours, ${ledger.agentLed} agent-led under your governance)`);
  if (ledger.span.firstAt) {
    lines.push(`- Span: ${humanMonth(ledger.span.firstAt)} to ${humanMonth(ledger.span.lastAt)}, active across ${ledger.span.activeMonths} month${ledger.span.activeMonths === 1 ? "" : "s"}`);
  }
  if (ledger.beliefsRevised > 0) {
    lines.push(`- Beliefs revised on evidence: ${ledger.beliefsRevised} (you changed your mind when the data did)`);
  }
  lines.push("");

  lines.push("## Outcomes");
  if (ledger.outcomes.total === 0) {
    lines.push("- No outcomes recorded yet.");
  } else {
    if (ledger.outcomes.hitRate !== null) {
      lines.push(`- Hit rate: ${Math.round(ledger.outcomes.hitRate * 100)}% (${ledger.outcomes.validated} validated, ${ledger.outcomes.missed} missed)`);
    }
    if (ledger.outcomes.mixed > 0) lines.push(`- Mixed / partial: ${ledger.outcomes.mixed}`);
    if (ledger.measuredOutcomes > 0) {
      const sign = ledger.iceShiftTotal >= 0 ? "+" : "";
      lines.push(`- Priority impact: ${sign}${ledger.iceShiftTotal} net ICE across ${ledger.measuredOutcomes} measured outcome${ledger.measuredOutcomes === 1 ? "" : "s"}`);
    }
  }
  lines.push("");

  if (ledger.highlights.length > 0) {
    lines.push("## Standout calls");
    for (const h of ledger.highlights) {
      const metric = h.metricLabel && h.metricValue ? ` (${h.metricLabel}: ${h.metricValue})` : "";
      lines.push(`- ${h.summary}${metric}`);
    }
    lines.push("");
  }

  lines.push("_Generated by Cadence from your decision and outcome history._");
  return lines.join("\n");
}

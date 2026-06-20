/**
 * MOAT-VIS — make the compounding visible (PURE core).
 *
 * The outcome loop already moves an opportunity's ICE when a human records a
 * shipped PRD's real-world outcome (recordOutcome -> a `learnings` row carrying
 * prior_ice/new_ice + the verdict that caused it). This module turns that audit
 * trail into the visible "memory is correcting your priorities from real
 * outcomes" story for the Today + Brain surfaces.
 *
 * Pure (no db/network/AI), so it is fully unit-testable. The server fn
 * (getCompounding in today.functions.ts) supplies the learning rows.
 *
 * Honest framing: a rescore can move ICE DOWN (a missed outcome lowers
 * confidence). That is the loop working, not a regression, so the summary is
 * neutral (count + up/down + net), never a one-directional "always up" claim.
 */

/** The subset of a flattened `listLearnings` row this module needs. */
export type CompoundingLearning = {
  id: string;
  verdict: "validated" | "missed" | "mixed";
  summary: string;
  opportunity_title: string | null;
  /** PostgREST returns `numeric` as a string; we coerce. */
  prior_ice: number | string | null;
  new_ice: number | string | null;
  created_at: string;
};

/** A learning whose ICE actually moved, with the numeric delta resolved. */
export type Rescore = CompoundingLearning & {
  priorIce: number;
  newIce: number;
  /** newIce - priorIce; positive = the outcome raised the priority. */
  delta: number;
};

export type CompoundingSummary = {
  rescoreCount: number;
  movedUp: number;
  movedDown: number;
  /** Sum of every rescore's delta, rounded to 1 decimal. Can be negative. */
  netIceLift: number;
  validatedCount: number;
  missedCount: number;
  mixedCount: number;
  /** The most recent rescore by created_at, or null when there are none. */
  latest: Rescore | null;
};

/** PURE. Coerce a `numeric` column (number | string | null) to a finite number or null. */
export function iceNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * PURE. Round to one decimal — the precision both surfaces display with `.toFixed(1)`.
 * The "did the score move" test rounds first (mirrors round1 in memory-compounding.ts /
 * outcome-memory.ts), so a sub-0.1 drift like 8.34 -> 8.31 never renders a misleading
 * "8.3 -> 8.3" no-move. Kept local (not imported) so this module stays dependency-free
 * and does not couple to another lane's file.
 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * PURE. Keep only learnings whose ICE actually moved at display precision (both
 * endpoints present and rounded-different), resolving the rounded endpoints + delta so
 * the shown numbers, the delta, and the up/down glyph are always consistent. A learning
 * with no opportunity (no ICE) or a sub-0.1 drift is not a rescore and is dropped.
 */
export function rescoresOf(learnings: CompoundingLearning[]): Rescore[] {
  const out: Rescore[] = [];
  for (const l of learnings) {
    const priorRaw = iceNum(l.prior_ice);
    const newRaw = iceNum(l.new_ice);
    if (priorRaw == null || newRaw == null) continue;
    const priorIce = round1(priorRaw);
    const newIce = round1(newRaw);
    if (priorIce === newIce) continue; // sub-0.1 jitter is not a move
    out.push({ ...l, priorIce, newIce, delta: round1(newIce - priorIce) });
  }
  return out;
}

/**
 * PURE. Summarize the compounding across a set of learnings: how many decisions
 * memory re-scored from real outcomes, how many moved up vs down, the net ICE
 * movement, the verdict mix, and the most recent rescore. Order-independent
 * (latest is resolved by created_at, not input order).
 */
export function summarizeCompounding(learnings: CompoundingLearning[]): CompoundingSummary {
  const rescores = rescoresOf(learnings);
  let movedUp = 0;
  let movedDown = 0;
  let net = 0;
  let validatedCount = 0;
  let missedCount = 0;
  let mixedCount = 0;
  let latest: Rescore | null = null;
  for (const r of rescores) {
    if (r.delta > 0) movedUp++;
    else if (r.delta < 0) movedDown++;
    net += r.delta;
    if (r.verdict === "validated") validatedCount++;
    else if (r.verdict === "missed") missedCount++;
    else mixedCount++;
    if (!latest || r.created_at > latest.created_at) latest = r;
  }
  return {
    rescoreCount: rescores.length,
    movedUp,
    movedDown,
    netIceLift: round1(net),
    validatedCount,
    missedCount,
    mixedCount,
    latest,
  };
}

/**
 * PURE. One honest, neutral sentence describing the compounding, or null when no
 * decision has been re-scored yet (so the caller can stay silent). No hype: it
 * states the count + the net direction as a fact.
 */
export function describeCompounding(s: CompoundingSummary): string | null {
  if (s.rescoreCount === 0) return null;
  const decisions = `${s.rescoreCount} decision${s.rescoreCount === 1 ? "" : "s"}`;
  const dir =
    s.netIceLift > 0
      ? `net ICE +${s.netIceLift.toFixed(1)}`
      : s.netIceLift < 0
        ? `net ICE ${s.netIceLift.toFixed(1)}`
        : "net ICE unchanged";
  return `Memory has re-scored ${decisions} from real outcomes · ${dir}.`;
}

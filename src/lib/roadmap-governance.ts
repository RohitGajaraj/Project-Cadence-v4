/**
 * H2-WRITES · Outcome-roadmap governance (pure, no IO).
 *
 * The H2 thesis is outcome CURATION, not a task kanban: a commitment to a
 * Now/Next/Later bucket is a promise about an OUTCOME and how it will be MEASURED.
 * The lenient board lets you drag an item into a bucket first and fill the outcome
 * after, which is good UX but leaves "ungoverned" commitments (in a bucket, no
 * declared outcome) - the anti-feature-factory failure mode. This module is the
 * single source of that governance rule + the gap detector, kept pure so it is
 * unit-tested with no DB and importable by both the server fns and the board.
 */

export type RoadmapBucket = "now" | "next" | "later";

/** The maximum length the roadmap write accepts for a declared outcome/measure. */
export const ROADMAP_TEXT_MAX = 500;

/** The minimal shape the governance rules read; satisfied by RoadmapItem. */
export type Committable = {
  bucket: RoadmapBucket | null;
  outcome: string | null;
  measure: string | null;
};

const nonEmpty = (s: string | null | undefined): boolean => !!s && s.trim().length > 0;

/**
 * Is a commitment fully governed? A backlog item (bucket null) needs nothing; a
 * Now/Next/Later commitment MUST carry both a non-empty outcome and a non-empty
 * measure. This is the one rule both the write path and the gap surface use.
 */
export function isCommitmentGoverned(c: Committable): boolean {
  if (c.bucket == null) return true;
  return nonEmpty(c.outcome) && nonEmpty(c.measure);
}

export type CommitmentValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validate a governed commit. Returns a typed reason (not a throw) so the caller
 * decides how to surface it. A bucket commitment without a declared outcome AND
 * measure is rejected; backlog (null bucket) is always allowed.
 */
export function validateCommitment(c: Committable): CommitmentValidation {
  if (c.bucket == null) return { ok: true };
  const hasOutcome = nonEmpty(c.outcome);
  const hasMeasure = nonEmpty(c.measure);
  if (hasOutcome && hasMeasure) return { ok: true };
  if (!hasOutcome && !hasMeasure) {
    return {
      ok: false,
      reason: "Declare an outcome and a measure before committing this to a bucket.",
    };
  }
  if (!hasOutcome) return { ok: false, reason: "Declare the outcome this commitment is for." };
  return { ok: false, reason: "Declare how this outcome will be measured." };
}

/**
 * The ungoverned commitments in a set: items sitting in a bucket without a
 * complete outcome+measure. Pure and order-preserving so the board can render
 * a count and per-item cue from one pass.
 */
export function findGovernanceGaps<T extends Committable>(items: readonly T[]): T[] {
  return items.filter((it) => !isCommitmentGoverned(it));
}

/** Convenience count of ungoverned commitments. */
export function governanceGapCount(items: readonly Committable[]): number {
  let n = 0;
  for (const it of items) if (!isCommitmentGoverned(it)) n += 1;
  return n;
}

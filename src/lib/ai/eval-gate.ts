/**
 * P4-GATE: shared eval-regression merge-readiness logic for the Studio engine.
 *
 * The J2 CI gate (studio-ci.ts) refuses a Studio merge while the repo's CI is
 * red. This is its quality-side twin: it refuses a merge while the workspace's
 * eval suites are measurably regressing, so the BUILD->SHIP loop cannot ship
 * code unattended while output quality is dropping.
 *
 * Evals run on a schedule (the eval-tick crons), so this reads the already
 * measured trend, the same way the CI gate reads check-runs; it never triggers
 * an eval run. The gate compares, per suite, the latest completed run's average
 * score to the prior completed run's, both on the 0-100 scale, and blocks when
 * any suite dropped by the threshold or more. Scores are point-in-time and the
 * LLM judge has some variance, so the threshold is the buffer against minor
 * noise; the operator can always merge from GitHub directly (the gate only
 * governs the agent's studio.pr.merge tool).
 */

/** A merge is blocked when the latest eval run is this many points (0-100)
 *  below the prior run for the same suite. */
export const EVAL_REGRESSION_THRESHOLD_PTS = 10;

/** The two most recent completed average scores (0-100) for one eval suite. */
export interface SuiteScorePair {
  suite_name: string;
  /** Most recent completed run's avg_score (0-100). */
  latest: number;
  /** The completed run immediately before it (0-100), the regression baseline. */
  prior: number;
}

/**
 * Eval merge gate: may a Studio PR merge given the recent eval trend?
 *  - no pairs (no suite has two completed runs) => allowed (nothing to gate on)
 *  - any suite dropped >= threshold points        => blocked, naming the worst
 *  - else                                          => allowed
 */
export function evalRegressionReadiness(pairs: SuiteScorePair[]): {
  allowed: boolean;
  reason: string;
} {
  if (pairs.length === 0) {
    return { allowed: true, reason: "No completed eval history to gate on." };
  }
  let worst: { suite_name: string; drop: number } | null = null;
  for (const p of pairs) {
    const drop = p.prior - p.latest;
    if (drop >= EVAL_REGRESSION_THRESHOLD_PTS && (!worst || drop > worst.drop)) {
      worst = { suite_name: p.suite_name, drop };
    }
  }
  if (worst) {
    return {
      allowed: false,
      reason: `Eval regression: "${worst.suite_name}" dropped ${worst.drop.toFixed(0)} points on its latest run vs the prior one, at or over the ${EVAL_REGRESSION_THRESHOLD_PTS}-point gate. Investigate the regression (or re-run evals to confirm it was not a one-off) before merging.`,
    };
  }
  return { allowed: true, reason: "No eval suite regressed beyond the gate threshold." };
}

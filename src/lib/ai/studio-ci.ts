/**
 * J2: shared CI verdict + merge-readiness logic for the Studio engine.
 *
 * Tests run in the connected repo's GitHub Actions CI (there is no Cadence
 * execution sandbox). `github.ci.read` reads the check-runs + statuses; this
 * module derives the single overall verdict and decides whether a Studio PR may
 * merge. Both `github.ci.read` and the `studio.pr.merge` gate import these so
 * they can never disagree on what "green" means.
 */

export type CiOverall = "pending" | "success" | "failure" | "neutral";

/** The minimal shape needed to judge a check or status. */
export interface CiCheckLite {
  /** queued | in_progress | completed */
  status: string;
  /** success | failure | neutral | cancelled | skipped | timed_out | action_required | null */
  conclusion: string | null;
}

const FAILING_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "cancelled"]);

/**
 * Derive the overall CI verdict from the merged check-runs and statuses list:
 *  - empty       => neutral (no CI configured on this repo)
 *  - any failing => failure
 *  - any pending => pending (not yet completed)
 *  - else        => success
 */
export function overallFromChecks(checks: CiCheckLite[]): CiOverall {
  if (checks.length === 0) return "neutral";
  if (checks.some((c) => c.conclusion !== null && FAILING_CONCLUSIONS.has(c.conclusion))) {
    return "failure";
  }
  if (checks.some((c) => c.status !== "completed")) return "pending";
  return "success";
}

/**
 * J2 merge gate: may a Studio PR be merged given its CI verdict?
 *  - success           => allowed (CI is green)
 *  - neutral           => allowed (no CI to gate on; cannot block on absent CI)
 *  - failure / pending => blocked, with an actionable reason
 */
export function mergeReadinessFromCi(overall: CiOverall): { allowed: boolean; reason: string } {
  switch (overall) {
    case "success":
      return { allowed: true, reason: "CI is green." };
    case "neutral":
      return {
        allowed: true,
        reason: "No CI is configured on this repo, so there is nothing to gate on.",
      };
    case "failure":
      return {
        allowed: false,
        reason: "CI is red. Read the failing check, stage a fix, and commit again before merging.",
      };
    case "pending":
      return {
        allowed: false,
        reason: "CI is still running. Wait for it to finish before merging.",
      };
  }
}

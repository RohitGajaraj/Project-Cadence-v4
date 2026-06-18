/**
 * BLD-05 Inspector gate: the pre-merge "test + preview" summary.
 *
 * Pure, testable. Given the changeset's touched paths + the CI verdict, it
 * derives what the operator needs at the merge-approval moment: how many files
 * change, how many are tests, whether the change ships ANY tests, and whether
 * CI actually ran and passed. The UI surfaces this as a warn-only Inspector card
 * (no test files is flagged, never hard-blocked, per the 2026-06-18 ruling).
 */

export type CiOverall = "pending" | "success" | "failure" | "neutral" | null;

export type InspectionInput = {
  paths: string[];
  ciOverall: CiOverall;
  ciCheckCount: number;
};

export type Inspection = {
  total_files: number;
  test_files: number;
  has_tests: boolean;
  ci_ran: boolean;
  ci_passed: boolean;
};

/** True if a path looks like an agent-authored test file. */
export function isTestPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) ||
    /(^|\/)__tests__\//.test(p) ||
    /(^|\/)tests?\//.test(p)
  );
}

/** Summarize a changeset for the Inspector gate. */
export function summarizeInspection(input: InspectionInput): Inspection {
  const testFiles = input.paths.filter(isTestPath).length;
  return {
    total_files: input.paths.length,
    test_files: testFiles,
    has_tests: testFiles > 0,
    ci_ran: input.ciCheckCount > 0,
    ci_passed: input.ciOverall === "success" || input.ciOverall === "neutral",
  };
}

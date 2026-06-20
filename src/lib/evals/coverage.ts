/**
 * EVAL-COVERAGE — pure scorer for "which AI surfaces have an eval guard, and which do not".
 *
 * Closes the `considerations.md` AI-safety-lens P1 gap "Eval coverage targets per surface/agent"
 * ("Today coverage is partial; autonomy needs broad coverage"). The eval substrate already supports
 * suite CRUD, score trends, and scheduled runs, but nothing answered the governance question: which
 * of the canonical AI surfaces have NO eval guard at all. This computes that, completing the
 * "is the autonomy actually guarded" triad with RELIABILITY-SLO (is it reliable) and RUNAWAY-DETECT
 * (is it spinning).
 *
 * Coverage vs pass-rate: a suite's score TREND answers "is the eval passing"; coverage answers the
 * more fundamental "is the surface guarded at all". So a `completed` last run = covered (the guard
 * ran), independent of whether its cases passed. An enabled-but-EMPTY suite (0 runnable cases) is a
 * hollow guard, so it counts as `stale`, never `covered`.
 *
 * Pure and total: the scorer takes normalized suite rows + the canonical targets and returns a
 * report, no I/O, fully unit-tested. The thin `getEvalCoverage` server fn (evals.functions.ts) maps
 * `eval_suites` + the newest `eval_runs` status per suite into {@link SuiteCoverageInput}.
 */

/** A surface×prompt the platform commits to guarding with evals. */
export type CoverageTarget = {
  surface: string;
  key: string;
  /** Human label, shared with the EvalsPanel select so there is one source of truth. */
  label: string;
};

/**
 * The canonical coverage targets. EvalsPanel re-imports this as its SURFACE_KEYS so the panel's
 * "new suite" picker and this scorer can never drift apart.
 */
export const EVAL_COVERAGE_TARGETS: CoverageTarget[] = [
  { surface: "chat", key: "default", label: "Chat, default" },
  { surface: "copilot", key: "daily_brief", label: "Copilot, daily brief" },
  { surface: "discovery", key: "theme_cluster", label: "Discovery, theme cluster" },
  { surface: "meetings", key: "summarize", label: "Meetings, summarize" },
  { surface: "roadmap", key: "prd_generate", label: "Roadmap, PRD" },
  { surface: "studio", key: "prototype", label: "Studio, prototype" },
  { surface: "agent", key: "planner_executor", label: "Agent, planner" },
];

/**
 * The `eval_runs.status` that means the guard actually ran to completion. The lifecycle is
 * pending -> running -> completed | error, and "completed" is the literal the eval runner writes
 * (eval-runner.server.ts) and every other reader matches (getEvalScoreTrends, the tool registry,
 * the seed migrations). Must stay byte-equal to that DB contract, NOT the agent_runs "complete".
 */
export const HEALTHY_RUN_STATUS = "completed";

/** One eval suite, normalized from `eval_suites` + its newest `eval_runs` status. */
export type SuiteCoverageInput = {
  surface: string;
  promptKey: string;
  enabled: boolean;
  /** Number of `eval_cases` in the suite; an enabled suite with 0 cases is a hollow guard. */
  caseCount: number;
  /** Newest run status, or null when the suite has never run. */
  lastRunStatus: string | null;
};

export type TargetState = "covered" | "stale" | "uncovered";

export type CoverageReport = {
  /** Number of canonical targets considered. */
  total: number;
  /** Targets with a healthy guard. */
  coveredCount: number;
  /** coveredCount / total, as a percentage (0dp). 100 when there are no targets. */
  coveragePct: number;
  /** Labels, by state. */
  covered: string[];
  /** No enabled, case-bearing suite for the target (the hard gap). */
  uncovered: string[];
  /** A guard exists but has never completed a run (never run, errored, or only in flight). */
  stale: string[];
  /** One calm operator line, or "" when every target is covered (the caller stays silent). */
  summary: string;
};

/** Does a suite actually guard a target? Enabled, case-bearing, and matching the surface+key. */
function guards(suite: SuiteCoverageInput, target: CoverageTarget): boolean {
  return (
    suite.enabled &&
    suite.caseCount > 0 &&
    suite.surface === target.surface &&
    suite.promptKey === target.key
  );
}

/** Classify one target against the suites. covered > stale > uncovered, decided in that order. */
export function targetState(target: CoverageTarget, suites: SuiteCoverageInput[]): TargetState {
  const guarding = suites.filter((s) => guards(s, target));
  if (guarding.length === 0) return "uncovered";
  if (guarding.some((s) => s.lastRunStatus === HEALTHY_RUN_STATUS)) return "covered";
  return "stale";
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * Compute eval coverage across the canonical targets. Pure and total for any input (empty suites,
 * unknown statuses, an empty target list all yield a defined report; no throw).
 */
export function assessEvalCoverage(
  suites: SuiteCoverageInput[],
  targets: CoverageTarget[] = EVAL_COVERAGE_TARGETS,
): CoverageReport {
  const covered: string[] = [];
  const uncovered: string[] = [];
  const stale: string[] = [];

  for (const t of targets) {
    const state = targetState(t, suites);
    if (state === "covered") covered.push(t.label);
    else if (state === "uncovered") uncovered.push(t.label);
    else stale.push(t.label);
  }

  const total = targets.length;
  const coveredCount = covered.length;
  const coveragePct = total === 0 ? 100 : round((coveredCount / total) * 100);

  const report: CoverageReport = {
    total,
    coveredCount,
    coveragePct,
    covered,
    uncovered,
    stale,
    summary: "",
  };
  report.summary = summarizeCoverage(report);
  return report;
}

/**
 * One calm operator line. Authored display copy (humanized-output Tier 2: no em/en dashes, no
 * AI-cliche filler). Returns "" when every target is covered, so the caller can stay silent.
 */
export function summarizeCoverage(report: CoverageReport): string {
  const u = report.uncovered.length;
  const s = report.stale.length;
  if (u === 0 && s === 0) return "";
  const parts: string[] = [];
  if (u > 0) parts.push(`${u} of ${report.total} AI surfaces have no eval guard`);
  if (s > 0) parts.push(`${s} guard${s === 1 ? "" : "s"} unproven`);
  return parts.join(" · ");
}

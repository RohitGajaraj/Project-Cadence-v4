/**
 * EVALS-PRIMITIVE (v11 #29) — PURE eval-HEALTH engine (the "trust" leg).
 *
 * Evals already have define (suites/cases) + run (the runner) + coverage (coverage.ts: are we
 * testing enough?). The missing leg of "evals as a first-class PM primitive" is TRUST: can the
 * PM rely on these evals, and is quality trending up or down? This module answers that over the
 * `eval_runs` history — overall pass rate, the error/reliability rate, average judge score, the
 * recent-vs-prior TREND, and per-suite FLAKINESS (a suite whose pass/fail flips run to run is
 * the signal that quietly destroys trust). Distinct from coverage (breadth), this is reliability.
 *
 * PURE: no db/network/AI; unit-verifiable. The server adapter passes `eval_runs` rows in.
 */

/** A row from `eval_runs` (the fields health needs). */
export type EvalRunRow = {
  suite_id: string;
  status: string;
  pass_count: number;
  fail_count: number;
  errored: number;
  total_cases: number;
  avg_score: number | null;
  created_at: string;
};

/** Suite titles, keyed by suite id, for human-readable breakdowns (optional). */
export type SuiteTitles = Readonly<Record<string, string | null>>;

export type TrendDirection = "improving" | "declining" | "stable" | "unknown";

export type SuiteHealth = {
  suiteId: string;
  title: string | null;
  runs: number;
  /** Pass rate over the suite's completed runs (cases passed / cases run); null when none ran. */
  passRate: number | null;
  /** Adjacent-run result flips / opportunities, over >=3 runs; null when too few runs. */
  flakiness: number | null;
  flaky: boolean;
};

export type EvalHealth = {
  totalRuns: number;
  completedRuns: number;
  /** Cases passed / cases run, across completed runs; null when nothing ran. */
  passRate: number | null;
  /** Runs that errored / total runs (a reliability signal independent of pass/fail). */
  errorRate: number;
  /** Mean of per-run avg_score across runs that reported one; null when none did. */
  avgScore: number | null;
  trend: TrendDirection;
  /** Suites flagged flaky (pass/fail oscillates), worst first. */
  flakySuites: SuiteHealth[];
  /** Every suite's health, worst pass rate first (nulls last). */
  suites: SuiteHealth[];
  /** A coarse, honest trust verdict for a headline. */
  verdict: "healthy" | "watch" | "at-risk" | "no-data";
};

const COMPLETED = "completed";
/** A suite is flaky when adjacent-run outcomes flip at least this often. */
const FLAKY_THRESHOLD = 0.25;
/** Recent-vs-prior pass-rate gap beyond this counts as a real trend move. */
const TREND_EPSILON = 0.05;

function isCompleted(r: EvalRunRow): boolean {
  return typeof r.status === "string" && r.status.trim().toLowerCase() === COMPLETED;
}

/** A completed run "passed" when every case passed and nothing errored. */
function runPassed(r: EvalRunRow): boolean {
  return isCompleted(r) && r.fail_count === 0 && r.errored === 0 && r.total_cases > 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function poolPassRate(runs: readonly EvalRunRow[]): number | null {
  let passed = 0;
  let cases = 0;
  for (const r of runs) {
    if (!isCompleted(r)) continue;
    cases += r.total_cases;
    passed += r.pass_count;
  }
  return cases > 0 ? round2(passed / cases) : null;
}

/**
 * PURE. Compute eval health over a workspace's run history. Empty/no-data is honest
 * ("no-data"), never a fabricated score. Never throws on malformed rows.
 */
export function computeEvalHealth(
  runsInput: readonly EvalRunRow[],
  titles: SuiteTitles = {},
): EvalHealth {
  const runs = (Array.isArray(runsInput) ? runsInput : []).filter(
    (r): r is EvalRunRow => !!r && typeof r.suite_id === "string",
  );
  const totalRuns = runs.length;
  const completed = runs.filter(isCompleted);
  const completedRuns = completed.length;

  const passRate = poolPassRate(runs);
  const errorRate = totalRuns > 0 ? round2(runs.filter((r) => r.errored > 0).length / totalRuns) : 0;

  let scoreSum = 0;
  let scoreN = 0;
  for (const r of runs) {
    if (typeof r.avg_score === "number" && !Number.isNaN(r.avg_score)) {
      scoreSum += r.avg_score;
      scoreN += 1;
    }
  }
  const avgScore = scoreN > 0 ? round2(scoreSum / scoreN) : null;

  // Per-suite: group, order oldest->newest, derive pass rate + flakiness.
  const bySuite = new Map<string, EvalRunRow[]>();
  for (const r of runs) {
    const list = bySuite.get(r.suite_id);
    if (list) list.push(r);
    else bySuite.set(r.suite_id, [r]);
  }
  const suites: SuiteHealth[] = [];
  for (const [suiteId, list] of bySuite) {
    const ordered = [...list].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    const completedOrdered = ordered.filter(isCompleted);
    let flakiness: number | null = null;
    if (completedOrdered.length >= 3) {
      let flips = 0;
      for (let i = 1; i < completedOrdered.length; i++) {
        if (runPassed(completedOrdered[i]) !== runPassed(completedOrdered[i - 1])) flips += 1;
      }
      flakiness = round2(flips / (completedOrdered.length - 1));
    }
    suites.push({
      suiteId,
      title: titles[suiteId] ?? null,
      runs: list.length,
      passRate: poolPassRate(list),
      flakiness,
      flaky: flakiness !== null && flakiness >= FLAKY_THRESHOLD,
    });
  }
  suites.sort((a, b) => {
    if ((a.passRate === null) !== (b.passRate === null)) return a.passRate === null ? 1 : -1;
    if (a.passRate !== null && b.passRate !== null && a.passRate !== b.passRate) {
      return a.passRate - b.passRate; // worst first
    }
    return b.runs - a.runs;
  });
  const flakySuites = suites.filter((s) => s.flaky).sort((a, b) => (b.flakiness ?? 0) - (a.flakiness ?? 0));

  // Trend: recent half vs prior half of completed runs (chronological), by pooled pass rate.
  let trend: TrendDirection = "unknown";
  if (completedRuns >= 4) {
    const chrono = [...completed].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    const mid = Math.floor(chrono.length / 2);
    const prior = poolPassRate(chrono.slice(0, mid));
    const recent = poolPassRate(chrono.slice(mid));
    if (prior !== null && recent !== null) {
      if (recent > prior + TREND_EPSILON) trend = "improving";
      else if (recent < prior - TREND_EPSILON) trend = "declining";
      else trend = "stable";
    }
  }

  let verdict: EvalHealth["verdict"];
  if (completedRuns === 0) verdict = "no-data";
  else if ((passRate ?? 0) >= 0.9 && errorRate < 0.1 && flakySuites.length === 0) verdict = "healthy";
  else if ((passRate ?? 0) >= 0.7 && flakySuites.length <= 1) verdict = "watch";
  else verdict = "at-risk";

  return {
    totalRuns,
    completedRuns,
    passRate,
    errorRate,
    avgScore,
    trend,
    flakySuites,
    suites,
    verdict,
  };
}

/** PURE. One honest, plain-language line for a headline. */
export function summarizeEvalHealth(h: EvalHealth): string {
  if (h.verdict === "no-data") {
    return "No completed eval runs yet. Run a suite and the health picture fills in here.";
  }
  const parts: string[] = [];
  if (h.passRate !== null) parts.push(`${Math.round(h.passRate * 100)}% of cases passing`);
  parts.push(`across ${h.completedRuns} completed run${h.completedRuns === 1 ? "" : "s"}`);
  if (h.trend !== "unknown" && h.trend !== "stable") parts.push(`quality is ${h.trend}`);
  if (h.flakySuites.length > 0) {
    parts.push(`${h.flakySuites.length} flaky suite${h.flakySuites.length === 1 ? "" : "s"} to fix`);
  }
  if (h.errorRate >= 0.1) parts.push(`${Math.round(h.errorRate * 100)}% of runs errored`);
  return parts.join(", ") + ".";
}

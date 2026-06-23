import { describe, it, expect } from "bun:test";
import { computeEvalHealth, summarizeEvalHealth, type EvalRunRow } from "./health";

function run(over: Partial<EvalRunRow> = {}): EvalRunRow {
  return {
    suite_id: "s1",
    status: "completed",
    pass_count: 10,
    fail_count: 0,
    errored: 0,
    total_cases: 10,
    avg_score: 0.95,
    created_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

describe("computeEvalHealth — no data / honesty", () => {
  it("reports no-data with no completed runs and never throws", () => {
    const h = computeEvalHealth([]);
    expect(h.verdict).toBe("no-data");
    expect(h.passRate).toBeNull();
    expect(summarizeEvalHealth(h).toLowerCase()).toContain("no completed eval runs");
  });

  it("ignores malformed rows", () => {
    const h = computeEvalHealth([null as unknown as EvalRunRow, run()]);
    expect(h.totalRuns).toBe(1);
  });

  it("a pending (not completed) run does not count toward pass rate", () => {
    const h = computeEvalHealth([run({ status: "running", pass_count: 0, total_cases: 10 })]);
    expect(h.completedRuns).toBe(0);
    expect(h.verdict).toBe("no-data");
  });
});

describe("computeEvalHealth — pass rate, error rate, score", () => {
  it("pools pass rate across completed runs by cases", () => {
    const h = computeEvalHealth([
      run({ pass_count: 8, fail_count: 2, total_cases: 10, avg_score: 0.8 }),
      run({ pass_count: 10, fail_count: 0, total_cases: 10, avg_score: 1.0 }),
    ]);
    expect(h.passRate).toBeCloseTo(0.9, 2); // 18/20
    expect(h.avgScore).toBeCloseTo(0.9, 2);
  });

  it("computes error rate independent of pass/fail", () => {
    const h = computeEvalHealth([
      run({ errored: 1 }),
      run(),
      run(),
      run(),
    ]);
    expect(h.errorRate).toBeCloseTo(0.25, 2); // 1 of 4 runs errored
  });

  it("flags healthy when pass rate high, no errors, no flaky suites", () => {
    const h = computeEvalHealth([run(), run(), run(), run()]);
    expect(h.passRate).toBe(1);
    expect(h.verdict).toBe("healthy");
  });

  it("flags at-risk on a low pass rate", () => {
    const h = computeEvalHealth([
      run({ pass_count: 4, fail_count: 6, total_cases: 10 }),
      run({ pass_count: 5, fail_count: 5, total_cases: 10 }),
    ]);
    expect(h.verdict).toBe("at-risk");
  });
});

describe("computeEvalHealth — flakiness", () => {
  it("detects a suite whose pass/fail flips run to run", () => {
    const flips: EvalRunRow[] = [
      run({ suite_id: "flaky", fail_count: 0, pass_count: 10, created_at: "2026-06-01T00:00:00Z" }),
      run({ suite_id: "flaky", fail_count: 3, pass_count: 7, created_at: "2026-06-02T00:00:00Z" }),
      run({ suite_id: "flaky", fail_count: 0, pass_count: 10, created_at: "2026-06-03T00:00:00Z" }),
      run({ suite_id: "flaky", fail_count: 4, pass_count: 6, created_at: "2026-06-04T00:00:00Z" }),
    ];
    const h = computeEvalHealth(flips);
    const s = h.suites.find((x) => x.suiteId === "flaky");
    expect(s?.flakiness).toBeCloseTo(1, 2); // flips every adjacent pair (3/3)
    expect(s?.flaky).toBe(true);
    expect(h.flakySuites.length).toBe(1);
  });

  it("a stable suite is not flaky and needs >=3 runs to judge", () => {
    const h = computeEvalHealth([
      run({ suite_id: "stable" }),
      run({ suite_id: "stable" }),
    ]);
    expect(h.suites[0].flakiness).toBeNull(); // too few runs
    expect(h.suites[0].flaky).toBe(false);
  });

  it("surfaces suite titles when provided", () => {
    const h = computeEvalHealth([run({ suite_id: "s9" }), run({ suite_id: "s9" }), run({ suite_id: "s9" })], {
      s9: "Checkout safety suite",
    });
    expect(h.suites.find((s) => s.suiteId === "s9")?.title).toBe("Checkout safety suite");
  });
});

describe("computeEvalHealth — trend", () => {
  it("detects an improving trend (recent half beats prior half)", () => {
    const h = computeEvalHealth([
      run({ pass_count: 5, fail_count: 5, total_cases: 10, created_at: "2026-06-01T00:00:00Z" }),
      run({ pass_count: 6, fail_count: 4, total_cases: 10, created_at: "2026-06-02T00:00:00Z" }),
      run({ pass_count: 9, fail_count: 1, total_cases: 10, created_at: "2026-06-03T00:00:00Z" }),
      run({ pass_count: 10, fail_count: 0, total_cases: 10, created_at: "2026-06-04T00:00:00Z" }),
    ]);
    expect(h.trend).toBe("improving");
  });

  it("is unknown with too few completed runs to judge a trend", () => {
    const h = computeEvalHealth([run(), run()]);
    expect(h.trend).toBe("unknown");
  });
});

describe("summarizeEvalHealth — fingerprint-free", () => {
  it("has no em/en dashes or cliches", () => {
    const s = summarizeEvalHealth(computeEvalHealth([run(), run(), run(), run()]));
    expect(s.includes("—")).toBe(false);
    expect(s.includes("–")).toBe(false);
    expect(s.toLowerCase()).not.toContain("delve");
  });
});

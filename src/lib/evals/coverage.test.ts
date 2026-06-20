import { describe, it, expect } from "bun:test";
import {
  assessEvalCoverage,
  targetState,
  summarizeCoverage,
  EVAL_COVERAGE_TARGETS,
  HEALTHY_RUN_STATUS,
  type SuiteCoverageInput,
  type CoverageTarget,
} from "./coverage";

const target: CoverageTarget = { surface: "chat", key: "default", label: "Chat, default" };

const suite = (over: Partial<SuiteCoverageInput>): SuiteCoverageInput => ({
  surface: "chat",
  promptKey: "default",
  enabled: true,
  caseCount: 3,
  lastRunStatus: HEALTHY_RUN_STATUS,
  ...over,
});

// A full set of healthy guards, one per canonical target.
const fullCoverage: SuiteCoverageInput[] = EVAL_COVERAGE_TARGETS.map((t) => ({
  surface: t.surface,
  promptKey: t.key,
  enabled: true,
  caseCount: 2,
  lastRunStatus: HEALTHY_RUN_STATUS,
}));

describe("targetState", () => {
  it("covered: an enabled, case-bearing suite with a complete last run", () => {
    expect(targetState(target, [suite({})])).toBe("covered");
  });

  it("uncovered: no suite at all", () => {
    expect(targetState(target, [])).toBe("uncovered");
  });

  it("uncovered: a suite for a DIFFERENT surface/key does not count", () => {
    expect(targetState(target, [suite({ surface: "studio", promptKey: "prototype" })])).toBe(
      "uncovered",
    );
  });

  it("uncovered: a disabled suite is not a guard", () => {
    expect(targetState(target, [suite({ enabled: false })])).toBe("uncovered");
  });

  it("uncovered: an enabled suite with 0 cases is a hollow guard", () => {
    expect(targetState(target, [suite({ caseCount: 0 })])).toBe("uncovered");
  });

  it("stale: a guard that never ran", () => {
    expect(targetState(target, [suite({ lastRunStatus: null })])).toBe("stale");
  });

  it("stale: a guard whose last run errored", () => {
    expect(targetState(target, [suite({ lastRunStatus: "error" })])).toBe("stale");
  });

  it("stale: a guard only ever in flight (running/pending)", () => {
    expect(targetState(target, [suite({ lastRunStatus: "running" })])).toBe("stale");
  });

  it("covered wins when ANY guarding suite is healthy", () => {
    const out = targetState(target, [suite({ lastRunStatus: "error" }), suite({})]);
    expect(out).toBe("covered");
  });

  it("covered for the LITERAL DB status the eval runner writes ('completed')", () => {
    // Pin to the real eval_runs contract, not just the HEALTHY_RUN_STATUS constant, so a future
    // drift between the scorer and the runner is caught here (the legacy agent_runs value is
    // 'complete' and must NOT be accepted).
    expect(HEALTHY_RUN_STATUS).toBe("completed");
    expect(targetState(target, [suite({ lastRunStatus: "completed" })])).toBe("covered");
    expect(targetState(target, [suite({ lastRunStatus: "complete" })])).toBe("stale");
  });
});

describe("assessEvalCoverage", () => {
  it("reports full coverage with an empty summary (caller stays silent)", () => {
    const r = assessEvalCoverage(fullCoverage);
    expect(r.total).toBe(EVAL_COVERAGE_TARGETS.length);
    expect(r.coveredCount).toBe(EVAL_COVERAGE_TARGETS.length);
    expect(r.coveragePct).toBe(100);
    expect(r.uncovered).toEqual([]);
    expect(r.stale).toEqual([]);
    expect(r.summary).toBe("");
  });

  it("reports zero coverage when there are no suites", () => {
    const r = assessEvalCoverage([]);
    expect(r.coveredCount).toBe(0);
    expect(r.coveragePct).toBe(0);
    expect(r.uncovered.length).toBe(EVAL_COVERAGE_TARGETS.length);
    expect(r.stale).toEqual([]);
    expect(r.summary).toContain(
      `${EVAL_COVERAGE_TARGETS.length} of ${EVAL_COVERAGE_TARGETS.length} AI surfaces have no eval guard`,
    );
  });

  it("splits covered / uncovered / stale and computes pct", () => {
    // chat covered; copilot stale (errored); the other 5 uncovered.
    const suites: SuiteCoverageInput[] = [
      {
        surface: "chat",
        promptKey: "default",
        enabled: true,
        caseCount: 1,
        lastRunStatus: "completed",
      },
      {
        surface: "copilot",
        promptKey: "daily_brief",
        enabled: true,
        caseCount: 1,
        lastRunStatus: "error",
      },
    ];
    const r = assessEvalCoverage(suites);
    expect(r.coveredCount).toBe(1);
    expect(r.covered).toEqual(["Chat, default"]);
    expect(r.stale).toEqual(["Copilot, daily brief"]);
    expect(r.uncovered.length).toBe(5);
    expect(r.coveragePct).toBe(round(1 / 7));
    expect(r.summary).toContain("5 of 7 AI surfaces have no eval guard");
    expect(r.summary).toContain("1 guard unproven");
  });

  it("is total for an empty target list (no divide-by-zero)", () => {
    const r = assessEvalCoverage([], []);
    expect(r.total).toBe(0);
    expect(r.coveragePct).toBe(100);
    expect(r.summary).toBe("");
  });

  it("is idempotent (same input, same report)", () => {
    expect(assessEvalCoverage(fullCoverage)).toEqual(assessEvalCoverage(fullCoverage));
  });
});

describe("summarizeCoverage", () => {
  it("returns '' at full coverage", () => {
    expect(summarizeCoverage(assessEvalCoverage(fullCoverage))).toBe("");
  });

  it("uses singular grammar for one unproven guard", () => {
    const suites: SuiteCoverageInput[] = EVAL_COVERAGE_TARGETS.map((t, i) => ({
      surface: t.surface,
      promptKey: t.key,
      enabled: true,
      caseCount: 1,
      lastRunStatus: i === 0 ? "error" : HEALTHY_RUN_STATUS,
    }));
    const line = summarizeCoverage(assessEvalCoverage(suites));
    expect(line).toBe("1 guard unproven");
  });

  it("carries no em or en dashes (humanized-output Tier 2)", () => {
    expect(summarizeCoverage(assessEvalCoverage([]))).not.toMatch(/[—–]/);
  });
});

function round(frac: number): number {
  return Math.round(frac * 100);
}

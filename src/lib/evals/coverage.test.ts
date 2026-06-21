import { describe, it, expect } from "bun:test";
import {
  assessEvalCoverage,
  evaluateCoverageFloor,
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

describe("assessEvalCoverage.targets (per-surface chip source)", () => {
  it("returns one entry per canonical target, in canonical order, all covered at full coverage", () => {
    const r = assessEvalCoverage(fullCoverage);
    expect(r.targets).toHaveLength(EVAL_COVERAGE_TARGETS.length);
    expect(r.targets.map((t) => t.surface)).toEqual(EVAL_COVERAGE_TARGETS.map((t) => t.surface));
    expect(r.targets.every((t) => t.state === "covered")).toBe(true);
  });

  it("marks every target uncovered when there are no suites", () => {
    const r = assessEvalCoverage([]);
    expect(r.targets).toHaveLength(EVAL_COVERAGE_TARGETS.length);
    expect(r.targets.every((t) => t.state === "uncovered")).toBe(true);
  });

  it("resolves per-target state for a mixed input (covered / stale / uncovered)", () => {
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
    const byState = (st: string) => r.targets.filter((t) => t.state === st).map((t) => t.surface);
    expect(byState("covered")).toEqual(["chat"]);
    expect(byState("stale")).toEqual(["copilot"]);
    expect(byState("uncovered").length).toBe(5);
    // The chip source agrees with the label arrays (no drift).
    expect(r.targets.filter((t) => t.state === "covered").map((t) => t.label)).toEqual(r.covered);
  });
});

describe("evaluateCoverageFloor (deploy gate)", () => {
  const full = assessEvalCoverage(fullCoverage); // coveragePct 100, all surfaces covered
  const empty = assessEvalCoverage([]); // coveragePct 0, all uncovered

  it("is dormant (configured:false, pass:true) with no policy", () => {
    const v = evaluateCoverageFloor(full);
    expect(v).toEqual({ configured: false, pass: true, reasons: [] });
  });

  it("treats a zero/negative minCoveragePct as not enforced (still dormant)", () => {
    expect(evaluateCoverageFloor(empty, { minCoveragePct: 0 }).configured).toBe(false);
    expect(evaluateCoverageFloor(empty, { minCoveragePct: -5 }).configured).toBe(false);
  });

  it("passes when coveragePct meets the floor", () => {
    const v = evaluateCoverageFloor(full, { minCoveragePct: 80 });
    expect(v.configured).toBe(true);
    expect(v.pass).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it("fails when coveragePct is below the floor, naming both numbers", () => {
    const v = evaluateCoverageFloor(empty, { minCoveragePct: 80 });
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toContain("0%");
    expect(v.reasons[0]).toContain("80%");
  });

  it("passes when every required surface is covered", () => {
    const v = evaluateCoverageFloor(full, { requiredSurfaces: ["chat", "agent"] });
    expect(v.pass).toBe(true);
  });

  it("fails and names the missing required surfaces (plural)", () => {
    const v = evaluateCoverageFloor(empty, { requiredSurfaces: ["chat", "agent"] });
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toContain("2 required surfaces not covered");
    expect(v.reasons[0]).toContain("chat");
    expect(v.reasons[0]).toContain("agent");
  });

  it("uses singular grammar for one missing required surface", () => {
    const v = evaluateCoverageFloor(empty, { requiredSurfaces: ["chat"] });
    expect(v.reasons[0]).toContain("1 required surface not covered");
    expect(v.reasons[0]).not.toContain("surfaces");
  });

  it("a stale guard does NOT satisfy a required surface (must be covered)", () => {
    const stale = assessEvalCoverage([
      {
        surface: "chat",
        promptKey: "default",
        enabled: true,
        caseCount: 1,
        lastRunStatus: "error",
      },
    ]);
    expect(evaluateCoverageFloor(stale, { requiredSurfaces: ["chat"] }).pass).toBe(false);
  });

  it("accumulates both a pct and a required-surface reason", () => {
    const v = evaluateCoverageFloor(empty, { minCoveragePct: 50, requiredSurfaces: ["chat"] });
    expect(v.reasons).toHaveLength(2);
    expect(v.pass).toBe(false);
  });

  it("ignores blank entries in requiredSurfaces (trim + filter)", () => {
    const v = evaluateCoverageFloor(full, { requiredSurfaces: ["", "  ", "chat"] });
    expect(v.configured).toBe(true);
    expect(v.pass).toBe(true);
  });

  it("carries no em or en dashes in any reason (humanized-output Tier 2)", () => {
    const v = evaluateCoverageFloor(empty, { minCoveragePct: 90, requiredSurfaces: ["chat"] });
    expect(v.reasons.join(" ")).not.toMatch(/[—–]/);
  });

  it("dedupes requiredSurfaces so a repeated id is not double-counted in the reason", () => {
    const v = evaluateCoverageFloor(empty, { requiredSurfaces: ["chat", "chat"] });
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toContain("1 required surface not covered: chat");
    expect(v.reasons[0]).not.toContain("chat, chat");
  });

  it("gates on the TRUE coverage ratio, not the rounded display percent", () => {
    // 6 of 7 covered: coveragePct DISPLAYS as 86 (rounds up from 85.71), but the gate must compare
    // the true 85.71. A floor of 86 must FAIL; a floor of 85 must PASS.
    const sixOfSeven = assessEvalCoverage(fullCoverage.slice(0, EVAL_COVERAGE_TARGETS.length - 1));
    expect(sixOfSeven.coveragePct).toBe(86); // the rounded display number
    const failed = evaluateCoverageFloor(sixOfSeven, { minCoveragePct: 86 });
    expect(failed.pass).toBe(false);
    expect(failed.reasons[0]).toContain("85.7%"); // the honest, unrounded number in the message
    expect(evaluateCoverageFloor(sixOfSeven, { minCoveragePct: 85 }).pass).toBe(true);
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

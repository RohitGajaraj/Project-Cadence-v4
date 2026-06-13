import { describe, expect, test } from "bun:test";
import { adaptiveStepBudget, STEP_CEILING } from "./budget";

describe("adaptiveStepBudget", () => {
  test("specialists keep the conservative floor regardless of mission size", () => {
    expect(
      adaptiveStepBudget({ agentSlug: "discovery", arc: "observing", plannedStepCount: 6 }),
    ).toBe(6);
    expect(adaptiveStepBudget({ agentSlug: "scribe", arc: "proving" })).toBe(6);
  });

  test("earned trust buys a little headroom (applies to every role)", () => {
    expect(adaptiveStepBudget({ agentSlug: "discovery", arc: "trusted" })).toBe(8);
    expect(adaptiveStepBudget({ agentSlug: "discovery", arc: "ambient" })).toBe(10);
  });

  test("the orchestrator scales with the size of the DAG it shepherds", () => {
    const small = adaptiveStepBudget({
      agentSlug: "orchestrator",
      arc: "observing",
      plannedStepCount: 1,
    });
    const big = adaptiveStepBudget({
      agentSlug: "orchestrator",
      arc: "observing",
      plannedStepCount: 6,
    });
    expect(small).toBe(16); // 14 base + 1*2 size
    expect(big).toBe(26); //  14 base + 6*2 size
    expect(big).toBeGreaterThan(small);
  });

  test("the orchestrator base never regresses below the proven static cap (14)", () => {
    // Its initial run has plannedStepCount 0 (mission.plan hasn't run yet).
    expect(adaptiveStepBudget({ agentSlug: "orchestrator", arc: "observing" })).toBe(14);
  });

  test("only the orchestrator size-scales — specialists ignore plannedStepCount", () => {
    expect(
      adaptiveStepBudget({ agentSlug: "builder", arc: "observing", plannedStepCount: 6 }),
    ).toBe(24);
  });

  test("everything is bounded by the hard ceiling", () => {
    expect(
      adaptiveStepBudget({ agentSlug: "orchestrator", arc: "ambient", plannedStepCount: 100 }),
    ).toBe(STEP_CEILING);
  });

  test("an absent plannedStepCount is treated as zero (orchestrator → base only)", () => {
    expect(adaptiveStepBudget({ agentSlug: "orchestrator", arc: "observing" })).toBe(14);
  });
});

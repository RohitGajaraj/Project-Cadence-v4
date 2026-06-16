import { describe, expect, test } from "bun:test";
import {
  AUTONOMY_STAGES,
  PROVING_AT,
  TRUSTED_AT,
  autonomyStage,
  stageIndex,
  stageMeaning,
} from "./autonomy-progression";

describe("autonomyStage", () => {
  test("null (no side-effecting actions) reads as observing — the honest floor", () => {
    expect(autonomyStage(null)).toBe("observing");
  });
  test("zero and anything below the proving threshold is observing", () => {
    expect(autonomyStage(0)).toBe("observing");
    expect(autonomyStage(PROVING_AT - 0.001)).toBe("observing");
  });
  test("the proving threshold is inclusive (>= 1/3 is proving)", () => {
    expect(autonomyStage(PROVING_AT)).toBe("proving");
    expect(autonomyStage(0.5)).toBe("proving");
    expect(autonomyStage(TRUSTED_AT - 0.001)).toBe("proving");
  });
  test("the trusted threshold is inclusive (>= 2/3 is trusted)", () => {
    expect(autonomyStage(TRUSTED_AT)).toBe("trusted");
    expect(autonomyStage(1)).toBe("trusted");
  });
});

describe("stageIndex", () => {
  test("orders observing < proving < trusted", () => {
    expect(stageIndex("observing")).toBe(0);
    expect(stageIndex("proving")).toBe(1);
    expect(stageIndex("trusted")).toBe(2);
  });
});

describe("AUTONOMY_STAGES", () => {
  test("is exactly the three-rung ladder (ambient is per-agent, not surfaced here)", () => {
    expect(AUTONOMY_STAGES).toEqual(["observing", "proving", "trusted"]);
  });
});

describe("stageMeaning", () => {
  test("returns a non-empty description for every stage", () => {
    for (const s of AUTONOMY_STAGES) {
      expect(stageMeaning(s).length).toBeGreaterThan(0);
    }
  });
  test("never instructs the operator to promote agents (no advance UI exists)", () => {
    for (const s of AUTONOMY_STAGES) {
      expect(stageMeaning(s).toLowerCase()).not.toContain("promote");
    }
  });
});

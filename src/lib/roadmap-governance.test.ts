import { describe, it, expect } from "bun:test";
import {
  isCommitmentGoverned,
  validateCommitment,
  findGovernanceGaps,
  governanceGapCount,
  type Committable,
} from "./roadmap-governance";

const c = (o: Partial<Committable> = {}): Committable => ({
  bucket: "now",
  outcome: "Lift activation",
  measure: "D7 retention +5pt",
  ...o,
});

describe("isCommitmentGoverned", () => {
  it("backlog (null bucket) needs no outcome/measure", () => {
    expect(isCommitmentGoverned(c({ bucket: null, outcome: null, measure: null }))).toBe(true);
  });
  it("a committed item needs BOTH a non-empty outcome and measure", () => {
    expect(isCommitmentGoverned(c())).toBe(true);
    expect(isCommitmentGoverned(c({ outcome: null }))).toBe(false);
    expect(isCommitmentGoverned(c({ measure: null }))).toBe(false);
    expect(isCommitmentGoverned(c({ outcome: "", measure: "" }))).toBe(false);
  });
  it("whitespace-only is not a declared outcome", () => {
    expect(isCommitmentGoverned(c({ outcome: "   ", measure: "x" }))).toBe(false);
  });
  it("applies to next and later, not only now", () => {
    expect(isCommitmentGoverned(c({ bucket: "next", outcome: null }))).toBe(false);
    expect(isCommitmentGoverned(c({ bucket: "later", measure: null }))).toBe(false);
  });
});

describe("validateCommitment", () => {
  it("allows backlog and a complete commitment", () => {
    expect(validateCommitment(c({ bucket: null, outcome: null, measure: null }))).toEqual({
      ok: true,
    });
    expect(validateCommitment(c())).toEqual({ ok: true });
  });
  it("gives a specific reason per missing field", () => {
    const both = validateCommitment(c({ outcome: null, measure: null }));
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.reason).toMatch(/outcome and a measure/i);
    const noOutcome = validateCommitment(c({ outcome: " " }));
    expect(noOutcome.ok).toBe(false);
    if (!noOutcome.ok) expect(noOutcome.reason).toMatch(/outcome/i);
    const noMeasure = validateCommitment(c({ measure: null }));
    expect(noMeasure.ok).toBe(false);
    if (!noMeasure.ok) expect(noMeasure.reason).toMatch(/measure/i);
  });
});

describe("findGovernanceGaps / governanceGapCount", () => {
  const items: Committable[] = [
    c({ bucket: "now" }), // governed
    c({ bucket: "next", outcome: null }), // gap
    c({ bucket: null, outcome: null, measure: null }), // backlog, not a gap
    c({ bucket: "later", measure: "" }), // gap
  ];
  it("returns only the ungoverned commitments, order-preserving", () => {
    const gaps = findGovernanceGaps(items);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].bucket).toBe("next");
    expect(gaps[1].bucket).toBe("later");
  });
  it("counts them", () => {
    expect(governanceGapCount(items)).toBe(2);
    expect(governanceGapCount([])).toBe(0);
    expect(governanceGapCount([c({ bucket: null, outcome: null, measure: null })])).toBe(0);
  });
});

import { describe, expect, test } from "bun:test";
import {
  countPriorityMoves,
  reuseRate,
  computeMemoryLift,
  type ReviewedOutcome,
} from "./memory-compounding";

describe("reuseRate", () => {
  test("null when nothing is stored (no divide-by-zero into a fake 0%)", () => {
    expect(reuseRate(0, 0)).toBeNull();
    expect(reuseRate(5, 0)).toBeNull();
  });
  test("stored but none recalled reads 0 (honest: not compounded yet)", () => {
    expect(reuseRate(0, 5)).toBe(0);
  });
  test("partial and full reuse", () => {
    expect(reuseRate(3, 6)).toBe(0.5);
    expect(reuseRate(5, 5)).toBe(1);
  });
});

describe("countPriorityMoves", () => {
  test("empty input is zero", () => {
    expect(countPriorityMoves([])).toBe(0);
  });
  test("a real ICE move counts", () => {
    expect(countPriorityMoves([{ prior_ice: 8.3, new_ice: 8.7 }])).toBe(1);
  });
  test("a no-move (equal) does not count", () => {
    expect(countPriorityMoves([{ prior_ice: 8.3, new_ice: 8.3 }])).toBe(0);
  });
  test("sub-0.1 drift does not count (rounded compare)", () => {
    expect(countPriorityMoves([{ prior_ice: 8.31, new_ice: 8.34 }])).toBe(0);
  });
  test("a row missing either value is not a move", () => {
    expect(countPriorityMoves([{ prior_ice: null, new_ice: 8.7 }])).toBe(0);
    expect(countPriorityMoves([{ prior_ice: 8.0, new_ice: null }])).toBe(0);
  });
  test("counts only the genuine moves in a mixed set", () => {
    expect(
      countPriorityMoves([
        { prior_ice: 8.3, new_ice: 8.7 }, // move
        { prior_ice: 5.0, new_ice: 5.0 }, // no move
        { prior_ice: 6.31, new_ice: 6.34 }, // sub-0.1, no move
        { prior_ice: null, new_ice: 9.0 }, // missing prior
        { prior_ice: 7.2, new_ice: 6.1 }, // move (down)
      ]),
    ).toBe(2);
  });

  // Regression: Postgres numeric arrives over PostgREST as a STRING, not a
  // number (the generated types lie about the wire shape). Without coercion the
  // guard rejected every real row and the card always read "0 moved a priority".
  describe("the real wire shape (numeric serialized as a string)", () => {
    test("string ICE values are coerced and a real move counts", () => {
      expect(countPriorityMoves([{ prior_ice: "8.3", new_ice: "8.7" }])).toBe(1);
    });
    test("equal string values are not a move", () => {
      expect(countPriorityMoves([{ prior_ice: "8.3", new_ice: "8.3" }])).toBe(0);
    });
    test("sub-0.1 string drift is not a move (rounded compare survives coercion)", () => {
      expect(countPriorityMoves([{ prior_ice: "8.31", new_ice: "8.34" }])).toBe(0);
    });
    test("a non-numeric or blank string reads as no value, not a move", () => {
      expect(countPriorityMoves([{ prior_ice: "abc", new_ice: "8.7" }])).toBe(0);
      expect(countPriorityMoves([{ prior_ice: "", new_ice: "8.7" }])).toBe(0);
    });
    test("mixed string and number rows both count", () => {
      expect(
        countPriorityMoves([
          { prior_ice: "8.3", new_ice: "8.7" }, // move (strings)
          { prior_ice: 5.0, new_ice: 5.0 }, // no move (numbers)
          { prior_ice: "6.0", new_ice: 7.2 }, // move (mixed)
        ]),
      ).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// computeMemoryLift - the memory-depth split (MOAT-METRIC lift half). Every test
// pins an honesty guard: the depth measured via memory-timestamp count, the
// noise gate, the contrast gate, the size floor, the data-quality drop, and the
// "measured 0 is not null" / "negative is reported as-is" rules. created_at uses
// epoch-ms numbers so depth = count(memory <= bet ms) is exact and deterministic.
describe("computeMemoryLift", () => {
  const mk = (verdict: string, ms: number): ReviewedOutcome => ({ verdict, created_at: ms });
  const repeat = (verdict: string, ms: number, count: number): ReviewedOutcome[] =>
    Array.from({ length: count }, () => mk(verdict, ms));
  // Memory dated 1..12; a bet at ms=0 has depth 0, a bet at ms=100 has depth 12.
  const mem12 = Array.from({ length: 12 }, (_, i) => i + 1);

  test("empty outcomes -> not-enough-outcomes, zeroed", () => {
    expect(computeMemoryLift([], [])).toMatchObject({
      liftPoints: null,
      reason: "not-enough-outcomes",
      sparseN: 0,
      richN: 0,
      swingPoints: 0,
      depthGap: 0,
    });
  });

  test("N=15 is below the 8/side floor (one half is 7)", () => {
    const outcomes = [...repeat("validated", 0, 7), ...repeat("validated", 100, 8)];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.reason).toBe("not-enough-outcomes");
    expect(r.liftPoints).toBeNull();
  });

  test("clean strong lift: sparse 3/8 vs rich 7/8, depth 0 vs 12 -> +50 pts, swing 13", () => {
    const outcomes = [
      ...repeat("validated", 0, 3),
      ...repeat("missed", 0, 5),
      ...repeat("validated", 100, 7),
      ...repeat("missed", 100, 1),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.liftPoints).toBe(50);
    expect(r.reason).toBeNull();
    expect(r.sparseRate).toBeCloseTo(0.375, 5);
    expect(r.richRate).toBeCloseTo(0.875, 5);
    expect(r.sparseN).toBe(8);
    expect(r.richN).toBe(8);
    expect(r.swingPoints).toBe(13);
    expect(r.depthGap).toBe(12);
  });

  test("a depthGap of 1 is too small (medians 5 vs 6) -> depth-contrast-too-small", () => {
    const mem6 = [1, 2, 3, 4, 5, 6];
    // bets at ms=5 -> depth 5; at ms=6 -> depth 6.
    const outcomes = [...repeat("validated", 5, 8), ...repeat("missed", 6, 8)];
    const r = computeMemoryLift(outcomes, mem6);
    expect(r.reason).toBe("depth-contrast-too-small");
    expect(r.liftPoints).toBeNull();
    expect(r.depthGap).toBe(1);
  });

  test("medians 0 vs 2 (gap 2 < 3) is too small even though rich >= 2", () => {
    const mem2 = [1, 2];
    // bets at ms=0 -> depth 0; at ms=2 -> depth 2.
    const outcomes = [...repeat("validated", 0, 8), ...repeat("validated", 2, 8)];
    const r = computeMemoryLift(outcomes, mem2);
    expect(r.reason).toBe("depth-contrast-too-small");
    expect(r.depthGap).toBe(2);
  });

  test("empty store (all depth 0) -> depth-contrast-too-small", () => {
    const outcomes = [...repeat("validated", 0, 8), ...repeat("validated", 0, 8)];
    const r = computeMemoryLift(outcomes, []);
    expect(r.reason).toBe("depth-contrast-too-small");
    expect(r.depthGap).toBe(0);
  });

  test("a small difference inside the 95% CI -> lift-within-noise, rates still returned", () => {
    // sparse 9/10, rich 10/10, rawDiff 0.1; margin (~0.19) exceeds it.
    const outcomes = [
      ...repeat("validated", 0, 9),
      ...repeat("missed", 0, 1),
      ...repeat("validated", 100, 10),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.reason).toBe("lift-within-noise");
    expect(r.liftPoints).toBeNull();
    expect(r.sparseRate).toBeCloseTo(0.9, 5);
    expect(r.richRate).toBeCloseTo(1.0, 5);
    expect(r.sparseN).toBe(10);
    expect(r.richN).toBe(10);
  });

  test("both halves all-validated is a genuine measured 0, never null", () => {
    const outcomes = [...repeat("validated", 0, 10), ...repeat("validated", 100, 10)];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.liftPoints).toBe(0);
    expect(r.reason).toBeNull();
  });

  test("perfect separation 0/10 vs 10/10 publishes +100 (se=0, clears one-outcome resolution)", () => {
    const outcomes = [...repeat("missed", 0, 10), ...repeat("validated", 100, 10)];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.liftPoints).toBe(100);
    expect(r.reason).toBeNull();
  });

  test("a negative difference is reported as-is, never floored or flipped", () => {
    // sparse 10/10, rich 4/10, rawDiff -0.6 clears the noise gate.
    const outcomes = [
      ...repeat("validated", 0, 10),
      ...repeat("validated", 100, 4),
      ...repeat("missed", 100, 6),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.liftPoints).toBe(-60);
    expect(r.reason).toBeNull();
  });

  test("> 20% unparseable timestamps -> data-quality (the implied N must equal the used N)", () => {
    const outcomes = [
      ...repeat("validated", 0, 7),
      ...repeat("validated", 100, 7),
      ...Array.from({ length: 6 }, () => mk("validated", "not-a-date" as unknown as number)),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.reason).toBe("data-quality");
    expect(r.liftPoints).toBeNull();
    expect(r.droppedOutcomes).toBe(6);
  });

  test("one bad timestamp among 17 (< 20%) is dropped, the rest compute normally", () => {
    const outcomes = [
      ...repeat("validated", 0, 3),
      ...repeat("missed", 0, 5),
      ...repeat("validated", 100, 7),
      ...repeat("missed", 100, 1),
      mk("validated", "garbage" as unknown as number),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.droppedOutcomes).toBe(1);
    expect(r.liftPoints).toBe(50);
    expect(r.reason).toBeNull();
  });

  test("mixed counts in the denominator but never as a validation", () => {
    const outcomes = [
      ...repeat("validated", 0, 4),
      ...repeat("missed", 0, 2),
      ...repeat("mixed", 0, 2),
      ...repeat("validated", 100, 8),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.sparseRate).toBeCloseTo(0.5, 5); // 4 validated of 8, the 2 mixed are not validations
  });

  test("a non-terminal verdict is filtered out of the cut, not dropped-for-timestamp", () => {
    const outcomes = [
      ...repeat("validated", 0, 3),
      ...repeat("missed", 0, 5),
      ...repeat("validated", 100, 7),
      ...repeat("missed", 100, 1),
      mk("draft", 50), // ignored entirely
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.liftPoints).toBe(50);
    expect(r.droppedOutcomes).toBe(0);
    expect(r.sparseN).toBe(8);
    expect(r.richN).toBe(8);
  });

  test("odd N=17 splits 8/9 (the middle outcome joins the later half) and computes", () => {
    const outcomes = [
      ...repeat("validated", 0, 3),
      ...repeat("missed", 0, 5),
      ...repeat("validated", 100, 8),
      ...repeat("missed", 100, 1),
    ];
    const r = computeMemoryLift(outcomes, mem12);
    expect(r.sparseN).toBe(8);
    expect(r.richN).toBe(9);
    expect(r.liftPoints).not.toBeNull();
  });

  test("an unparseable memory timestamp is excluded, never read as 1970", () => {
    const outcomes = [
      ...repeat("validated", 0, 3),
      ...repeat("missed", 0, 5),
      ...repeat("validated", 100, 7),
      ...repeat("missed", 100, 1),
    ];
    const withGarbage = computeMemoryLift(outcomes, ["bad", null, undefined, ...mem12]);
    const clean = computeMemoryLift(outcomes, mem12);
    expect(withGarbage.liftPoints).toBe(clean.liftPoints);
    expect(withGarbage.depthGap).toBe(clean.depthGap);
  });

  test("never throws on a mix of null/undefined/string/number inputs (totality)", () => {
    expect(() =>
      computeMemoryLift(
        [
          { verdict: "validated", created_at: null as unknown as number },
          { verdict: "x", created_at: undefined as unknown as number },
          { verdict: "missed", created_at: "2020-01-01" },
        ],
        [null, undefined, "bad", 123, "2020-01-01"],
      ),
    ).not.toThrow();
  });
});

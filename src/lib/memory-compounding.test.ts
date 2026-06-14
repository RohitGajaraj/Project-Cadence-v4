import { describe, expect, test } from "bun:test";
import { countPriorityMoves, reuseRate } from "./memory-compounding";

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

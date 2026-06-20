import { describe, expect, test } from "bun:test";
import {
  type CompoundingLearning,
  describeCompounding,
  iceNum,
  rescoresOf,
  summarizeCompounding,
} from "./moat-vis";

// `in` checks (not `??`) so an EXPLICIT null prior_ice/new_ice is preserved
// rather than coerced to the default — the null-ICE cases depend on it.
const learning = (over: Partial<CompoundingLearning> = {}): CompoundingLearning => ({
  id: over.id ?? "l1",
  verdict: over.verdict ?? "validated",
  summary: over.summary ?? "what happened",
  opportunity_title: over.opportunity_title ?? "Checkout redesign",
  prior_ice: "prior_ice" in over ? (over.prior_ice as number | string | null) : 5,
  new_ice: "new_ice" in over ? (over.new_ice as number | string | null) : 7,
  created_at: over.created_at ?? "2026-06-20T00:00:00Z",
});

describe("iceNum (numeric coercion)", () => {
  test("passes through numbers, parses strings, rejects null/NaN", () => {
    expect(iceNum(5)).toBe(5);
    expect(iceNum("6.5")).toBe(6.5);
    expect(iceNum(null)).toBeNull();
    expect(iceNum(undefined)).toBeNull();
    expect(iceNum("not a number")).toBeNull();
  });
});

describe("rescoresOf (only actual moves)", () => {
  test("keeps moves, drops null-ICE and unchanged, resolves delta + string ICE", () => {
    const out = rescoresOf([
      learning({ id: "up", prior_ice: 5, new_ice: 7 }),
      learning({ id: "down", prior_ice: "6", new_ice: "4" }), // string numerics
      learning({ id: "same", prior_ice: 5, new_ice: 5 }), // unchanged → drop
      learning({ id: "no-ice", prior_ice: null, new_ice: 7 }), // not a rescore → drop
    ]);
    expect(out.map((r) => r.id)).toEqual(["up", "down"]);
    expect(out[0].delta).toBe(2);
    expect(out[1].delta).toBe(-2);
  });
});

describe("summarizeCompounding", () => {
  test("counts up/down, nets the lift, tallies verdicts", () => {
    const s = summarizeCompounding([
      learning({ id: "a", verdict: "validated", prior_ice: 5, new_ice: 7 }), // +2 up
      learning({ id: "b", verdict: "missed", prior_ice: 6, new_ice: 4 }), // -2 down
      learning({ id: "c", verdict: "validated", prior_ice: 5, new_ice: 6 }), // +1 up
      learning({ id: "d", verdict: "mixed", prior_ice: 5, new_ice: 5 }), // unchanged → not a rescore
    ]);
    expect(s.rescoreCount).toBe(3);
    expect(s.movedUp).toBe(2);
    expect(s.movedDown).toBe(1);
    expect(s.netIceLift).toBe(1); // +2 -2 +1
    expect(s.validatedCount).toBe(2);
    expect(s.missedCount).toBe(1);
    expect(s.mixedCount).toBe(0);
  });

  test("latest is by created_at, not input order", () => {
    const s = summarizeCompounding([
      learning({ id: "old", created_at: "2026-06-01T00:00:00Z", prior_ice: 5, new_ice: 6 }),
      learning({ id: "new", created_at: "2026-06-20T00:00:00Z", prior_ice: 5, new_ice: 8 }),
      learning({ id: "mid", created_at: "2026-06-10T00:00:00Z", prior_ice: 5, new_ice: 7 }),
    ]);
    expect(s.latest?.id).toBe("new");
  });

  test("no rescores → an all-zero summary, null latest", () => {
    const s = summarizeCompounding([learning({ prior_ice: null, new_ice: null })]);
    expect(s).toEqual({
      rescoreCount: 0,
      movedUp: 0,
      movedDown: 0,
      netIceLift: 0,
      validatedCount: 0,
      missedCount: 0,
      mixedCount: 0,
      latest: null,
    });
  });

  test("nets at display precision: each move is rounded before summing", () => {
    const s = summarizeCompounding([
      learning({ id: "a", prior_ice: 5, new_ice: 5.33 }), // rounds 5.0→5.3, delta +0.3
      learning({ id: "b", prior_ice: 5, new_ice: 5.34 }), // rounds 5.0→5.3, delta +0.3
    ]);
    expect(s.netIceLift).toBe(0.6); // 0.3 + 0.3
  });

  test("a sub-0.1 drift is NOT a move (honesty: never show 8.3 → 8.3 as a change)", () => {
    const s = summarizeCompounding([learning({ prior_ice: 8.34, new_ice: 8.31 })]);
    expect(s.rescoreCount).toBe(0);
    expect(s.latest).toBeNull();
  });
});

describe("describeCompounding (honest, neutral)", () => {
  test("null when nothing re-scored", () => {
    expect(describeCompounding(summarizeCompounding([]))).toBeNull();
  });

  test("singular vs plural + signed net direction", () => {
    const one = describeCompounding(summarizeCompounding([learning({ prior_ice: 5, new_ice: 7 })]));
    expect(one).toBe("Memory has re-scored 1 decision from real outcomes · net ICE +2.0.");

    const down = describeCompounding(
      summarizeCompounding([
        learning({ id: "a", prior_ice: 6, new_ice: 4 }),
        learning({ id: "b", prior_ice: 5, new_ice: 6 }),
      ]),
    );
    expect(down).toBe("Memory has re-scored 2 decisions from real outcomes · net ICE -1.0.");
  });

  test("net unchanged phrasing when ups and downs cancel", () => {
    const flat = describeCompounding(
      summarizeCompounding([
        learning({ id: "a", prior_ice: 5, new_ice: 7 }),
        learning({ id: "b", prior_ice: 7, new_ice: 5 }),
      ]),
    );
    expect(flat).toBe("Memory has re-scored 2 decisions from real outcomes · net ICE unchanged.");
  });
});

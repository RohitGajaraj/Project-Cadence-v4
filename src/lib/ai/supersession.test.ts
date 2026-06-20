import { describe, expect, test } from "bun:test";
import {
  SUPERSESSION_AGENT,
  SUPERSESSION_MAX,
  SUPERSESSION_THRESHOLD,
  buildSupersessionEdge,
  classifySupersession,
  resolveEndpoints,
  selectSupersessions,
} from "./supersession";

describe("classifySupersession (the pure verdict-conflict matrix)", () => {
  const hi = 0.9;

  test("a fresh failure contradicts a prior success-belief", () => {
    expect(classifySupersession("missed", "validated", hi)).toBe("contradicts");
    expect(classifySupersession("missed", "mixed", hi)).toBe("contradicts");
  });

  test("a fresh success supersedes a prior failure-belief", () => {
    expect(classifySupersession("validated", "missed", hi)).toBe("supersedes");
  });

  test("same verdict never asserts an edge", () => {
    expect(classifySupersession("validated", "validated", hi)).toBeNull();
    expect(classifySupersession("missed", "missed", hi)).toBeNull();
    expect(classifySupersession("mixed", "mixed", hi)).toBeNull();
  });

  test("a mixed NEW verdict never asserts (too ambiguous to retire a belief)", () => {
    expect(classifySupersession("mixed", "validated", hi)).toBeNull();
    expect(classifySupersession("mixed", "missed", hi)).toBeNull();
  });

  test("non-conflict success/mixed pairings stay null", () => {
    // a fresh success vs a prior success/mixed is not a conflict
    expect(classifySupersession("validated", "mixed", hi)).toBeNull();
  });

  test("below the similarity threshold → null even on a real conflict", () => {
    expect(classifySupersession("missed", "validated", SUPERSESSION_THRESHOLD - 0.01)).toBeNull();
    // exactly at the threshold still asserts
    expect(classifySupersession("missed", "validated", SUPERSESSION_THRESHOLD)).toBe("contradicts");
  });

  test("NaN / unknown verdicts never throw and never assert", () => {
    expect(classifySupersession("missed", "validated", Number.NaN)).toBeNull();
    expect(classifySupersession("weird", "validated", hi)).toBeNull();
    expect(classifySupersession("missed", "weird", hi)).toBeNull();
  });
});

describe("resolveEndpoints (same-kind, distinct, new→prior)", () => {
  test("prefers prd↔prd when both sides have a prd", () => {
    const ep = resolveEndpoints(
      { prdId: "new-prd", opportunityId: "new-opp" },
      { prdId: "old-prd", opportunityId: "old-opp" },
    );
    expect(ep).toEqual({
      parent: { kind: "prd", id: "new-prd" },
      child: { kind: "prd", id: "old-prd" },
    });
  });

  test("falls back to opportunity↔opportunity when a prd is missing", () => {
    const ep = resolveEndpoints(
      { prdId: null, opportunityId: "new-opp" },
      { prdId: "old-prd", opportunityId: "old-opp" },
    );
    expect(ep).toEqual({
      parent: { kind: "opportunity", id: "new-opp" },
      child: { kind: "opportunity", id: "old-opp" },
    });
  });

  test("never creates a self-edge (same id) and never crosses kinds", () => {
    expect(
      resolveEndpoints({ prdId: "p", opportunityId: null }, { prdId: "p", opportunityId: null }),
    ).toBeNull();
    // new has only a prd, prior has only an opportunity → no same-kind pair
    expect(
      resolveEndpoints({ prdId: "p", opportunityId: null }, { prdId: null, opportunityId: "o" }),
    ).toBeNull();
  });
});

describe("buildSupersessionEdge (the row to upsert)", () => {
  test("stamps the engine agent, inference provenance, and a clamped rationale", () => {
    const edge = buildSupersessionEdge({
      userId: "u1",
      parent: { kind: "prd", id: "new" },
      child: { kind: "prd", id: "old" },
      relation: "contradicts",
      verdict: "missed",
      score: 0.77,
      summary: "x".repeat(900),
      aiEventId: null,
    });
    expect(edge.created_by_agent).toBe(SUPERSESSION_AGENT);
    expect(edge.relation).toBe("contradicts");
    expect(edge.parent_id).toBe("new");
    expect(edge.child_id).toBe("old");
    expect(edge.rationale?.length).toBe(500); // clamped
    // A (re)asserted edge is always stamped current, so an upsert resets a previously
    // retired row back to valid (no zombie edge on re-record).
    expect(edge.valid_to).toBeNull();
    expect(edge.invalidated_by).toBeNull();
    expect(edge.inference).toEqual({
      verdict: "missed",
      score: 0.77,
      source: SUPERSESSION_AGENT,
      ai_event_id: null,
    });
  });

  test("a null summary yields a null rationale (no empty string)", () => {
    const edge = buildSupersessionEdge({
      userId: "u1",
      parent: { kind: "opportunity", id: "a" },
      child: { kind: "opportunity", id: "b" },
      relation: "supersedes",
      verdict: "validated",
      score: 0.5,
      summary: null,
    });
    expect(edge.rationale).toBeNull();
  });
});

describe("selectSupersessions (classify + resolve + cap)", () => {
  const next = { prdId: "new-prd", opportunityId: "new-opp", verdict: "missed" };

  test("keeps only the conflicts, in candidate order", () => {
    const out = selectSupersessions(next, [
      { prdId: "p1", opportunityId: "o1", verdict: "validated", score: 0.9 }, // conflict
      { prdId: "p2", opportunityId: "o2", verdict: "missed", score: 0.8 }, // same verdict → drop
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].relation).toBe("contradicts");
    expect(out[0].child).toEqual({ kind: "prd", id: "p1" });
  });

  test("caps at SUPERSESSION_MAX even with many conflicts", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      prdId: `p${i}`,
      opportunityId: `o${i}`,
      verdict: "validated",
      score: 0.9 - i * 0.01,
    }));
    const out = selectSupersessions(next, many);
    expect(out).toHaveLength(SUPERSESSION_MAX);
  });

  test("drops candidates with no same-kind endpoint", () => {
    const out = selectSupersessions({ prdId: null, opportunityId: "new-opp", verdict: "missed" }, [
      { prdId: "p1", opportunityId: null, verdict: "validated", score: 0.9 },
    ]);
    expect(out).toHaveLength(0);
  });

  test("empty candidate list → empty selection", () => {
    expect(selectSupersessions(next, [])).toEqual([]);
  });

  test("dedups candidates that resolve to the same edge, keeping the highest score", () => {
    // Two distinct prior candidates sharing one opportunity_id (the un-deduped fallback
    // path) collapse to ONE opportunity↔opportunity edge; the higher-score one wins and a
    // duplicate must not waste a cap slot.
    const out = selectSupersessions({ prdId: null, opportunityId: "new-opp", verdict: "missed" }, [
      { prdId: null, opportunityId: "shared-opp", verdict: "validated", score: 0.9 },
      { prdId: null, opportunityId: "shared-opp", verdict: "validated", score: 0.5 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(0.9);
    expect(out[0].child).toEqual({ kind: "opportunity", id: "shared-opp" });
  });
});

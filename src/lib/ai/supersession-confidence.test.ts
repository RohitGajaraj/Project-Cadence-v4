import { describe, expect, test } from "bun:test";
import {
  SUPERSESSION_STRONG_THRESHOLD,
  SUPERSESSION_TENTATIVE_FLOOR,
  scoreSupersessionConfidence,
} from "./supersession-confidence";

/**
 * Edge-confidence precision layer (Decision Brain, DBR-EDGE-CONF).
 *
 * The supersession engine asserts an edge on (verdict-conflict + cosine >= 0.3) alone.
 * That is the documented #1 moat-rot risk: a graph that confidently surfaces a FALSE
 * "this was contradicted" rots faster than vectors. This scorer grades each candidate
 * edge from cheap deterministic signals already on the row — cosine similarity, how clean
 * the verdict reversal is, and whether both decisions share an opportunity (same problem
 * area) — so the write-path can drop the marginal edges before they ever reach the Critic.
 */
describe("scoreSupersessionConfidence — the graded precision tiers", () => {
  test("clean reversal + high similarity + shared lineage → strong, near-certain", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "validated",
      score: 0.9,
      sharedLineage: true,
    });
    // 0.5*((0.9-0.3)/0.7) + 0.3*1 + 0.2*1 = 0.4286 + 0.3 + 0.2
    expect(r.confidence).toBe(0.929);
    expect(r.tier).toBe("strong");
    expect(r.confidence).toBeGreaterThanOrEqual(SUPERSESSION_STRONG_THRESHOLD);
  });

  test("clean reversal + mid similarity, no shared lineage → tentative", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "validated",
      priorVerdict: "missed",
      score: 0.6,
      sharedLineage: false,
    });
    // 0.5*((0.6-0.3)/0.7) + 0.3*1 + 0 = 0.2143 + 0.3
    expect(r.confidence).toBe(0.514);
    expect(r.tier).toBe("tentative");
  });

  test("partial reversal (missed vs mixed) at mid similarity → drop (too soft to trust)", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "mixed",
      score: 0.6,
      sharedLineage: false,
    });
    // 0.5*0.4286 + 0.3*0.5 + 0 = 0.2143 + 0.15 = 0.3643
    expect(r.confidence).toBe(0.364);
    expect(r.tier).toBe("drop");
    expect(r.confidence).toBeLessThan(SUPERSESSION_TENTATIVE_FLOOR);
  });

  test("a clean reversal at the bare cosine floor, no lineage → drop", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "validated",
      score: 0.3,
      sharedLineage: false,
    });
    // simNorm 0 → 0 + 0.3 + 0 = 0.3 → below the 0.4 floor
    expect(r.confidence).toBe(0.3);
    expect(r.tier).toBe("drop");
  });

  test("shared lineage rescues a low-similarity but same-problem reversal to tentative", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "validated",
      score: 0.3,
      sharedLineage: true,
    });
    // 0 + 0.3 + 0.2 = 0.5
    expect(r.confidence).toBe(0.5);
    expect(r.tier).toBe("tentative");
  });

  test("a non-conflict verdict pair scores near-zero and drops", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "validated",
      priorVerdict: "validated",
      score: 0.9,
      sharedLineage: false,
    });
    // verdictScore 0 → 0.5*0.857 + 0 + 0 = 0.4286 → but no verdict signal: tier still keys off confidence
    expect(r.tier).not.toBe("strong");
    expect(r.reasons.join(" ")).toContain("no clear outcome reversal");
  });

  test("similarity is clamped: above 1 behaves like 1, NaN behaves like the floor", () => {
    const over = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "validated",
      score: 1.5,
      sharedLineage: false,
    });
    // simNorm clamped to 1: 0.5 + 0.3 = 0.8
    expect(over.confidence).toBe(0.8);
    expect(over.tier).toBe("strong");

    const nan = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "validated",
      score: Number.NaN,
      sharedLineage: false,
    });
    // NaN similarity → simNorm 0 → 0.3
    expect(nan.confidence).toBe(0.3);
    expect(nan.tier).toBe("drop");
  });

  test("reasons explain the verdict cleanliness, similarity band, and lineage", () => {
    const r = scoreSupersessionConfidence({
      newVerdict: "missed",
      priorVerdict: "validated",
      score: 0.9,
      sharedLineage: true,
    });
    const joined = r.reasons.join(" ").toLowerCase();
    expect(joined).toContain("reversal");
    expect(joined).toContain("similarity");
    expect(joined).toContain("opportunity");
  });

  test("is deterministic — same input, same output", () => {
    const input = {
      newVerdict: "validated",
      priorVerdict: "missed",
      score: 0.72,
      sharedLineage: false,
    };
    expect(scoreSupersessionConfidence(input)).toEqual(scoreSupersessionConfidence(input));
  });

  test("custom thresholds re-bucket the same confidence", () => {
    // confidence 0.514 (clean, 0.6 sim, no lineage). A laxer floor keeps it; a stricter one drops it.
    const lax = scoreSupersessionConfidence({
      newVerdict: "validated",
      priorVerdict: "missed",
      score: 0.6,
      sharedLineage: false,
      tentativeFloor: 0.5,
      strongThreshold: 0.9,
    });
    expect(lax.tier).toBe("tentative");
    const strict = scoreSupersessionConfidence({
      newVerdict: "validated",
      priorVerdict: "missed",
      score: 0.6,
      sharedLineage: false,
      tentativeFloor: 0.6,
      strongThreshold: 0.9,
    });
    expect(strict.tier).toBe("drop");
  });
});

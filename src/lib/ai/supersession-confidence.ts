/**
 * Supersession edge-confidence — PURE precision layer (Decision Brain, DBR-EDGE-CONF).
 *
 * The supersession engine (supersession.ts) asserts a typed supersedes/contradicts edge on
 * (verdict-conflict + cosine >= 0.3) alone. That is the documented #1 moat-rot risk: a graph
 * that confidently surfaces a FALSE "this was contradicted" rots faster than vectors, and the
 * Critic's receipts — the felt surface of the whole moat — are only as trustworthy as the
 * weakest edge it cites. This module grades each candidate edge from cheap deterministic
 * signals already on the row, so the write-path can drop the marginal edges BEFORE they ever
 * reach the Critic, and stamp a tier the read side can later down-weight.
 *
 * No db, no network, no AI — fully offline-verifiable. Three signals, weighted:
 *   - semantic similarity (cosine), normalized over the assert floor → the strongest signal;
 *   - verdict-reversal cleanliness (a missed↔validated flip is a harder claim than missed↔mixed);
 *   - shared opportunity lineage (both decisions about the SAME problem area), which makes a
 *     reversal far likelier to be real than a coincidental cross-topic semantic match.
 */

export type SupersessionConfidenceTier = "strong" | "tentative" | "drop";

/** Confidence at/above which an edge is trustworthy enough to cite without caveat. */
export const SUPERSESSION_STRONG_THRESHOLD = 0.6;
/** Confidence below which an edge is too marginal to write at all (the precision floor). */
export const SUPERSESSION_TENTATIVE_FLOOR = 0.4;

/** Default cosine floor used to normalize similarity; mirrors SUPERSESSION_THRESHOLD. */
const DEFAULT_SIM_FLOOR = 0.3;

// Signal weights (sum to 1). Similarity leads; a clean reversal and shared lineage refine it.
const W_SIM = 0.5;
const W_VERDICT = 0.3;
const W_LINEAGE = 0.2;

export type SupersessionConfidenceInput = {
  /** The freshly-recorded outcome's verdict. */
  newVerdict: string;
  /** The prior decision's verdict being revised. */
  priorVerdict: string;
  /** Cosine similarity (1 - distance) between the two decisions. */
  score: number;
  /** True when both decisions trace to the same opportunity (same problem area). */
  sharedLineage: boolean;
  /** Cosine floor to normalize against (default mirrors SUPERSESSION_THRESHOLD). */
  simThreshold?: number;
  /** Override the strong/tentative cutoffs (for tuning on live precision/recall). */
  strongThreshold?: number;
  tentativeFloor?: number;
};

export type SupersessionConfidence = {
  /** 0..1, rounded to 3 dp. */
  confidence: number;
  tier: SupersessionConfidenceTier;
  /** Human-readable, deterministic explanation of each contributing signal. */
  reasons: string[];
};

const clamp01 = (n: number): number => (n < 0 || Number.isNaN(n) ? 0 : n > 1 ? 1 : n);
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * PURE. How clean the verdict reversal is: a full flip (missed↔validated) is the hardest,
 * most trustworthy claim; a soft flip (missed↔mixed) is weaker; anything else is no real
 * reversal. Mirrors classifySupersession's conflict matrix.
 */
function verdictReversalStrength(
  newVerdict: string,
  priorVerdict: string,
): { score: number; kind: "clean" | "partial" | "none" } {
  if (newVerdict === "missed" && priorVerdict === "validated") return { score: 1, kind: "clean" };
  if (newVerdict === "validated" && priorVerdict === "missed") return { score: 1, kind: "clean" };
  if (newVerdict === "missed" && priorVerdict === "mixed") return { score: 0.5, kind: "partial" };
  return { score: 0, kind: "none" };
}

/**
 * PURE. Grade a candidate supersession edge into a confidence + tier + reasons.
 * Deterministic and total: never throws, NaN similarity reads as the floor (0 contribution).
 */
export function scoreSupersessionConfidence(
  input: SupersessionConfidenceInput,
): SupersessionConfidence {
  const simFloor = input.simThreshold ?? DEFAULT_SIM_FLOOR;
  const strong = input.strongThreshold ?? SUPERSESSION_STRONG_THRESHOLD;
  const floor = input.tentativeFloor ?? SUPERSESSION_TENTATIVE_FLOOR;

  // Normalize cosine over [floor, 1] → [0, 1]; below-floor / NaN contribute nothing.
  const denom = 1 - simFloor;
  const simNorm = denom > 0 ? clamp01((input.score - simFloor) / denom) : 0;

  const verdict = verdictReversalStrength(input.newVerdict, input.priorVerdict);
  const lineage = input.sharedLineage ? 1 : 0;

  const confidence = round3(W_SIM * simNorm + W_VERDICT * verdict.score + W_LINEAGE * lineage);
  const tier: SupersessionConfidenceTier =
    confidence >= strong ? "strong" : confidence >= floor ? "tentative" : "drop";

  const reasons: string[] = [];
  if (verdict.kind === "clean") {
    reasons.push(`clean outcome reversal (${input.newVerdict} vs ${input.priorVerdict})`);
  } else if (verdict.kind === "partial") {
    reasons.push(`partial outcome reversal (${input.newVerdict} vs ${input.priorVerdict})`);
  } else {
    reasons.push("no clear outcome reversal");
  }
  const simBand = simNorm >= 0.66 ? "high" : simNorm >= 0.33 ? "moderate" : "low";
  reasons.push(`${simBand} semantic similarity (${input.score})`);
  if (input.sharedLineage) reasons.push("same opportunity lineage (same problem area)");

  return { confidence, tier, reasons };
}

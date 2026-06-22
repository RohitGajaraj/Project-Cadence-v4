/**
 * Supersession engine — PURE core (Decision Brain, DBR-1.5).
 *
 * The moat's signature mechanic: when a human records a decision's real-world
 * outcome, infer typed supersedes/contradicts edges between the account's OWN past
 * decisions, written bi-temporally (invalidate-don't-delete). This module is the
 * pure, offline-verifiable heart: no db, no network, no AI. The gated orchestrator
 * (supersession.server.ts) supplies the semantic candidates (one embed) and performs
 * the writes.
 *
 * Verdict vocabulary mirrors OutcomeVerdict ("validated" | "missed" | "mixed").
 * Conservative by design: only a verdict CONFLICT above the similarity floor asserts
 * an edge, so the graph never fills with weak or same-verdict links.
 */

import {
  type SupersessionConfidenceTier,
  scoreSupersessionConfidence,
} from "./supersession-confidence";

export type SupersessionRelation = "supersedes" | "contradicts";

/** A same-kind artifact_lineage endpoint. Edges never cross kinds. */
export type ArtifactRef = { kind: "prd" | "opportunity"; id: string };

/** Similarity floor (1 - cosine distance) below which we never assert an edge. */
export const SUPERSESSION_THRESHOLD = 0.3;
/** Hard cap on edges written per recorded outcome — one outcome never spams the graph. */
export const SUPERSESSION_MAX = 2;
/** created_by_agent stamp; also the guard that bounds which edges we may ever retire. */
export const SUPERSESSION_AGENT = "supersession-engine";

/**
 * PURE. Decide whether a freshly recorded outcome's verdict supersedes or contradicts
 * a prior decision's verdict, given their semantic similarity. Returns null (no edge)
 * for below-threshold scores (incl. NaN), same verdicts, and any non-conflict pairing.
 */
export function classifySupersession(
  newVerdict: string,
  priorVerdict: string,
  score: number,
  threshold: number = SUPERSESSION_THRESHOLD,
): SupersessionRelation | null {
  // `>=` (not `< return null`) so NaN — never `>= threshold` — also yields null.
  if (!(score >= threshold)) return null;
  // a fresh failure contradicts a prior success-belief
  if (newVerdict === "missed" && (priorVerdict === "validated" || priorVerdict === "mixed")) {
    return "contradicts";
  }
  // a fresh success supersedes the prior failure-belief on the revisited approach
  if (newVerdict === "validated" && priorVerdict === "missed") {
    return "supersedes";
  }
  return null;
}

/**
 * PURE. Resolve a (new outcome, prior decision) pair to a same-kind endpoint pair,
 * preferring prd↔prd and falling back to opportunity↔opportunity. The new outcome is
 * the parent, the prior belief the child (founder-decision-point #1). Returns null when
 * there is no same-kind, distinct (non-self) endpoint pair.
 */
export function resolveEndpoints(
  next: { prdId: string | null; opportunityId: string | null },
  prior: { prdId: string | null; opportunityId: string | null },
): { parent: ArtifactRef; child: ArtifactRef } | null {
  if (next.prdId && prior.prdId && next.prdId !== prior.prdId) {
    return { parent: { kind: "prd", id: next.prdId }, child: { kind: "prd", id: prior.prdId } };
  }
  if (next.opportunityId && prior.opportunityId && next.opportunityId !== prior.opportunityId) {
    return {
      parent: { kind: "opportunity", id: next.opportunityId },
      child: { kind: "opportunity", id: prior.opportunityId },
    };
  }
  return null;
}

/** The fully-resolved, ready-to-write edge fields (shape mirrors artifact_lineage). */
export type SupersessionEdge = {
  user_id: string;
  parent_kind: ArtifactRef["kind"];
  parent_id: string;
  child_kind: ArtifactRef["kind"];
  child_id: string;
  relation: SupersessionRelation;
  rationale: string | null;
  created_by_agent: string;
  // Always null on a (re)asserted edge: a freshly written edge is current by definition.
  // Including them in the upsert payload guarantees that ON CONFLICT DO UPDATE resets a
  // previously-retired row back to valid, so a re-recorded outcome never leaves a "zombie"
  // edge stamped retired while it is actually the current belief.
  valid_to: null;
  invalidated_by: null;
  inference: {
    verdict: string;
    score: number;
    source: string;
    ai_event_id: string | null;
    // Edge-confidence provenance (DBR-EDGE-CONF). Present only when the caller scored the
    // edge, so a confidence-unaware caller's row stays byte-identical to the original shape.
    confidence?: number;
    tier?: SupersessionConfidenceTier;
    reasons?: string[];
  };
};

/** PURE. Map a resolved endpoint pair + relation + provenance to the row to upsert. */
export function buildSupersessionEdge(args: {
  userId: string;
  parent: ArtifactRef;
  child: ArtifactRef;
  relation: SupersessionRelation;
  verdict: string;
  score: number;
  summary?: string | null;
  aiEventId?: string | null;
  confidence?: number;
  tier?: SupersessionConfidenceTier;
  reasons?: string[];
}): SupersessionEdge {
  return {
    user_id: args.userId,
    parent_kind: args.parent.kind,
    parent_id: args.parent.id,
    child_kind: args.child.kind,
    child_id: args.child.id,
    relation: args.relation,
    rationale: args.summary ? args.summary.slice(0, 500) : null,
    created_by_agent: SUPERSESSION_AGENT,
    valid_to: null,
    invalidated_by: null,
    inference: {
      verdict: args.verdict,
      score: args.score,
      source: SUPERSESSION_AGENT,
      ai_event_id: args.aiEventId ?? null,
      ...(typeof args.confidence === "number" ? { confidence: args.confidence } : {}),
      ...(args.tier ? { tier: args.tier } : {}),
      ...(args.reasons && args.reasons.length ? { reasons: args.reasons } : {}),
    },
  };
}

/** A classified, endpoint-resolved candidate the orchestrator will write. */
export type ClassifiedSupersession = {
  parent: ArtifactRef;
  child: ArtifactRef;
  relation: SupersessionRelation;
  score: number;
  priorVerdict: string;
  // Edge-confidence precision (DBR-EDGE-CONF): a graded trust score + tier + reasons, so the
  // orchestrator can drop marginal edges and stamp the survivors for the read side to weight.
  confidence: number;
  tier: SupersessionConfidenceTier;
  reasons: string[];
};

/**
 * PURE. The full selection the orchestrator writes: classify each prior candidate
 * (assumed score-sorted desc by the caller), drop non-conflicts and cross-kind/self
 * pairs, and cap at `max`. Extracted from the orchestrator so the cap + filtering are
 * unit-verifiable with zero db/network.
 */
export function selectSupersessions(
  next: { prdId: string | null; opportunityId: string | null; verdict: string },
  candidates: Array<{
    prdId: string | null;
    opportunityId: string | null;
    verdict: string;
    score: number;
  }>,
  opts: { threshold?: number; max?: number; minConfidence?: number } = {},
): ClassifiedSupersession[] {
  const threshold = opts.threshold ?? SUPERSESSION_THRESHOLD;
  const max = opts.max ?? SUPERSESSION_MAX;
  const out: ClassifiedSupersession[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (out.length >= max) break;
    const relation = classifySupersession(next.verdict, c.verdict, c.score, threshold);
    if (!relation) continue;
    const ep = resolveEndpoints(next, c);
    if (!ep) continue;
    // Dedup resolved endpoint pairs: on the opportunity-fallback path two distinct prior
    // candidates can share one opportunity_id and collapse to the same edge. Candidates
    // arrive score-desc, so the first (highest-score) wins and a duplicate neither wastes
    // a cap slot nor lets a later, lower-score upsert overwrite it.
    const key = `${ep.parent.id}|${ep.child.id}|${relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Edge-confidence precision (DBR-EDGE-CONF). Both decisions share a problem area when they
    // trace to the same opportunity — a far stronger signal than a coincidental semantic match.
    const sharedLineage = !!(
      next.opportunityId &&
      c.opportunityId &&
      next.opportunityId === c.opportunityId
    );
    const { confidence, tier, reasons } = scoreSupersessionConfidence({
      newVerdict: next.verdict,
      priorVerdict: c.verdict,
      score: c.score,
      sharedLineage,
      simThreshold: threshold,
    });
    // Opt-in precision gate: when the orchestrator passes minConfidence, drop the marginal
    // edges BEFORE they are written (a `continue` here, so a drop never consumes a cap slot).
    // Default (undefined) keeps every classified edge → byte-identical to the pre-hardening engine.
    if (opts.minConfidence != null && confidence < opts.minConfidence) continue;
    out.push({
      parent: ep.parent,
      child: ep.child,
      relation,
      score: c.score,
      priorVerdict: c.verdict,
      confidence,
      tier,
      reasons,
    });
  }
  return out;
}

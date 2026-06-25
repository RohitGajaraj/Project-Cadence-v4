/**
 * Edge extractor — PURE core (Decision Brain, DBR-3i).
 *
 * Direct outcome→decision edges: when a human records a PRD outcome, write a
 * typed `validates`/`contradicts` edge between the PRD and the opportunity it
 * was built to test. This closes the visible graph loop and makes loop-closure
 * proof legible in the graph itself rather than only in the supersession walk.
 *
 * Conservative: only `validated` and `missed` assert an edge. `mixed` carries
 * no clean directional signal so nothing is written rather than polluting the graph.
 * Idempotent: the upsert key covers (user_id, parent_kind, parent_id,
 * child_kind, child_id, relation) so re-running on the same PRD is a no-op.
 */

export type OutcomeEdgeRelation = "validates" | "contradicts";

/** PURE. Map an outcome verdict to a graph edge relation, or null for mixed/unknown. */
export function classifyOutcomeEdge(verdict: string): OutcomeEdgeRelation | null {
  if (verdict === "validated") return "validates";
  if (verdict === "missed") return "contradicts";
  return null;
}

export type OutcomeEdge = {
  parent_kind: "prd";
  parent_id: string;
  child_kind: "opportunity";
  child_id: string;
  relation: OutcomeEdgeRelation;
  rationale: string;
  created_by_agent: "outcome-edge-extractor";
};

/**
 * PURE. Build the direct outcome edge fields from a recorded verdict, or null
 * when the verdict is ambiguous (`mixed`) or the opportunity link is absent.
 * Direction: prd (parent) → validates/contradicts → opportunity (child).
 * Reads: "this PRD's outcome validates/contradicts its driving opportunity."
 */
export function buildOutcomeEdge(params: {
  prdId: string;
  opportunityId: string | null;
  verdict: string;
}): OutcomeEdge | null {
  const relation = classifyOutcomeEdge(params.verdict);
  if (!relation || !params.opportunityId) return null;
  return {
    parent_kind: "prd",
    parent_id: params.prdId,
    child_kind: "opportunity",
    child_id: params.opportunityId,
    relation,
    rationale: `Outcome recorded: ${params.verdict}`,
    created_by_agent: "outcome-edge-extractor",
  };
}

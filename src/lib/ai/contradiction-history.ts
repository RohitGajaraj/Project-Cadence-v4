/**
 * DBR-2: the Critic reasons over the typed decision GRAPH (PURE core).
 *
 * The Decision Brain stores outcome-labeled `supersedes` / `contradicts` edges in
 * `artifact_lineage` (written by the DBR-1.5 supersession engine: a LATER outcome
 * invalidating a prior belief, bi-temporally, invalidate-don't-delete). Until now
 * the Critic only read FLAT outcome memories (`loadDecisionPrecedent`); it never
 * walked these typed edges. This module turns the edges that bear on the decision
 * under review (or on the semantically-similar precedents) into a "Contradiction
 * history" block, so the Critic can cite "a decision like this was CONTRADICTED by
 * a later outcome", the query flat RAG structurally cannot answer.
 *
 * PURE: no DB, no network, no AI, unit-verifiable in isolation (the thin loader +
 * the runCritic wiring live in critic.server.ts). Fail-safe by construction: an
 * empty edge set yields no items and an empty block, so the Critic is never blocked
 * and stays byte-identical until the decision graph actually has edges.
 */
import { classifyRelation, isSuperseding, type RawLineageEdge } from "@/lib/knowledge-graph-view";
import { SUPERSESSION_STRONG_THRESHOLD } from "./supersession-confidence";

export type ContradictionItem = {
  edgeId: string;
  relation: "supersedes" | "contradicts";
  parentKind: string;
  parentId: string;
  childKind: string;
  childId: string;
  rationale: string | null;
  createdAt: string | null;
  /** A supersession assertion that a still-later outcome itself reversed (`valid_to` set). */
  retired: boolean;
  /** How the focus set touches this edge: as the later outcome (parent), the prior belief (child), or both. */
  focusRole: "parent" | "child" | "both";
  /**
   * True when this edge touches the decision UNDER REVIEW itself (not only a
   * semantically-similar precedent). Incident edges are the strongest signal and
   * rank first; neighbor edges ("a decision like this one") are weaker and the
   * Critic is told to weigh their relevance.
   */
  incident: boolean;
  /**
   * The supersession engine's edge-confidence (DBR-EDGE-CONF), 0..1, or null for an edge
   * written before the confidence layer. Higher-confidence edges rank first (within the same
   * incident/retired bucket), so the Critic cites the most trustworthy contradictions first.
   */
  confidence: number | null;
};

/**
 * Select the supersession edges that touch any focus id (the decision under review
 * plus its semantically-similar precedents). Dedupes by edge id, ranks CURRENT
 * (non-retired) before retired then newest-first, and caps the result. Pure.
 */
export function selectContradictionHistory(
  edges: readonly RawLineageEdge[],
  focusIds: Iterable<string>,
  opts: { max?: number; targetId?: string } = {},
): ContradictionItem[] {
  const max = opts.max ?? 6;
  const targetId = typeof opts.targetId === "string" ? opts.targetId.trim() : "";
  const focus = new Set<string>();
  for (const id of focusIds) if (typeof id === "string" && id.trim()) focus.add(id.trim());
  if (!focus.size) return [];

  const seen = new Set<string>();
  const items: ContradictionItem[] = [];
  for (const e of edges) {
    if (!e || typeof e.id !== "string") continue;
    const relation = classifyRelation(e.relation);
    if (!isSuperseding(relation)) continue;
    const pIn = focus.has(e.parent_id);
    const cIn = focus.has(e.child_id);
    if (!pIn && !cIn) continue;
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    items.push({
      edgeId: e.id,
      relation: relation === "supersedes" ? "supersedes" : "contradicts",
      parentKind: e.parent_kind,
      parentId: e.parent_id,
      childKind: e.child_kind,
      childId: e.child_id,
      rationale: e.rationale ?? null,
      createdAt: e.created_at ?? null,
      retired: typeof e.valid_to === "string" && e.valid_to.trim().length > 0,
      focusRole: pIn && cIn ? "both" : pIn ? "parent" : "child",
      incident: !!targetId && (e.parent_id === targetId || e.child_id === targetId),
      confidence:
        e.inference && typeof e.inference.confidence === "number" ? e.inference.confidence : null,
    });
  }

  items.sort((a, b) => {
    if (a.incident !== b.incident) return a.incident ? -1 : 1; // edges on the target itself first
    if (a.retired !== b.retired) return a.retired ? 1 : -1; // then current before retired
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (ca !== cb) return cb - ca; // then the more trustworthy edge (higher confidence) first
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? ""); // then newest first
  });
  return items.slice(0, max);
}

/**
 * Render selected contradictions as a compact, bounded "Contradiction history"
 * block for the Critic prompt. Empty input returns "" (the caller omits the
 * block). The framing leads with the red-team signal: a PRIOR belief (the child)
 * that a LATER outcome contradicted/superseded is evidence against repeating its
 * reasoning. Pure.
 */
export function formatContradictionHistory(items: ContradictionItem[]): string {
  if (!items.length) return "";
  const bullets = items.map((it) => {
    const verb = it.relation === "contradicts" ? "CONTRADICTED" : "SUPERSEDED";
    const reversed = it.retired ? " (this assertion was itself later reversed)" : "";
    // Hand the Critic the meaning, not the raw score: a below-strong-confidence edge is
    // flagged so the verdict weighs it less (the felt-voice register for a metric).
    const weak =
      it.confidence != null && it.confidence < SUPERSESSION_STRONG_THRESHOLD
        ? " (weaker signal)"
        : "";
    const why = it.rationale?.trim() ? `: ${it.rationale.trim().slice(0, 200)}` : "";
    if (it.focusRole === "child") {
      // The strongest signal: a PRIOR belief (the child) that a LATER outcome overturned.
      return `- a prior ${it.childKind} (${it.childId}) was ${verb} by a later outcome${reversed}${weak}${why}`;
    }
    // parent / both: the focus is (also) the later outcome that did the overturning. Say
    // "this" only when the edge touches the decision under review (incident); otherwise
    // "a", so a precedent-neighbor edge never reads as if it were the subject's own outcome.
    const subj = it.incident ? "this" : "a";
    return `- ${subj} ${it.parentKind}'s outcome ${verb} a prior ${it.childKind} (${it.childId})${reversed}${weak}${why}`;
  });
  return [
    "Contradiction history (this workspace's OWN decision graph; outcome-labeled supersedes/contradicts edges bearing on this decision or ones like it):",
    ...bullets,
  ].join("\n");
}

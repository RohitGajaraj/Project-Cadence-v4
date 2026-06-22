/**
 * DBR multi-hop: Shared-premise precedent (PURE core, Decision Brain).
 *
 * The graph-over-vectors query flat recall structurally CANNOT answer: "what happened
 * the LAST time a decision rested on the SAME premise as this one?" Flat vectors return
 * what is similar in TEXT; this walks the typed decision graph to find decisions that
 * share a structural PREMISE - they were derived from the same upstream signal /
 * opportunity / theme - then reports the OUTCOME each reached.
 *
 * The walk is two-directional over the DERIVATION relations (`promoted` / `cites` /
 * `derived-from` / `depends-on`, where parent = the source an artifact was derived from):
 *   1. UP   (child -> parent): collect the target's premise ancestors.
 *   2. DOWN (parent -> child): from each premise, the cousins are the OTHER artifacts
 *      descended from it - the ones that share a premise but are not on the target's own
 *      derivation path.
 * A cousin that is a PRD with a recorded outcome (validated / missed / mixed) is a
 * shared-premise precedent. `supersedes` / `contradicts` edges are deliberately excluded
 * here - those are outcome reversals, walked by governing-decision.ts / contradiction-
 * history.ts; this module answers the orthogonal "same premise, what was the fate" query.
 *
 * PURE: no DB, no network, no AI; unit-verifiable in isolation (the bounded DB closures +
 * the runCritic wiring live in shared-premise.server.ts). Fail-safe by construction: a node
 * with no premises, or premises with no outcome-bearing cousins, yields no items and an
 * empty block, so the caller's surface stays byte-identical until the graph has the data.
 */
import { classifyRelation, type RawLineageEdge } from "@/lib/knowledge-graph-view";

/** Relations meaning "this artifact was DERIVED FROM / rests on its parent" (the parent is
 * the premise). Excludes supersedes/contradicts (outcome reversals) and validates. A blank/
 * null relation is stored as `promoted` (recordLineage's default), so it counts. */
const DERIVATION_RELATIONS = new Set(["promoted", "cites", "derived-from", "depends-on"]);

/** Hop cap per direction. The discovery graph is shallow (signal -> opportunity -> prd ->
 * task), so 5 covers the realistic depth while capping a pathological/cyclic graph. */
const MAX_HOPS = 5;
/** Hard node cap so a wide fan-out can never run away inside the pure walk. */
const MAX_NODES = 600;

export type SharedPremiseVerdict = "validated" | "missed" | "mixed";

/** A node's recorded outcome, supplied by the server layer (it lives on `prds.outcome`,
 * not on a graph edge). */
export type SharedPremiseOutcome = {
  verdict: SharedPremiseVerdict;
  summary?: string | null;
  title?: string | null;
  /** ISO timestamp the outcome was checked; used only to order ties (newest first). */
  checkedAt?: string | null;
};

/** A shared-premise precedent: a cousin decision that reached a recorded outcome. */
export type SharedPremisePrecedentItem = {
  kind: string;
  id: string;
  title: string | null;
  verdict: SharedPremiseVerdict;
  summary: string | null;
  checkedAt: string | null;
  /** The premise this precedent SHARES with the decision under review (the closest common
   * derivation ancestor). The kind/id come from the pure walk; the human title is resolved
   * server-side (null until then, or when it cannot resolve), so a surface can name it. */
  premiseKind?: string | null;
  premiseId?: string | null;
  premiseTitle?: string | null;
};

/** A derivation edge that contributes to the premise walk (parent = premise, child =
 * derived). Self-loops and non-derivation relations are rejected. */
export function isDerivationEdge(e: RawLineageEdge | null | undefined): e is RawLineageEdge {
  if (!e || typeof e.parent_id !== "string" || typeof e.child_id !== "string") return false;
  if (!e.parent_id || !e.child_id || e.parent_id === e.child_id) return false;
  return DERIVATION_RELATIONS.has(classifyRelation(e.relation));
}

/**
 * PURE. Walk UP (child -> parent) over derivation edges from the target to collect its
 * premise-ancestor ids. Cycle-guarded (a node is never revisited) and hop/node-capped.
 * Excludes the target itself. Order is breadth-first (nearest premises first).
 */
export function collectPremiseAncestors(
  targetId: string,
  edges: readonly RawLineageEdge[],
): string[] {
  const parentsByChild = new Map<string, string[]>();
  for (const e of edges) {
    if (!isDerivationEdge(e)) continue;
    const list = parentsByChild.get(e.child_id);
    if (list) list.push(e.parent_id);
    else parentsByChild.set(e.child_id, [e.parent_id]);
  }
  const ancestors: string[] = [];
  const seen = new Set<string>([targetId]);
  let frontier = [targetId];
  for (let hop = 0; hop < MAX_HOPS && frontier.length && seen.size < MAX_NODES; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const p of parentsByChild.get(id) ?? []) {
        if (seen.has(p)) continue;
        seen.add(p);
        ancestors.push(p);
        next.push(p);
      }
    }
    frontier = next;
  }
  return ancestors;
}

/**
 * PURE. From the target's premise ancestors, collect the COUSIN nodes: artifacts reachable
 * DOWN (parent -> child) from any ancestor that are NOT the target, NOT one of the target's
 * own descendants, and NOT an ancestor. These are the artifacts that share a premise with
 * the target but sit on a different derivation path. Cycle-guarded + hop/node-capped.
 * Deduped by id, breadth-first order (closest cousins first).
 */
export function collectSharedPremiseCousins(
  target: { kind: string; id: string },
  ancestors: readonly string[],
  edges: readonly RawLineageEdge[],
): { kind: string; id: string; premiseKind: string; premiseId: string }[] {
  const childrenByParent = new Map<string, RawLineageEdge[]>();
  for (const e of edges) {
    if (!isDerivationEdge(e)) continue;
    const list = childrenByParent.get(e.parent_id);
    if (list) list.push(e);
    else childrenByParent.set(e.parent_id, [e]);
  }

  // The target's own subtree (walk DOWN from the target) - excluded so a cousin is never
  // the target's own descendant. Bounded ONLY by the node cap + the subtree-as-seen set
  // (not by hop depth): the cousin scan below can reach a target-descendant at any depth
  // within MAX_NODES, so the exclusion must reach just as far or it could be out-walked.
  const targetSubtree = new Set<string>([target.id]);
  {
    let frontier = [target.id];
    while (frontier.length && targetSubtree.size < MAX_NODES) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const e of childrenByParent.get(id) ?? []) {
          if (targetSubtree.has(e.child_id)) continue;
          targetSubtree.add(e.child_id);
          next.push(e.child_id);
        }
      }
      frontier = next;
    }
  }

  const ancestorSet = new Set<string>(ancestors);
  // The kind of each ancestor (so a named premise can say "the opportunity 'X'", not just an
  // id). A node's kind is most reliably its OWN child_kind (the node as the derived child in
  // an up-edge); fall back to parent_kind only for a root premise that is never a child. Two
  // passes, child_kind first, so a mixed (up + down) edge list can never mislabel an ancestor.
  const ancestorKind = new Map<string, string>();
  for (const e of edges) {
    if (!isDerivationEdge(e)) continue;
    if (ancestorSet.has(e.child_id) && !ancestorKind.has(e.child_id)) {
      ancestorKind.set(e.child_id, e.child_kind);
    }
  }
  for (const e of edges) {
    if (!isDerivationEdge(e)) continue;
    if (ancestorSet.has(e.parent_id) && !ancestorKind.has(e.parent_id)) {
      ancestorKind.set(e.parent_id, e.parent_kind);
    }
  }
  // Premise provenance: the premise a cousin SHARES with the target is the ancestor at the
  // root of the cousin's branch. BFS from all ancestors at once means the FIRST reach is via
  // the closest ancestor (the lowest common ancestor on the derivation graph), so a cousin's
  // seed is the most-specific shared premise (the opportunity over the signal above it).
  const seedOf = new Map<string, { kind: string; id: string }>();
  for (const a of ancestors) seedOf.set(a, { kind: ancestorKind.get(a) ?? "opportunity", id: a });

  const cousins = new Map<
    string,
    { kind: string; id: string; premiseKind: string; premiseId: string }
  >();
  const seen = new Set<string>(ancestors);
  let frontier = [...ancestors];
  for (let hop = 0; hop < MAX_HOPS && frontier.length && seen.size < MAX_NODES; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      const seed = seedOf.get(id) ?? { kind: "opportunity", id };
      for (const e of childrenByParent.get(id) ?? []) {
        const cid = e.child_id;
        if (seen.has(cid)) continue;
        seen.add(cid);
        if (!seedOf.has(cid)) seedOf.set(cid, seed); // inherit the branch's premise seed
        next.push(cid);
        if (cid === target.id || targetSubtree.has(cid) || ancestorSet.has(cid)) continue;
        if (!cousins.has(cid)) {
          cousins.set(cid, {
            kind: e.child_kind,
            id: cid,
            premiseKind: seed.kind,
            premiseId: seed.id,
          });
        }
      }
    }
    frontier = next;
  }
  return Array.from(cousins.values());
}

/**
 * PURE. Keep the cousins that reached a recorded outcome and shape them into ranked
 * precedents. Ranks the CAUTIONARY signal first - missed, then mixed, then validated -
 * then newest-checked, so the Critic sees "a same-premise decision MISSED" before a
 * reassuring one. Deduped by id, capped. Empty / outcome-less input yields [].
 */
export function selectSharedPremisePrecedents(
  cousins: readonly { kind: string; id: string; premiseKind?: string; premiseId?: string }[],
  outcomeById: ReadonlyMap<string, SharedPremiseOutcome>,
  opts: { max?: number } = {},
): SharedPremisePrecedentItem[] {
  const max = opts.max ?? 4;
  const seen = new Set<string>();
  const items: SharedPremisePrecedentItem[] = [];
  for (const c of cousins) {
    if (!c || typeof c.id !== "string" || !c.id.trim()) continue;
    const id = c.id.trim();
    if (seen.has(id)) continue;
    const oc = outcomeById.get(id);
    if (!oc) continue;
    if (oc.verdict !== "validated" && oc.verdict !== "missed" && oc.verdict !== "mixed") continue;
    seen.add(id);
    items.push({
      kind: typeof c.kind === "string" && c.kind.trim() ? c.kind.trim() : "decision",
      id,
      title: oc.title ?? null,
      verdict: oc.verdict,
      summary: oc.summary ?? null,
      checkedAt: oc.checkedAt ?? null,
      premiseKind: c.premiseKind ?? null,
      premiseId: c.premiseId ?? null,
    });
  }
  const rank = (v: SharedPremiseVerdict) => (v === "missed" ? 0 : v === "mixed" ? 1 : 2);
  items.sort((a, b) => {
    if (rank(a.verdict) !== rank(b.verdict)) return rank(a.verdict) - rank(b.verdict);
    return (b.checkedAt ?? "").localeCompare(a.checkedAt ?? "");
  });
  return items.slice(0, max);
}

/**
 * PURE. Render the ranked precedents as a compact, bounded "Shared-premise precedent" block
 * for the Critic prompt. Empty input returns "" (the caller omits the block). The framing
 * names the GRAPH provenance (same upstream premise) so the Critic does not mistake it for
 * the flat similarity precedent it already receives.
 */
export function formatSharedPremisePrecedent(items: SharedPremisePrecedentItem[]): string {
  if (!items.length) return "";
  const fate = (v: SharedPremiseVerdict) =>
    v === "validated" ? "was VALIDATED" : v === "missed" ? "MISSED" : "had a MIXED outcome";
  const bullets = items.map((it) => {
    const named = it.title?.trim() ? `"${it.title.trim()}"` : `(${it.id})`;
    const why = it.summary?.trim() ? `: ${it.summary.trim().slice(0, 200)}` : "";
    // Name the SHARED premise when its title resolved ("the opportunity 'X'"), so the Critic
    // sees exactly what they have in common; fall back to the generic phrasing otherwise.
    const premise = it.premiseTitle?.trim()
      ? `the same ${it.premiseKind ?? "upstream"} ("${it.premiseTitle.trim()}")`
      : "the same upstream premise";
    return `- a past ${it.kind} ${named}, derived from ${premise} as this one, ${fate(it.verdict)}${why}`;
  });
  return [
    "Shared-premise precedent (this workspace's decision graph: past decisions DERIVED FROM the same upstream signal/opportunity/theme as this one, and the outcome each reached - they are linked by a shared structural premise, not by similar text, so a flat similarity search would surface them only by accident of wording, if at all):",
    ...bullets,
  ].join("\n");
}

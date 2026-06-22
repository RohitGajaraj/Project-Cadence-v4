/**
 * Governing-decision retrieval - PURE core (Decision Brain, DBR-3).
 *
 * The moat's headline query, the first row of the table in decision-brain.md: "what is
 * the CURRENT belief, not the similar old one?" Flat vectors fail it (they return what is
 * similar); the typed decision graph answers it by walking the `supersedes` chain.
 *
 * DBR-1.5 writes outcome-labeled `supersedes` / `contradicts` edges into `artifact_lineage`
 * bi-temporally (parent = the later / overturning artifact, child = the prior belief;
 * `valid_to` set = that assertion was itself later reversed, invalidate-don't-delete).
 * DBR-2 LISTS those edges to the Critic as a red-team. THIS module does the part DBR-2
 * cannot: it follows the `supersedes` chain MULTI-HOP to the terminal, still-current node,
 * so a precedent the product is about to lean on is corrected to the decision that
 * replaced it ("use the current governing decision, not the stale match").
 *
 * PURE: no db, no network, no AI; unit-verifiable in isolation. Fail-safe by construction:
 * with no current edges every candidate resolves to itself (not superseded, not
 * contradicted) and is dropped, so the caller's block is empty and the surface stays
 * byte-identical until the decision graph actually has edges.
 */
import { classifyRelation, type RawLineageEdge } from "@/lib/knowledge-graph-view";

/** Depth cap so a pathological (or cyclic) chain can never loop or run away. */
const MAX_HOPS = 16;

/** A current (in-force) assertion: `valid_to` is absent/null/blank. A stamped `valid_to`
 * means a still-later outcome reversed it, so it no longer governs the present. */
function isCurrent(edge: RawLineageEdge): boolean {
  return !(typeof edge.valid_to === "string" && edge.valid_to.trim().length > 0);
}

export type GoverningResolution = {
  /** The terminal node after walking current `supersedes` edges (= the start when none). */
  governingKind: string;
  governingId: string;
  /** Supersession hops walked (0 when the start node is already current). */
  hops: number;
  /** A current `contradicts` edge targets the START node (a later outcome invalidated it). */
  contradicted: boolean;
};

/**
 * PURE. Walk the CURRENT `supersedes` chain from a node to the terminal governing node.
 * Edge direction: parent supersedes child, so from a child we step to the parent that
 * supersedes it, and repeat. When several current edges supersede the same node, the
 * NEWEST (by `created_at`) wins - the latest decision governs. Cycles are guarded (a node
 * is never revisited) and depth is capped. Also reports whether the START node is
 * contradicted by a current `contradicts` edge (the parent there is a failed outcome, not
 * a replacement, so it flags the node rather than redirecting the chain).
 */
export function resolveGoverning(
  startKind: string,
  startId: string,
  edges: readonly RawLineageEdge[],
): GoverningResolution {
  // One pass: bucket current `supersedes` edges by the child they retire, and collect the
  // set of nodes a current `contradicts` edge targets.
  const supersededBy = new Map<string, RawLineageEdge[]>();
  const contradicted = new Set<string>();
  for (const e of edges) {
    if (!e || typeof e.child_id !== "string" || typeof e.parent_id !== "string") continue;
    if (!isCurrent(e)) continue;
    const rel = classifyRelation(e.relation);
    if (rel === "supersedes") {
      if (e.child_id === e.parent_id) continue; // ignore a self-loop
      const list = supersededBy.get(e.child_id);
      if (list) list.push(e);
      else supersededBy.set(e.child_id, [e]);
    } else if (rel === "contradicts") {
      contradicted.add(e.child_id);
    }
  }
  // Newest superseder first within each bucket (the latest decision governs).
  for (const list of supersededBy.values()) {
    list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }

  let curKind = startKind;
  let curId = startId;
  let hops = 0;
  const seen = new Set<string>([startId]);
  while (hops < MAX_HOPS) {
    const supers = supersededBy.get(curId);
    if (!supers || !supers.length) break;
    const next = supers[0];
    if (seen.has(next.parent_id)) break; // cycle guard
    seen.add(next.parent_id);
    curKind = next.parent_kind;
    curId = next.parent_id;
    hops += 1;
  }

  return {
    governingKind: curKind,
    governingId: curId,
    hops,
    contradicted: contradicted.has(startId),
  };
}

/**
 * PURE. Given a batch of just-fetched `supersedes` edges and the nodes already visited,
 * return the next frontier to query: the parent (superseder) ids of CURRENT edges not yet
 * seen, deduped. The closure loader uses this to walk the chain PAST the focus-incident
 * edges - a similarity-bounded fetch only returns edges touching the precedents, so the
 * structural chain (intermediate nodes that are never similarity matches) must be
 * assembled by following child_id -> parent_id outward. Retired (valid_to set) and
 * non-supersedes edges never extend the frontier.
 */
export function nextSupersessionFrontier(
  edges: readonly RawLineageEdge[],
  seen: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const added = new Set<string>();
  for (const e of edges) {
    if (!e || typeof e.parent_id !== "string" || !e.parent_id) continue;
    if (!isCurrent(e)) continue;
    if (classifyRelation(e.relation) !== "supersedes") continue;
    if (seen.has(e.parent_id) || added.has(e.parent_id)) continue;
    added.add(e.parent_id);
    out.push(e.parent_id);
  }
  return out;
}

/** A precedent the product might cite, resolved to the CURRENT belief that governs it. */
export type GoverningDecisionItem = {
  /** The precedent node (the "similar old one" a flat search surfaces). */
  fromKind: string;
  fromId: string;
  /** The terminal, still-current decision after walking `supersedes` edges. */
  governingKind: string;
  governingId: string;
  /**
   * The governing decision's human title, resolved server-side (the pure selector leaves
   * it undefined; the server layer fills it). Lets a surface NAME the replacement ("by 'New
   * checkout flow'") instead of citing an opaque id - the whole point of "return the
   * governing DECISION, not the nearest text". Absent/null when not resolvable.
   */
  governingTitle?: string | null;
  /** `governingId` differs from `fromId` - a later decision replaced the precedent. */
  superseded: boolean;
  /** A current `contradicts` edge targets the precedent - a later outcome invalidated it. */
  contradicted: boolean;
  /** Supersession hops to the governing decision (>= 1 when superseded). */
  hops: number;
};

/**
 * PURE. For each candidate decision (typically the precedents the Critic is about to
 * cite), resolve its governing decision and keep ONLY the stale ones - superseded or
 * contradicted - since a candidate that is still current needs no correction. Dedupes by
 * id, preserves input order, and caps the result. Empty / all-current input yields [].
 */
export function selectGoverningDecisions(
  edges: readonly RawLineageEdge[],
  candidates: Iterable<{ kind: string; id: string }>,
  opts: { max?: number } = {},
): GoverningDecisionItem[] {
  const max = opts.max ?? 6;
  const seen = new Set<string>();
  const items: GoverningDecisionItem[] = [];
  for (const c of candidates) {
    if (items.length >= max) break;
    if (!c || typeof c.id !== "string" || !c.id.trim()) continue;
    const id = c.id.trim();
    const kind = typeof c.kind === "string" && c.kind.trim() ? c.kind.trim() : "decision";
    if (seen.has(id)) continue;
    seen.add(id);
    const res = resolveGoverning(kind, id, edges);
    const superseded = res.governingId !== id;
    if (!superseded && !res.contradicted) continue; // current precedent: nothing to correct
    items.push({
      fromKind: kind,
      fromId: id,
      governingKind: res.governingKind,
      governingId: res.governingId,
      superseded,
      contradicted: res.contradicted,
      hops: res.hops,
    });
  }
  return items;
}

/**
 * PURE. Find the governing-decision item for a precedent addressed by its prd OR
 * opportunity id (a precedent row can carry either or both). Lets a surface annotate each
 * precedent it shows with "this was superseded/contradicted" without re-resolving. Returns
 * null when the precedent is still current. When a row carries BOTH ids and both have a
 * governing item, the FIRST match in `items` wins; callers build the candidate list prd-
 * before-opportunity (matching `resolveEndpoints`' prd-first preference), so the prd's
 * governing decision is the one surfaced - a single, deterministic annotation per row.
 */
export function findGoverningFor(
  prdId: string | null,
  opportunityId: string | null,
  items: readonly GoverningDecisionItem[],
): GoverningDecisionItem | null {
  for (const it of items) {
    if ((prdId && it.fromId === prdId) || (opportunityId && it.fromId === opportunityId)) {
      return it;
    }
  }
  return null;
}

/**
 * PURE. Render the stale precedents as a compact, bounded "Governing decision" block for
 * the Critic prompt. Empty input returns "" (the caller omits the block). The framing is a
 * retrieval CORRECTION, distinct from DBR-2's red-team: it names the CURRENT decision that
 * should be relied on in place of the superseded match.
 */
export function formatGoverningDecisions(items: GoverningDecisionItem[]): string {
  if (!items.length) return "";
  const bullets = items.map((it) => {
    if (it.superseded) {
      const chain = it.hops > 1 ? ` (through ${it.hops} supersessions)` : "";
      const also = it.contradicted ? ", and a later outcome also CONTRADICTED it" : "";
      // Name the replacement when its title resolved; fall back to the id otherwise.
      const named = it.governingTitle?.trim()
        ? `"${it.governingTitle.trim()}" (${it.governingId})`
        : `(${it.governingId})`;
      return `- a past ${it.fromKind} (${it.fromId}) like this one was SUPERSEDED${chain} by a later ${it.governingKind} ${named}${also}; rely on the later one as the CURRENT governing decision, not the superseded ${it.fromKind}.`;
    }
    // Contradicted only: no replacement decision exists, so flag the node rather than redirect.
    return `- a past ${it.fromKind} (${it.fromId}) like this one was CONTRADICTED by a later outcome; it is no longer a safe basis.`;
  });
  return [
    "Governing decision (this workspace's decision graph resolves a similar PAST decision to the CURRENT belief that replaced it - a flat similarity search would surface the stale one):",
    ...bullets,
  ].join("\n");
}

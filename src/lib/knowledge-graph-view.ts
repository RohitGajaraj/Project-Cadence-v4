// O1 / DBR-1 v1 - the pure core of the knowledge-graph explorer.
//
// This module is SERVER-FREE on purpose so it is unit-testable in isolation
// (bun:test). It turns raw `artifact_lineage` rows into a typed, bounded,
// deterministically-laid-out `{ nodes, edges }` graph centred on a focus node.
//
// Design notes (full spec: docs/features/knowledge-graph-explorer.md):
//  - DERIVED, not stored: every edge already exists in `artifact_lineage`
//    (auto-written by recordLineage). v1 never fabricates an edge.
//  - Bounded like getProvenance (MAX_NODES / MAX_DEPTH) so a huge or cyclic
//    graph can never run away; `truncated` tells the UI it was capped.
//  - Deterministic layout (no Math.random): same input always renders the same,
//    which also makes the layout testable.
//  - The supersession SEAM is shaped but empty: `relation` already admits
//    'supersedes' | 'contradicts' and every edge carries `validTo` (always null
//    in v1). The day the inference engine writes those, they render unchanged.

export const GRAPH_NODE_KINDS = [
  "signal",
  "theme",
  "opportunity",
  "prd",
  "roadmap_item",
  "task",
  "meeting",
  "decision",
  "mission",
] as const;
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

export const GRAPH_RELATIONS = [
  "promoted",
  "cites",
  "derived-from",
  "depends-on",
  "validates",
  "supersedes",
  "contradicts",
] as const;
export type GraphRelation = (typeof GRAPH_RELATIONS)[number];

/** A row as it comes out of `artifact_lineage` (the fields we read). */
export type RawLineageEdge = {
  id: string;
  parent_kind: GraphNodeKind;
  parent_id: string;
  child_kind: GraphNodeKind;
  child_id: string;
  relation: string | null;
  rationale: string | null;
  created_at: string | null;
  /**
   * Bi-temporal stamp (DBR-1.5): the time this supersession assertion stopped
   * being current, because a LATER outcome reversed it (invalidate-don't-delete).
   * Present only once the migration's `valid_to` column is live; absent (undefined)
   * before then, in which case the edge reads as still-current. Always null on a
   * non-supersession edge.
   */
  valid_to?: string | null;
  /**
   * Edge-confidence provenance (DBR-EDGE-CONF), written into the `inference` jsonb by the
   * supersession engine. Present only on engine-written supersession edges once the column
   * is live; absent on promoted/human edges and before the migration. Read fail-safe.
   */
  inference?: { confidence?: number; tier?: string } | null;
};

export type GraphNode = {
  /** `${kind}:${id}` - the stable graph key. */
  key: string;
  kind: GraphNodeKind;
  id: string;
  title: string;
  /** Degree within the included subgraph (drives node size). */
  influence: number;
  /** Earliest incident-edge timestamp, the truthful "valid from". */
  createdAt: string | null;
  /** Graph distance from the focus node (0 = focus). */
  ring: number;
  x: number;
  y: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: GraphRelation | string;
  rationale: string | null;
  /** = the edge's created_at; the honest time axis. */
  validFrom: string | null;
  /**
   * Bi-temporal: when this supersession assertion stopped being current (a later
   * outcome reversed it). Null while the assertion still holds, and null on every
   * non-supersession edge / before the migration is live (the seam was empty in v1).
   */
  validTo: string | null;
  /** True for supersedes / contradicts edges (styled distinctly). */
  superseding: boolean;
  /**
   * The invalidate-don't-delete property made visible: a supersession edge whose
   * own assertion was later reversed (`validTo` stamped). It stays on the canvas as
   * faded history rather than being deleted. False until the engine + migration run.
   */
  retired: boolean;
  /**
   * Edge-confidence (DBR-EDGE-CONF): how trustworthy the supersession engine judged this
   * edge, from its `inference` provenance. Null on non-supersession edges and on edges
   * written before the confidence layer (so the canvas only ever fades a genuinely-scored,
   * low-confidence revision — never an unscored one).
   */
  confidence: number | null;
  confidenceTier: "strong" | "tentative" | "drop" | string | null;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusKey: string | null;
  stats: { nodeCount: number; edgeCount: number; rootSignals: number; maxRing: number };
  truncated: boolean;
};

export type GraphBounds = { maxNodes: number; maxDepth: number };
export const DEFAULT_BOUNDS: GraphBounds = { maxNodes: 80, maxDepth: 8 };

const RING_GAP = 120;

export function nodeKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** A node addressed by kind + id - the graph focus. */
export type GraphFocus = { kind: GraphNodeKind; id: string };

/**
 * PURE. Pick a lineage-anchored focus from raw lineage rows: the CHILD of the
 * most-recently-created edge (the "newer" artifact in a promoted/derived link).
 *
 * Used as a FALLBACK focus by getKnowledgeGraph: the auto-focus is the caller's
 * most recent decision, but a workspace's lineage may live entirely off that
 * decision (e.g. signal->theme promotions with no decision attached). Without this
 * fallback the canvas wrongly reads "No lineage to map yet" even though edges exist.
 * Anchoring on a node that actually participates in lineage guarantees the graph
 * draws whenever the workspace has ANY edge. Returns null on empty/malformed input.
 */
export function pickLineageFocus(rows: RawLineageEdge[] | null | undefined): GraphFocus | null {
  let best: RawLineageEdge | null = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.child_kind !== "string" || typeof r.child_id !== "string" || !r.child_id) {
      continue;
    }
    if (!best || (r.created_at ?? "") > (best.created_at ?? "")) best = r;
  }
  return best ? { kind: best.child_kind, id: best.child_id } : null;
}

/** Normalise a raw relation string; empty becomes the `promoted` default. */
export function classifyRelation(raw: string | null | undefined): GraphRelation | string {
  const r = (raw ?? "").trim().toLowerCase();
  return r || "promoted";
}

export function isSuperseding(relation: string): boolean {
  return relation === "supersedes" || relation === "contradicts";
}

function parseKey(key: string): { kind: GraphNodeKind; id: string } {
  const idx = key.indexOf(":");
  if (idx < 0) return { kind: key as GraphNodeKind, id: "" };
  return { kind: key.slice(0, idx) as GraphNodeKind, id: key.slice(idx + 1) };
}

/**
 * Project raw lineage rows into a typed, bounded, laid-out graph around `focusKey`.
 * Fail-safe: malformed input yields the focus node alone (or an empty graph),
 * never throws.
 */
export function projectGraph(
  rawEdges: RawLineageEdge[],
  titleMap: Map<string, string>,
  focusKey: string,
  bounds: GraphBounds = DEFAULT_BOUNDS,
): KnowledgeGraph {
  const maxNodes = bounds?.maxNodes ?? DEFAULT_BOUNDS.maxNodes;
  const maxDepth = bounds?.maxDepth ?? DEFAULT_BOUNDS.maxDepth;

  const clean = (Array.isArray(rawEdges) ? rawEdges : []).filter(
    (e): e is RawLineageEdge =>
      !!e &&
      typeof e.parent_kind === "string" &&
      typeof e.parent_id === "string" &&
      typeof e.child_kind === "string" &&
      typeof e.child_id === "string" &&
      !!e.parent_id &&
      !!e.child_id,
  );

  const withKeys = clean.map((e) => ({
    raw: e,
    sourceKey: nodeKey(e.parent_kind, e.parent_id),
    targetKey: nodeKey(e.child_kind, e.child_id),
  }));

  // Undirected adjacency for the breadth-first ring assignment.
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    const s = adj.get(a) ?? new Set<string>();
    s.add(b);
    adj.set(a, s);
  };
  for (const e of withKeys) {
    link(e.sourceKey, e.targetKey);
    link(e.targetKey, e.sourceKey);
  }

  // BFS from the focus, bounded by depth + node count.
  const ringByKey = new Map<string, number>([[focusKey, 0]]);
  let frontier = [focusKey];
  let truncated = false;
  let depth = 0;
  while (frontier.length && depth < maxDepth) {
    depth++;
    const next: string[] = [];
    let capped = false;
    for (const k of [...frontier].sort()) {
      for (const nb of [...(adj.get(k) ?? new Set<string>())].sort()) {
        if (ringByKey.has(nb)) continue;
        if (ringByKey.size >= maxNodes) {
          truncated = true;
          capped = true;
          break;
        }
        ringByKey.set(nb, depth);
        next.push(nb);
      }
      if (capped) break;
    }
    frontier = next;
  }
  if (frontier.length > 0) truncated = true; // unexplored nodes beyond the cap

  const included = ringByKey;
  const includedEdges = withKeys.filter(
    (e) => included.has(e.sourceKey) && included.has(e.targetKey),
  );

  // Degree (influence) + earliest incident timestamp per node.
  const degree = new Map<string, number>();
  const createdAtByKey = new Map<string, string | null>();
  const bump = (key: string, ts: string | null) => {
    degree.set(key, (degree.get(key) ?? 0) + 1);
    const cur = createdAtByKey.get(key);
    if (ts && (cur == null || ts < cur)) createdAtByKey.set(key, ts);
    else if (!createdAtByKey.has(key)) createdAtByKey.set(key, ts);
  };
  for (const e of includedEdges) {
    bump(e.sourceKey, e.raw.created_at);
    bump(e.targetKey, e.raw.created_at);
  }

  // Group by ring for a deterministic radial layout.
  const keysByRing = new Map<number, string[]>();
  for (const [key, ring] of included) {
    const arr = keysByRing.get(ring) ?? [];
    arr.push(key);
    keysByRing.set(ring, arr);
  }

  const nodes: GraphNode[] = [];
  for (const [ring, keysRaw] of [...keysByRing.entries()].sort((a, b) => a[0] - b[0])) {
    const keys = [...keysRaw].sort();
    const n = keys.length;
    keys.forEach((key, i) => {
      const { kind, id } = parseKey(key);
      let x = 0;
      let y = 0;
      if (ring > 0) {
        const radius = ring * RING_GAP;
        const angle = (2 * Math.PI * i) / n + ring * 0.35;
        x = radius * Math.cos(angle);
        y = radius * Math.sin(angle);
      }
      nodes.push({
        key,
        kind,
        id,
        title: titleMap.get(key) ?? "",
        influence: degree.get(key) ?? 0,
        createdAt: createdAtByKey.get(key) ?? null,
        ring,
        x,
        y,
      });
    });
  }

  const edges: GraphEdge[] = includedEdges.map((e) => {
    const relation = classifyRelation(e.raw.relation);
    const superseding = isSuperseding(relation);
    // Only a supersession edge can be "retired"; a stray valid_to on any other
    // relation is ignored so the flag never lies.
    const validTo =
      superseding && typeof e.raw.valid_to === "string" && e.raw.valid_to.trim()
        ? e.raw.valid_to
        : null;
    // Edge-confidence (DBR-EDGE-CONF): only a supersession edge can carry it, so a stray
    // inference blob on any other relation is ignored and the canvas never mis-fades.
    const inf =
      superseding && e.raw.inference && typeof e.raw.inference === "object"
        ? e.raw.inference
        : null;
    const confidence = inf && typeof inf.confidence === "number" ? inf.confidence : null;
    const confidenceTier = inf && typeof inf.tier === "string" ? inf.tier : null;
    return {
      id: e.raw.id,
      source: e.sourceKey,
      target: e.targetKey,
      relation,
      rationale: e.raw.rationale ?? null,
      validFrom: e.raw.created_at ?? null,
      validTo,
      superseding,
      retired: validTo !== null,
      confidence,
      confidenceTier,
    };
  });

  return {
    nodes,
    edges,
    focusKey: nodes.length ? focusKey : null,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      rootSignals: nodes.filter((nd) => nd.kind === "signal").length,
      maxRing: nodes.reduce((m, nd) => Math.max(m, nd.ring), 0),
    },
    truncated,
  };
}

/**
 * PURE (DBR-EDGE-CONF). Summarize the edge-confidence of the CURRENT supersession revisions:
 * among non-retired supersedes/contradicts edges that carry an engine confidence tier, how
 * many are strong vs tentative. Retired (reversed) and unscored edges are excluded, so the
 * canvas only ever claims the trust it actually has.
 */
export function summarizeEdgeConfidence(
  edges: GraphEdge[],
): { scored: number; strong: number; tentative: number } {
  let strong = 0;
  let tentative = 0;
  for (const e of edges) {
    if (!e.superseding || e.retired || !e.confidenceTier) continue;
    if (e.confidenceTier === "strong") strong++;
    else if (e.confidenceTier === "tentative") tentative++;
  }
  return { scored: strong + tentative, strong, tentative };
}

/**
 * The honest time axis: keep only what was already true as of `asOf` (an ISO
 * timestamp). ISO strings compare lexicographically, so no Date parsing needed.
 * The focus node is always kept so the view never goes blank.
 */
export function filterByTime(graph: KnowledgeGraph, asOf: string | null): KnowledgeGraph {
  if (!asOf) return graph;

  const edges = graph.edges.filter((e) => !e.validFrom || e.validFrom <= asOf);
  const live = new Set<string>();
  for (const e of edges) {
    live.add(e.source);
    live.add(e.target);
  }
  if (graph.focusKey) live.add(graph.focusKey);

  const nodes = graph.nodes.filter(
    (n) => live.has(n.key) && (n.key === graph.focusKey || !n.createdAt || n.createdAt <= asOf),
  );
  const nodeKeys = new Set(nodes.map((n) => n.key));
  const finalEdges = edges
    .filter((e) => nodeKeys.has(e.source) && nodeKeys.has(e.target))
    // Bi-temporal honesty: a supersession assertion reversed AFTER `asOf` was still
    // current as of that instant, so it reads retired only once `validTo <= asOf`.
    .map((e) => (e.superseding && e.validTo ? { ...e, retired: e.validTo <= asOf } : e));

  return {
    ...graph,
    nodes,
    edges: finalEdges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: finalEdges.length,
      rootSignals: nodes.filter((nd) => nd.kind === "signal").length,
      maxRing: nodes.reduce((m, nd) => Math.max(m, nd.ring), 0),
    },
  };
}

export type StalenessResult = {
  /** Node keys whose most recent supporting evidence is older than the threshold. */
  staleKeys: Set<string>;
  staleCount: number;
  /** Nodes that have ANY dated evidence (the honest denominator). */
  datedCount: number;
  thresholdDays: number;
};

const DAY_MS = 86_400_000;
export const DEFAULT_STALE_DAYS = 90;

/**
 * O3 (drift slice): flag facts whose most recent supporting evidence has gone
 * stale. A node is stale when its NEWEST incident edge (the last time anything
 * reinforced it) is older than `thresholdDays` relative to `nowMs`. Pure and
 * deterministic - `nowMs` is injected so it is testable - and HONEST: nodes
 * with no dated evidence are never counted, never guessed. This is the
 * deterministic half of fact-currency; outcome-driven contradiction (the
 * supersession engine) is the deferred other half.
 */
export function computeStaleness(
  graph: KnowledgeGraph,
  opts: { thresholdDays?: number; nowMs: number },
): StalenessResult {
  const thresholdDays = opts?.thresholdDays ?? DEFAULT_STALE_DAYS;
  const cutoff = opts.nowMs - thresholdDays * DAY_MS;

  // Newest supporting timestamp per node (max incident edge validFrom).
  const latest = new Map<string, number>();
  const consider = (key: string, iso: string | null) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return;
    const cur = latest.get(key);
    if (cur === undefined || t > cur) latest.set(key, t);
  };
  for (const e of graph.edges) {
    consider(e.source, e.validFrom);
    consider(e.target, e.validFrom);
  }
  // Fall back to the node's own createdAt when it has no incident edge.
  for (const n of graph.nodes) {
    if (!latest.has(n.key)) consider(n.key, n.createdAt);
  }

  const staleKeys = new Set<string>();
  let datedCount = 0;
  for (const n of graph.nodes) {
    const t = latest.get(n.key);
    if (t === undefined) continue; // undated -> not counted
    datedCount++;
    if (t < cutoff) staleKeys.add(n.key);
  }

  return { staleKeys, staleCount: staleKeys.size, datedCount, thresholdDays };
}

export type ContradictionDriftResult = {
  /** Node keys whose most recent supporting edge is a CURRENT supersession. */
  driftedKeys: Set<string>;
  /** Count of nodes whose belief has been contradicted/superseded and that revision is still in effect. */
  driftedCount: number;
  /** Total nodes in the graph (denominator for UI display). */
  nodeCount: number;
};

/**
 * O3 (contradiction drift, outcome-driven half): flag facts whose most recent
 * supporting evidence is a CURRENT (non-retired) `supersedes` or `contradicts`
 * edge. These nodes represent beliefs that have been revised by a later outcome,
 * and the revision is still in effect (not itself reversed and retired). Pure and
 * deterministic. This uses the bi-temporal plumbing (the `retired` boolean, set by
 * DBR-1.5 when the migration's `valid_to` column is live) to distinguish CURRENT
 * revisions from reversed-and-retired ones (the invalidate-don't-delete moat).
 */
export function computeContradictionDrift(graph: KnowledgeGraph): ContradictionDriftResult {
  const driftedKeys = new Set<string>();

  // A node is "drifted" when the newest edge pointing TO it (target) is a
  // current supersession. That edge's relation is supersedes/contradicts, and
  // it is NOT retired (still in effect).
  for (const e of graph.edges) {
    // Only superseding relations (relation field is already classified).
    if (!isSuperseding(e.relation)) continue;
    // Only current revisions (not retired = the assertion is still true).
    if (e.retired) continue;
    // The TARGET node is the one whose belief was revised.
    driftedKeys.add(e.target);
  }

  return {
    driftedKeys,
    driftedCount: driftedKeys.size,
    nodeCount: graph.nodes.length,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// DBR-1.5 read-side (F-IA-BRAIN-GRAPH): make the supersession mechanic legible.
//
// The supersession engine writes typed `supersedes`/`contradicts` edges between a
// decision and a prior belief when a recorded outcome reverses it (the moat's
// signature mechanic). The canvas already styles those edges (madder, dashed), but
// the node-story panel never said WHAT they mean. This pure helper turns the raw
// lineage rows getLineage already returns into a plain-language "decision history":
// for a selected node, which beliefs it revised, and whether it was itself revised
// by a later outcome. Migration-free (reads only `relation`, already present) and
// fail-safe (no such edges -> empty story -> the section simply doesn't render).
// ───────────────────────────────────────────────────────────────────────────

/** How a supersession edge reads relative to the SELECTED node. */
export type SupersessionDirection =
  | "superseded-by"
  | "contradicted-by"
  | "supersedes"
  | "contradicts";

const SUPERSESSION_LABEL: Record<SupersessionDirection, string> = {
  "superseded-by": "Superseded by",
  "contradicted-by": "Contradicted by",
  supersedes: "Supersedes",
  contradicts: "Contradicts",
};

/** A single supersession relationship, phrased from the selected node's point of view. */
export type SupersessionLink = {
  /** Stable key = the lineage edge id. */
  id: string;
  direction: SupersessionDirection;
  /** Human phrase, e.g. "Superseded by". */
  label: string;
  /** The other artifact's display title (may be empty if unhydrated). */
  peerTitle: string;
  peerKind: string;
  peerId: string;
  /** True when this link means the selected node's OWN belief was revised by a later outcome. */
  retiresSelf: boolean;
  /**
   * Bi-temporal: this supersession assertion is no longer current (its `valid_to`
   * was stamped because a later outcome reversed it). Invalidate-don't-delete, so
   * the retired belief stays visible as history. False until the engine + the
   * migration's `valid_to` column are live (the field is simply absent before then).
   */
  retired: boolean;
  /** When the assertion stopped being current (ISO), or null while it still holds. */
  retiredAt: string | null;
};

export type SupersessionStory = {
  links: SupersessionLink[];
  /** The node's belief is CURRENTLY superseded/contradicted (excludes reversed-and-retired revisions). */
  revised: boolean;
};

/** The minimal lineage-row shape this helper needs (a superset of getLineage's rows). */
export type LineageRowLike = {
  id: string;
  relation?: string | null;
  peer_title?: string | null;
  parent_kind?: string | null;
  parent_id?: string | null;
  child_kind?: string | null;
  child_id?: string | null;
  /** Bi-temporal stamp; present once the DBR-1.5 migration is live, else undefined. */
  valid_to?: string | null;
};

/** PURE. True for the two relations the supersession engine writes. */
export function isSupersessionRelation(raw: string | null | undefined): boolean {
  const r = (raw ?? "").trim().toLowerCase();
  return r === "supersedes" || r === "contradicts";
}

/**
 * PURE. Build the selected node's supersession "decision history" from the
 * `ancestors` (edges INTO the node, peer is the parent) and `descendants`
 * (edges OUT, peer is the child) that getLineage returns.
 *
 * Direction logic (an edge always reads parent --relation--> child):
 *  - ancestor + `supersedes`  => parent supersedes THIS node => "Superseded by parent" (self revised)
 *  - ancestor + `contradicts` => "Contradicted by parent" (self revised)
 *  - descendant + `supersedes`  => THIS node supersedes child => "Supersedes child"
 *  - descendant + `contradicts` => "Contradicts child"
 *
 * Self-revised links are listed first, and CURRENT links before retired ones (the
 * bi-temporal `valid_to`): a reversed-and-retired assertion stays visible as history
 * but is de-emphasized. Fail-safe on malformed / non-array input; dedups by edge id
 * so a self-loop can't double-count.
 */
export function buildSupersessionStory(
  ancestors: LineageRowLike[] | null | undefined,
  descendants: LineageRowLike[] | null | undefined,
): SupersessionStory {
  const links: SupersessionLink[] = [];
  const seen = new Set<string>();

  const collect = (
    rows: LineageRowLike[] | null | undefined,
    peerSide: "parent" | "child",
    byRelation: Partial<Record<string, SupersessionDirection>>,
  ) => {
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r || typeof r.id !== "string" || seen.has(r.id)) continue;
      const rel = (r.relation ?? "").trim().toLowerCase();
      const direction = byRelation[rel];
      if (!direction) continue;
      seen.add(r.id);
      const peerKind = (peerSide === "parent" ? r.parent_kind : r.child_kind) ?? "";
      const peerId = (peerSide === "parent" ? r.parent_id : r.child_id) ?? "";
      const retiredAt = typeof r.valid_to === "string" && r.valid_to.trim() ? r.valid_to : null;
      links.push({
        id: r.id,
        direction,
        label: SUPERSESSION_LABEL[direction],
        peerTitle: (r.peer_title ?? "").trim(),
        peerKind,
        peerId,
        retiresSelf: direction === "superseded-by" || direction === "contradicted-by",
        retired: retiredAt !== null,
        retiredAt,
      });
    }
  };

  // Self-revised first (ancestors), then this node's own assertions (descendants).
  collect(ancestors, "parent", { supersedes: "superseded-by", contradicts: "contradicted-by" });
  collect(descendants, "child", { supersedes: "supersedes", contradicts: "contradicts" });

  // Current links before retired ones (insertion order preserved within each group).
  const ordered = [...links.filter((l) => !l.retired), ...links.filter((l) => l.retired)];

  // "Revised" reflects the node's belief RIGHT NOW: a self-retiring link that has
  // itself been reversed (retired) no longer means the belief is currently revised.
  return { links: ordered, revised: ordered.some((l) => l.retiresSelf && !l.retired) };
}

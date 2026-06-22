/**
 * DBR entity-resolution v1 (guardrail #4 of the Decision Brain).
 *
 * "The checkout redesign" and "Project Swift" and "New checkout flow" may all name
 * the SAME underlying initiative. The decision-graph walks (supersession, governing
 * decision, shared-premise, precedent) connect nodes by id + edges, so two nodes that
 * name the same entity under different titles fragment into disconnected subgraphs and
 * the walks miss real precedent. This module resolves nodes to canonical ENTITIES so a
 * later increment can collapse those fragments before the walks run.
 *
 * This is PURE (no env, no I/O, no AI), deterministic, and fully unit-tested, so the
 * loop ships it autonomously. It is also DORMANT/compute-only: it is the foundation a
 * later increment wires into the graph walks (the wiring needs precision review on real
 * data + the founder-gated AI layer below), so nothing drives it yet.
 *
 * PRECISION OVER RECALL, by design. A false merge silently corrupts every downstream
 * decision (two unrelated initiatives would share precedent), which is strictly worse
 * than leaving a fragment. So v1 merges on only TWO high-confidence signals:
 *   1. EXACT normalized-key match  — surface variants of the same title
 *      ("the Checkout Redesign" == "Checkout redesign" == "Checkout revamp").
 *   2. EXPLICIT declared alias      — a node states another name for itself
 *      ("Project Swift" with alias "checkout redesign").
 * The hard case (codename <-> description with NO shared words and no declared alias,
 * e.g. inferring "Project Swift" IS "the checkout redesign") needs world knowledge /
 * AI and is a FOUNDER-GATED later layer; v1 deliberately does not guess it.
 */

/** A decision-graph node as the resolver sees it (a thin, kind-agnostic view). */
export interface DecisionNode {
  /** Unique within the input set; the resolver maps each id once (duplicate ids collapse). */
  id: string;
  /** signal / opportunity / decision / prd / theme — carried through, not used to merge. */
  kind?: string | null;
  title: string;
  /** Other names the SAME entity is explicitly known by (codenames, prior names). */
  aliases?: string[] | null;
}

/** A canonical entity: the nodes resolved to refer to the same underlying thing. */
export interface EntityGroup {
  /** Content-addressed identity (smallest member title key); re-resolve, do not persist. */
  entityId: string;
  /** The normalized key that identifies this entity (empty only for content-less titles). */
  key: string;
  /** The most-informative member title, for display. */
  canonicalTitle: string;
  /** Every node resolved to this entity, ordered by id (deterministic). */
  members: DecisionNode[];
}

export interface EntityResolutionOptions {
  /** Min length a token must reach to count as significant (default 2; keeps "ai"/"ux"/"qa"). */
  minTokenLength?: number;
}

const DEFAULTS: Required<EntityResolutionOptions> = {
  minTokenLength: 2,
};

/**
 * Generic decision-title "wrapper" words that carry no entity identity. Stripping them
 * lets surface variants collapse: "the checkout redesign" / "checkout revamp" reduce to
 * {checkout}. DELIBERATELY CONSERVATIVE: only unambiguous wrappers (articles/preps),
 * generic container nouns (project/initiative/epic), change-verbs (redesign/revamp/...),
 * and status adjectives (new/draft/...). Noun-like words that are real content in a
 * roadmap (story, flow, spec, feature, work, plan, milestone, phase, ...) are NOT
 * stripped: doing so falsely merges different initiatives that share one such token
 * ("Story editor" vs "Editor redesign" would both reduce to {editor}). Precision over
 * recall: a missed surface-variant is far cheaper than a false merge into the graph.
 */
const NOISE_WORDS = new Set<string>([
  "the",
  "a",
  "an",
  "of",
  "for",
  "to",
  "and",
  "or",
  "on",
  "in",
  "at",
  "by",
  "with",
  "project",
  "initiative",
  "effort",
  "epic",
  "redesign",
  "revamp",
  "rework",
  "rebuild",
  "overhaul",
  "refactor",
  "redo",
  "new",
  "old",
  "updated",
  "revised",
  "draft",
  "final",
]);

/** A version token like v1, v2, v10 carries no entity identity. */
const VERSION_TOKEN = /^v\d+$/;

/**
 * The significant, identity-bearing tokens of a title: Unicode-folded (Latin accents
 * stripped), lowercased, split on any non-letter/non-number, with noise + version
 * tokens dropped. Unicode-aware so a non-Latin title (CJK, Cyrillic, ...) keeps its
 * real tokens instead of being erased down to an incidental ASCII word like "api"
 * (which would falsely merge two unrelated non-Latin initiatives). Order-preserving.
 */
export function entityTokens(title: string, opts: EntityResolutionOptions = {}): string[] {
  const { minTokenLength } = { ...DEFAULTS, ...opts };
  return (title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= minTokenLength && !NOISE_WORDS.has(t) && !VERSION_TOKEN.test(t));
}

/**
 * The normalized entity key of a title: its significant tokens, de-duplicated and
 * SORTED, joined with "-". Sorting makes the key word-order-independent ("checkout
 * redesign" == "redesign checkout"). Empty when the title is all noise/punctuation
 * (an empty key never merges with anything — content-less is not an identity).
 */
export function entityKey(title: string, opts: EntityResolutionOptions = {}): string {
  const tokens = [...new Set(entityTokens(title, opts))].sort();
  return tokens.join("-");
}

/** Every non-empty key a node is known by: its title key plus each declared alias key. */
function nodeKeys(node: DecisionNode, opts: EntityResolutionOptions): string[] {
  const keys = new Set<string>();
  const titleKey = entityKey(node.title, opts);
  if (titleKey) keys.add(titleKey);
  for (const alias of node.aliases ?? []) {
    const k = entityKey(alias, opts);
    if (k) keys.add(k);
  }
  return [...keys];
}

/** Disjoint-set union-find with path halving — deterministic, order-free grouping. */
class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (ra < rb) this.parent[rb] = ra;
    else this.parent[ra] = rb;
  }
}

/** The most-informative member title: most significant tokens, then shortest, then id. */
function pickCanonicalTitle(members: DecisionNode[], opts: EntityResolutionOptions): string {
  let best = members[0];
  let bestTokens = entityTokens(best.title, opts).length;
  for (const m of members.slice(1)) {
    const n = entityTokens(m.title, opts).length;
    if (
      n > bestTokens ||
      (n === bestTokens && m.title.length < best.title.length) ||
      (n === bestTokens && m.title.length === best.title.length && m.id < best.id)
    ) {
      best = m;
      bestTokens = n;
    }
  }
  return best.title;
}

/**
 * Resolve decision nodes into canonical entities. Two nodes are the SAME entity iff
 * they share at least one non-empty normalized key (from either node's title or its
 * declared aliases). Connected components of that shared-key relation are the entities;
 * every node belongs to exactly one entity (a node with a unique key is its own entity).
 *
 * Deterministic and order-INDEPENDENT: the same node set always yields the same entities
 * with the same ids, ordered by member count (desc) then entityId (asc).
 */
export function resolveEntities(
  nodes: DecisionNode[],
  opts: EntityResolutionOptions = {},
): EntityGroup[] {
  const options = { ...DEFAULTS, ...opts };
  const n = nodes.length;
  if (n === 0) return [];

  const keysPerNode = nodes.map((node) => nodeKeys(node, options));
  const titleKeyPerNode = nodes.map((node) => entityKey(node.title, options));
  const uf = new UnionFind(n);

  // Link any two nodes that share a key, via a key -> first-seen-index map (O(n * keys)).
  const firstByKey = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (const key of keysPerNode[i]) {
      const seen = firstByKey.get(key);
      if (seen === undefined) firstByKey.set(key, i);
      else uf.union(seen, i);
    }
  }

  // Gather components.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const arr = groups.get(root);
    if (arr) arr.push(i);
    else groups.set(root, [i]);
  }

  const result: EntityGroup[] = [];
  for (const memberIdx of groups.values()) {
    const members = memberIdx
      .map((idx) => nodes[idx])
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // Entity key = the lexicographically smallest non-empty TITLE key among members
    // (alias keys are EXCLUDED here, so adding a member with an unrelated smaller alias
    // never perturbs the id). This is CONTENT-ADDRESSED, not a durable identity: it can
    // still change if a member with a smaller title key joins, so callers should
    // re-resolve rather than persist it (a durable entity id is the founder-gated layer).
    // Falls back to any member key, then a node id, for an alias-only entity.
    const titleKeys = memberIdx
      .map((idx) => titleKeyPerNode[idx])
      .filter(Boolean)
      .sort();
    const anyKeys = memberIdx.flatMap((idx) => keysPerNode[idx]).sort();
    const key = titleKeys[0] ?? anyKeys[0] ?? "";
    const entityId = key ? `ent:${key}` : `ent:node:${members[0].id}`;
    result.push({
      entityId,
      key,
      canonicalTitle: pickCanonicalTitle(members, options),
      members,
    });
  }

  result.sort((a, b) => {
    if (a.members.length !== b.members.length) return b.members.length - a.members.length;
    return a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0;
  });
  return result;
}

/**
 * A convenience map from each node id to its resolved entityId, for a later increment
 * that needs to collapse aliased nodes before a graph walk (e.g. treat two ids as one).
 */
export function entityIdByNode(
  nodes: DecisionNode[],
  opts: EntityResolutionOptions = {},
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of resolveEntities(nodes, opts)) {
    for (const member of group.members) map.set(member.id, group.entityId);
  }
  return map;
}

/**
 * A map from each node id to a CANONICAL representative REAL id for its entity (the
 * lexicographically smallest member id). Unlike {@link entityIdByNode} (a synthetic
 * "ent:key"), this representative is a real node id that still resolves in the backing
 * tables, so a caller can collapse aliased/surface-variant nodes onto ONE real id before
 * a graph walk without breaking downstream id lookups. A node in a singleton entity maps
 * to itself, so collapsing only ever affects nodes that genuinely resolve to one entity.
 */
export function canonicalNodeId(
  nodes: DecisionNode[],
  opts: EntityResolutionOptions = {},
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of resolveEntities(nodes, opts)) {
    // members are id-sorted, so members[0].id is the smallest = the stable representative.
    const rep = group.members[0].id;
    for (const member of group.members) map.set(member.id, rep);
  }
  return map;
}

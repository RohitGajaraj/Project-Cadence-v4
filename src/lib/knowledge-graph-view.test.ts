import { describe, it, expect } from "bun:test";
import {
  projectGraph,
  filterByTime,
  computeStaleness,
  classifyRelation,
  isSuperseding,
  nodeKey,
  buildSupersessionStory,
  isSupersessionRelation,
  type RawLineageEdge,
  type GraphNodeKind,
  type LineageRowLike,
} from "./knowledge-graph-view";

const k = nodeKey;

function edge(
  p: [GraphNodeKind, string],
  c: [GraphNodeKind, string],
  opts: Partial<RawLineageEdge> = {},
): RawLineageEdge {
  return {
    id: opts.id ?? `${p[0]}:${p[1]}->${c[0]}:${c[1]}`,
    parent_kind: p[0],
    parent_id: p[1],
    child_kind: c[0],
    child_id: c[1],
    relation: opts.relation ?? "promoted",
    rationale: opts.rationale ?? null,
    created_at: opts.created_at ?? "2026-06-01T00:00:00.000Z",
  };
}

describe("classifyRelation", () => {
  it("defaults empty to promoted, lowercases, passes through", () => {
    expect(classifyRelation("")).toBe("promoted");
    expect(classifyRelation(null)).toBe("promoted");
    expect(classifyRelation("Cites")).toBe("cites");
    expect(classifyRelation("supersedes")).toBe("supersedes");
  });
});

describe("isSuperseding", () => {
  it("is true only for supersedes / contradicts", () => {
    expect(isSuperseding("supersedes")).toBe(true);
    expect(isSuperseding("contradicts")).toBe(true);
    expect(isSuperseding("cites")).toBe(false);
    expect(isSuperseding("promoted")).toBe(false);
  });
});

describe("projectGraph - empty + fail-safe", () => {
  it("returns just the focus node when there are no edges", () => {
    const titles = new Map([[k("decision", "d1"), "Ship checkout v2"]]);
    const g = projectGraph([], titles, k("decision", "d1"));
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].title).toBe("Ship checkout v2");
    expect(g.nodes[0].ring).toBe(0);
    expect(g.nodes[0].x).toBe(0);
    expect(g.nodes[0].y).toBe(0);
    expect(g.edges).toHaveLength(0);
    expect(g.truncated).toBe(false);
    expect(g.focusKey).toBe(k("decision", "d1"));
  });

  it("never throws on malformed input", () => {
    // @ts-expect-error deliberately malformed
    expect(() => projectGraph(null, new Map(), k("decision", "d1"))).not.toThrow();
    // @ts-expect-error deliberately malformed row
    const g = projectGraph([{ id: "x" }], new Map(), k("decision", "d1"));
    expect(g.nodes.length).toBeGreaterThanOrEqual(1); // just the focus
  });
});

describe("projectGraph - chain", () => {
  const titles = new Map([
    [k("signal", "s1"), "cart abandons at pay"],
    [k("opportunity", "o1"), "Faster checkout"],
    [k("decision", "d1"), "Ship checkout v2"],
  ]);
  // signal s1 -> opportunity o1 -> decision d1
  const edges = [
    edge(["signal", "s1"], ["opportunity", "o1"], { relation: "derived-from" }),
    edge(["opportunity", "o1"], ["decision", "d1"], { relation: "cites" }),
  ];

  it("builds typed nodes + edges with rings from the focus", () => {
    const g = projectGraph(edges, titles, k("decision", "d1"));
    expect(g.stats.nodeCount).toBe(3);
    expect(g.stats.edgeCount).toBe(2);
    const ringOf = (key: string) => g.nodes.find((n) => n.key === key)!.ring;
    expect(ringOf(k("decision", "d1"))).toBe(0);
    expect(ringOf(k("opportunity", "o1"))).toBe(1);
    expect(ringOf(k("signal", "s1"))).toBe(2);
    expect(g.stats.rootSignals).toBe(1);
    expect(g.stats.maxRing).toBe(2);
    expect(g.truncated).toBe(false);
  });

  it("computes influence as degree", () => {
    const g = projectGraph(edges, titles, k("decision", "d1"));
    const inf = (key: string) => g.nodes.find((n) => n.key === key)!.influence;
    expect(inf(k("opportunity", "o1"))).toBe(2); // middle of the chain
    expect(inf(k("decision", "d1"))).toBe(1);
    expect(inf(k("signal", "s1"))).toBe(1);
  });

  it("carries the truthful validFrom on edges and a null validTo seam", () => {
    const g = projectGraph(edges, titles, k("decision", "d1"));
    for (const e of g.edges) {
      expect(e.validFrom).toBe("2026-06-01T00:00:00.000Z");
      expect(e.validTo).toBeNull();
    }
  });

  it("is deterministic (identical positions across calls)", () => {
    const a = projectGraph(edges, titles, k("decision", "d1"));
    const b = projectGraph(edges, titles, k("decision", "d1"));
    expect(a.nodes.map((n) => [n.key, n.x, n.y])).toEqual(b.nodes.map((n) => [n.key, n.x, n.y]));
  });
});

describe("projectGraph - bounding", () => {
  it("caps depth and flags truncated", () => {
    const edges = [
      edge(["signal", "s1"], ["opportunity", "o1"]),
      edge(["opportunity", "o1"], ["decision", "d1"]),
    ];
    const g = projectGraph(edges, new Map(), k("decision", "d1"), { maxNodes: 80, maxDepth: 1 });
    expect(g.nodes.map((n) => n.key).sort()).toEqual(
      [k("decision", "d1"), k("opportunity", "o1")].sort(),
    );
    expect(g.truncated).toBe(true);
  });

  it("caps node count and flags truncated", () => {
    const edges: RawLineageEdge[] = [];
    for (let i = 0; i < 10; i++) edges.push(edge(["decision", "d1"], ["task", `t${i}`]));
    const g = projectGraph(edges, new Map(), k("decision", "d1"), { maxNodes: 5, maxDepth: 8 });
    expect(g.nodes.length).toBeLessThanOrEqual(5);
    expect(g.truncated).toBe(true);
  });
});

describe("projectGraph - supersession seam", () => {
  it("classifies supersedes / contradicts edges and leaves validTo empty", () => {
    const edges = [edge(["decision", "d0"], ["decision", "d1"], { relation: "supersedes" })];
    const g = projectGraph(edges, new Map(), k("decision", "d1"));
    const e = g.edges.find((x) => x.relation === "supersedes")!;
    expect(e.superseding).toBe(true);
    expect(e.validTo).toBeNull();
  });
});

describe("filterByTime", () => {
  const edges = [
    edge(["signal", "s1"], ["opportunity", "o1"], { created_at: "2026-01-01T00:00:00.000Z" }),
    edge(["opportunity", "o1"], ["decision", "d1"], { created_at: "2026-05-01T00:00:00.000Z" }),
  ];

  it("drops edges created after the asOf cutoff", () => {
    const g = projectGraph(edges, new Map(), k("decision", "d1"));
    const past = filterByTime(g, "2026-03-01T00:00:00.000Z");
    expect(past.edges.map((e) => e.id)).toEqual([edges[0].id]);
  });

  it("returns the graph unchanged when asOf is null", () => {
    const g = projectGraph(edges, new Map(), k("decision", "d1"));
    expect(filterByTime(g, null)).toBe(g);
  });
});

describe("computeStaleness", () => {
  const NOW = Date.parse("2026-06-20T00:00:00.000Z");

  it("flags nodes whose newest evidence is older than the threshold", () => {
    const edges = [
      edge(["signal", "s1"], ["opportunity", "o1"], { created_at: "2026-01-01T00:00:00.000Z" }),
      edge(["opportunity", "o1"], ["decision", "d1"], { created_at: "2026-01-01T00:00:00.000Z" }),
    ];
    const g = projectGraph(edges, new Map(), k("decision", "d1"));
    const r = computeStaleness(g, { thresholdDays: 90, nowMs: NOW });
    expect(r.staleCount).toBe(3);
    expect(r.datedCount).toBe(3);
    expect(r.staleKeys.has(k("signal", "s1"))).toBe(true);
  });

  it("uses the NEWEST edge, so a recently reinforced node is fresh", () => {
    const edges = [
      edge(["signal", "s1"], ["opportunity", "o1"], {
        id: "old",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      edge(["opportunity", "o1"], ["decision", "d1"], {
        id: "new",
        created_at: "2026-06-15T00:00:00.000Z",
      }),
    ];
    const g = projectGraph(edges, new Map(), k("decision", "d1"));
    const r = computeStaleness(g, { thresholdDays: 90, nowMs: NOW });
    expect(r.staleKeys.has(k("opportunity", "o1"))).toBe(false);
    expect(r.staleKeys.has(k("decision", "d1"))).toBe(false);
    expect(r.staleKeys.has(k("signal", "s1"))).toBe(true);
    expect(r.staleCount).toBe(1);
  });

  it("never counts undated nodes (honest denominator)", () => {
    const g = projectGraph([], new Map(), k("decision", "d1"));
    const r = computeStaleness(g, { thresholdDays: 90, nowMs: NOW });
    expect(r.datedCount).toBe(0);
    expect(r.staleCount).toBe(0);
  });
});

describe("isSupersessionRelation", () => {
  it("matches only the engine's two relations, case/space-insensitive", () => {
    expect(isSupersessionRelation("supersedes")).toBe(true);
    expect(isSupersessionRelation("  Contradicts ")).toBe(true);
    expect(isSupersessionRelation("cites")).toBe(false);
    expect(isSupersessionRelation("promoted")).toBe(false);
    expect(isSupersessionRelation(null)).toBe(false);
    expect(isSupersessionRelation(undefined)).toBe(false);
  });
});

describe("buildSupersessionStory", () => {
  // A lineage row as getLineage returns it (peer already hydrated).
  const row = (o: Partial<LineageRowLike> & { id: string }): LineageRowLike => ({
    relation: "promoted",
    peer_title: null,
    parent_kind: null,
    parent_id: null,
    child_kind: null,
    child_id: null,
    ...o,
  });

  it("reads an ancestor supersedes edge as 'Superseded by' and marks self revised", () => {
    // parent (opportunity O) --supersedes--> THIS node => this node was superseded.
    const ancestors = [
      row({
        id: "e1",
        relation: "supersedes",
        peer_title: "Drop live-chat",
        parent_kind: "opportunity",
        parent_id: "O",
      }),
    ];
    const story = buildSupersessionStory(ancestors, []);
    expect(story.revised).toBe(true);
    expect(story.links).toHaveLength(1);
    expect(story.links[0]).toMatchObject({
      direction: "superseded-by",
      label: "Superseded by",
      peerTitle: "Drop live-chat",
      peerKind: "opportunity",
      peerId: "O",
      retiresSelf: true,
    });
  });

  it("reads a descendant contradicts edge as 'Contradicts' without marking self revised", () => {
    // THIS node --contradicts--> child (prd P).
    const descendants = [
      row({
        id: "e2",
        relation: "contradicts",
        peer_title: "Old pricing PRD",
        child_kind: "prd",
        child_id: "P",
      }),
    ];
    const story = buildSupersessionStory([], descendants);
    expect(story.revised).toBe(false);
    expect(story.links[0]).toMatchObject({
      direction: "contradicts",
      label: "Contradicts",
      peerTitle: "Old pricing PRD",
      retiresSelf: false,
    });
  });

  it("ignores non-supersession relations and lists self-revised links first", () => {
    const ancestors = [
      row({ id: "cite", relation: "cites", parent_kind: "signal", parent_id: "S" }),
      row({ id: "sup", relation: "Supersedes", parent_kind: "prd", parent_id: "A" }),
    ];
    const descendants = [
      row({ id: "down", relation: "supersedes", child_kind: "prd", child_id: "B" }),
      row({ id: "promo", relation: "promoted", child_kind: "task", child_id: "T" }),
    ];
    const story = buildSupersessionStory(ancestors, descendants);
    // Only the two supersession edges survive; the cite + promoted rows are dropped.
    expect(story.links.map((l) => l.id)).toEqual(["sup", "down"]);
    // Self-revised (ancestor) is ordered before this node's own assertion (descendant).
    expect(story.links[0].retiresSelf).toBe(true);
    expect(story.links[1].retiresSelf).toBe(false);
  });

  it("is fail-safe on null/empty/malformed input", () => {
    expect(buildSupersessionStory(null, undefined)).toEqual({ links: [], revised: false });
    expect(buildSupersessionStory([], [])).toEqual({ links: [], revised: false });
    // Row missing an id is skipped, not thrown.
    const bad = [{ relation: "supersedes" } as unknown as LineageRowLike];
    expect(buildSupersessionStory(bad, []).links).toHaveLength(0);
  });

  it("dedups by edge id so a self-loop can't double-count", () => {
    const same = row({ id: "loop", relation: "supersedes", parent_kind: "prd", parent_id: "X" });
    const sameChild = row({ id: "loop", relation: "supersedes", child_kind: "prd", child_id: "X" });
    const story = buildSupersessionStory([same], [sameChild]);
    expect(story.links).toHaveLength(1);
  });

  it("treats a current link as not retired (valid_to absent or null)", () => {
    const a = row({ id: "cur", relation: "supersedes", parent_kind: "prd", parent_id: "A" });
    const story = buildSupersessionStory([a], []);
    expect(story.links[0].retired).toBe(false);
    expect(story.links[0].retiredAt).toBeNull();
    expect(story.revised).toBe(true);
  });

  it("marks a stamped valid_to as retired and EXCLUDES it from 'revised' (reversed revision)", () => {
    const retired = row({
      id: "rev",
      relation: "supersedes",
      parent_kind: "prd",
      parent_id: "A",
      valid_to: "2026-06-20T00:00:00.000Z",
    });
    const story = buildSupersessionStory([retired], []);
    expect(story.links[0].retired).toBe(true);
    expect(story.links[0].retiredAt).toBe("2026-06-20T00:00:00.000Z");
    // The only self-retiring link has itself been reversed, so the belief is NOT currently revised.
    expect(story.revised).toBe(false);
  });

  it("orders current links before retired ones", () => {
    const retired = row({
      id: "old",
      relation: "supersedes",
      parent_kind: "prd",
      parent_id: "A",
      valid_to: "2026-06-19T00:00:00.000Z",
    });
    const current = row({ id: "new", relation: "contradicts", child_kind: "prd", child_id: "B" });
    const story = buildSupersessionStory([retired], [current]);
    expect(story.links.map((l) => l.id)).toEqual(["new", "old"]);
  });

  it("treats a blank/whitespace valid_to as still current", () => {
    const blank = row({
      id: "blank",
      relation: "supersedes",
      parent_kind: "prd",
      parent_id: "A",
      valid_to: "   ",
    });
    expect(buildSupersessionStory([blank], []).links[0].retired).toBe(false);
  });
});

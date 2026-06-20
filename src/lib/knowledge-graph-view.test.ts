import { describe, it, expect } from "bun:test";
import {
  projectGraph,
  filterByTime,
  classifyRelation,
  isSuperseding,
  nodeKey,
  type RawLineageEdge,
  type GraphNodeKind,
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

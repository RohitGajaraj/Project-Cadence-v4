import { describe, it, expect } from "bun:test";
import {
  resolveGoverning,
  selectGoverningDecisions,
  formatGoverningDecisions,
  nextSupersessionFrontier,
  findGoverningFor,
} from "./governing-decision";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";

/** Build a `supersedes` edge: `parent` supersedes `child` (newer overturns prior). */
function edge(p: Partial<RawLineageEdge> & { id: string }): RawLineageEdge {
  return {
    id: p.id,
    parent_kind: p.parent_kind ?? "prd",
    parent_id: p.parent_id ?? "P",
    child_kind: p.child_kind ?? "prd",
    child_id: p.child_id ?? "C",
    relation: p.relation ?? "supersedes",
    rationale: p.rationale ?? null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    valid_to: p.valid_to,
  };
}

describe("resolveGoverning (DBR-3 supersedes-chain walk)", () => {
  it("returns the start node when there are no edges", () => {
    const r = resolveGoverning("prd", "A", []);
    expect(r.governingId).toBe("A");
    expect(r.hops).toBe(0);
    expect(r.contradicted).toBe(false);
  });

  it("steps from a superseded child to the governing parent", () => {
    const edges = [edge({ id: "e1", parent_id: "B", child_id: "A" })];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("B");
    expect(r.hops).toBe(1);
  });

  it("walks a multi-hop chain to the terminal current node", () => {
    // C supersedes B supersedes A -> from A the governing decision is C.
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A", created_at: "2026-02-01T00:00:00Z" }),
      edge({ id: "e2", parent_id: "C", child_id: "B", created_at: "2026-03-01T00:00:00Z" }),
    ];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("C");
    expect(r.hops).toBe(2);
  });

  it("ignores a retired (valid_to set) supersession - it no longer governs", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A", valid_to: "2026-05-01T00:00:00Z" }),
    ];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("A");
    expect(r.hops).toBe(0);
  });

  it("treats a blank-string valid_to as still current", () => {
    const edges = [edge({ id: "e1", parent_id: "B", child_id: "A", valid_to: "   " })];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("B");
  });

  it("flags a contradicted node without redirecting the chain", () => {
    const edges = [edge({ id: "e1", parent_id: "O", child_id: "A", relation: "contradicts" })];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("A"); // contradicts names no replacement
    expect(r.contradicted).toBe(true);
  });

  it("picks the NEWEST superseder when several are current", () => {
    const edges = [
      edge({ id: "old", parent_id: "B", child_id: "A", created_at: "2026-01-01T00:00:00Z" }),
      edge({ id: "new", parent_id: "C", child_id: "A", created_at: "2026-04-01T00:00:00Z" }),
    ];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("C");
    expect(r.hops).toBe(1);
  });

  it("terminates on a cycle (A supersedes B, B supersedes A)", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A" }),
      edge({ id: "e2", parent_id: "A", child_id: "B" }),
    ];
    const r = resolveGoverning("prd", "A", edges);
    // A -> B -> (would revisit A) stops; bounded, no infinite loop.
    expect(r.governingId).toBe("B");
    expect(r.hops).toBe(1);
  });

  it("carries the governing node's kind across the hop", () => {
    const edges = [edge({ id: "e1", parent_kind: "opportunity", parent_id: "B", child_id: "A" })];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingKind).toBe("opportunity");
  });

  it("tolerates malformed edges", () => {
    const edges = [
      { id: "bad" } as unknown as RawLineageEdge,
      edge({ id: "e1", parent_id: "B", child_id: "A" }),
    ];
    const r = resolveGoverning("prd", "A", edges);
    expect(r.governingId).toBe("B");
  });
});

describe("selectGoverningDecisions", () => {
  it("returns [] when nothing is stale", () => {
    const items = selectGoverningDecisions([], [{ kind: "prd", id: "A" }]);
    expect(items).toEqual([]);
  });

  it("surfaces a superseded precedent", () => {
    const edges = [edge({ id: "e1", parent_id: "B", child_id: "A" })];
    const items = selectGoverningDecisions(edges, [{ kind: "prd", id: "A" }]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ fromId: "A", governingId: "B", superseded: true, hops: 1 });
  });

  it("surfaces a contradicted-only precedent (no replacement)", () => {
    const edges = [edge({ id: "e1", parent_id: "O", child_id: "A", relation: "contradicts" })];
    const items = selectGoverningDecisions(edges, [{ kind: "prd", id: "A" }]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ superseded: false, contradicted: true });
  });

  it("drops a precedent that is still current", () => {
    const edges = [edge({ id: "e1", parent_id: "B", child_id: "X" })]; // unrelated to A
    const items = selectGoverningDecisions(edges, [{ kind: "prd", id: "A" }]);
    expect(items).toEqual([]);
  });

  it("dedupes repeated candidate ids and skips blanks", () => {
    const edges = [edge({ id: "e1", parent_id: "B", child_id: "A" })];
    const items = selectGoverningDecisions(edges, [
      { kind: "prd", id: "A" },
      { kind: "prd", id: "A" },
      { kind: "prd", id: "  " },
    ]);
    expect(items).toHaveLength(1);
  });

  it("caps the result at max", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A" }),
      edge({ id: "e2", parent_id: "D", child_id: "C" }),
    ];
    const items = selectGoverningDecisions(
      edges,
      [
        { kind: "prd", id: "A" },
        { kind: "prd", id: "C" },
      ],
      { max: 1 },
    );
    expect(items).toHaveLength(1);
  });

  it("defaults a blank kind to 'decision'", () => {
    const edges = [edge({ id: "e1", parent_id: "B", child_id: "A" })];
    const items = selectGoverningDecisions(edges, [{ kind: "", id: "A" }]);
    expect(items[0].fromKind).toBe("decision");
  });
});

describe("formatGoverningDecisions", () => {
  it("returns '' for no items", () => {
    expect(formatGoverningDecisions([])).toBe("");
  });

  it("renders a superseded correction naming the current decision", () => {
    const out = formatGoverningDecisions([
      {
        fromKind: "prd",
        fromId: "A",
        governingKind: "prd",
        governingId: "B",
        superseded: true,
        contradicted: false,
        hops: 1,
      },
    ]);
    expect(out).toContain("SUPERSEDED");
    expect(out).toContain("B");
    expect(out).toContain("CURRENT governing decision");
    expect(out).not.toContain("through"); // single hop has no chain suffix
  });

  it("NAMES the replacement decision when a title resolved", () => {
    const out = formatGoverningDecisions([
      {
        fromKind: "prd",
        fromId: "A",
        governingKind: "prd",
        governingId: "B",
        governingTitle: "New checkout flow",
        superseded: true,
        contradicted: false,
        hops: 1,
      },
    ]);
    expect(out).toContain('"New checkout flow"');
    expect(out).toContain("B"); // id kept alongside the title
  });

  it("notes the chain length for a multi-hop supersession", () => {
    const out = formatGoverningDecisions([
      {
        fromKind: "prd",
        fromId: "A",
        governingKind: "prd",
        governingId: "C",
        superseded: true,
        contradicted: false,
        hops: 2,
      },
    ]);
    expect(out).toContain("through 2 supersessions");
  });

  it("combines superseded + contradicted", () => {
    const out = formatGoverningDecisions([
      {
        fromKind: "prd",
        fromId: "A",
        governingKind: "prd",
        governingId: "B",
        superseded: true,
        contradicted: true,
        hops: 1,
      },
    ]);
    expect(out).toContain("CONTRADICTED");
    expect(out).toContain("SUPERSEDED");
  });

  it("renders a contradicted-only bullet without a replacement", () => {
    const out = formatGoverningDecisions([
      {
        fromKind: "prd",
        fromId: "A",
        governingKind: "prd",
        governingId: "A",
        superseded: false,
        contradicted: true,
        hops: 0,
      },
    ]);
    expect(out).toContain("CONTRADICTED");
    expect(out).toContain("no longer a safe basis");
  });
});

describe("nextSupersessionFrontier (closure expansion)", () => {
  it("returns the parent ids of current supersedes edges not yet seen", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A" }),
      edge({ id: "e2", parent_id: "D", child_id: "C" }),
    ];
    const out = nextSupersessionFrontier(edges, new Set(["A", "C"]));
    expect(out.sort()).toEqual(["B", "D"]);
  });

  it("skips retired (valid_to set) edges", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A", valid_to: "2026-05-01T00:00:00Z" }),
    ];
    expect(nextSupersessionFrontier(edges, new Set(["A"]))).toEqual([]);
  });

  it("skips contradicts edges (they name no replacement to walk to)", () => {
    const edges = [edge({ id: "e1", parent_id: "O", child_id: "A", relation: "contradicts" })];
    expect(nextSupersessionFrontier(edges, new Set(["A"]))).toEqual([]);
  });

  it("dedupes and skips already-seen parents", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A" }),
      edge({ id: "e2", parent_id: "B", child_id: "X" }), // same parent
      edge({ id: "e3", parent_id: "S", child_id: "Y" }), // S already seen
    ];
    const out = nextSupersessionFrontier(edges, new Set(["A", "X", "Y", "S"]));
    expect(out).toEqual(["B"]);
  });

  it("simulating the closure loop assembles a chain the focus set alone would truncate", () => {
    // Real production shape: C supersedes B supersedes A, only A is a precedent (seed).
    // Round 0 fetches edges with child_id in {A}; round 1 fetches child_id in {B}; etc.
    const all = [
      edge({ id: "e_ba", parent_id: "B", child_id: "A", created_at: "2026-02-01T00:00:00Z" }),
      edge({ id: "e_cb", parent_id: "C", child_id: "B", created_at: "2026-03-01T00:00:00Z" }),
    ];
    const fetchByChild = (frontier: string[]) => all.filter((e) => frontier.includes(e.child_id));
    const collected: ReturnType<typeof edge>[] = [];
    const seen = new Set<string>(["A"]);
    let frontier = ["A"];
    for (let round = 0; round < 8 && frontier.length; round++) {
      const batch = fetchByChild(frontier);
      collected.push(...batch);
      frontier = nextSupersessionFrontier(batch, seen);
      for (const id of frontier) seen.add(id);
    }
    // The closure has BOTH edges, so the walk reaches the true terminal C.
    const r = resolveGoverning("prd", "A", collected);
    expect(r.governingId).toBe("C");
    expect(r.hops).toBe(2);
  });
});

describe("findGoverningFor (annotate a precedent by id)", () => {
  const items = selectGoverningDecisions(
    [
      edge({ id: "e1", parent_id: "B", child_id: "A" }), // prd A superseded by B
      edge({ id: "e2", parent_id: "O", child_id: "Q", relation: "contradicts" }), // opp Q contradicted
    ],
    [
      { kind: "prd", id: "A" },
      { kind: "opportunity", id: "Q" },
    ],
  );

  it("matches a precedent by its prd id", () => {
    expect(findGoverningFor("A", null, items)?.governingId).toBe("B");
  });

  it("matches a precedent by its opportunity id", () => {
    expect(findGoverningFor(null, "Q", items)?.contradicted).toBe(true);
  });

  it("returns null for a still-current precedent", () => {
    expect(findGoverningFor("Z", "Z", items)).toBeNull();
  });

  it("returns null when both ids are null", () => {
    expect(findGoverningFor(null, null, items)).toBeNull();
  });
});

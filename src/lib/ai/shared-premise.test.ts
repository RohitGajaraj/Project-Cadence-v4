import { describe, it, expect } from "bun:test";
import {
  isDerivationEdge,
  collectPremiseAncestors,
  collectSharedPremiseCousins,
  selectSharedPremisePrecedents,
  formatSharedPremisePrecedent,
  canonicalizeEdges,
  type SharedPremiseOutcome,
} from "./shared-premise";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";

/** Build a derivation edge: `parent` is the premise, `child` is derived from it. */
function edge(
  p: Partial<RawLineageEdge> & { id: string; parent_id: string; child_id: string },
): RawLineageEdge {
  return {
    id: p.id,
    parent_kind: p.parent_kind ?? "opportunity",
    parent_id: p.parent_id,
    child_kind: p.child_kind ?? "prd",
    child_id: p.child_id,
    relation: p.relation ?? "promoted",
    rationale: p.rationale ?? null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    valid_to: p.valid_to,
  };
}

describe("isDerivationEdge", () => {
  it("accepts derivation relations (promoted/cites/derived-from/depends-on)", () => {
    for (const relation of ["promoted", "cites", "derived-from", "depends-on"]) {
      expect(isDerivationEdge(edge({ id: "e", parent_id: "A", child_id: "B", relation }))).toBe(
        true,
      );
    }
  });

  it("treats a blank/null relation as promoted (recordLineage's default)", () => {
    expect(isDerivationEdge(edge({ id: "e", parent_id: "A", child_id: "B", relation: null }))).toBe(
      true,
    );
    expect(isDerivationEdge(edge({ id: "e", parent_id: "A", child_id: "B", relation: "" }))).toBe(
      true,
    );
  });

  it("rejects outcome-reversal relations and self-loops", () => {
    expect(
      isDerivationEdge(edge({ id: "e", parent_id: "A", child_id: "B", relation: "supersedes" })),
    ).toBe(false);
    expect(
      isDerivationEdge(edge({ id: "e", parent_id: "A", child_id: "B", relation: "contradicts" })),
    ).toBe(false);
    expect(isDerivationEdge(edge({ id: "e", parent_id: "A", child_id: "A" }))).toBe(false);
    expect(isDerivationEdge(null)).toBe(false);
  });
});

describe("collectPremiseAncestors (walk up child -> parent)", () => {
  it("returns [] with no edges", () => {
    expect(collectPremiseAncestors("P", [])).toEqual([]);
  });

  it("collects a single direct premise", () => {
    const edges = [edge({ id: "e1", parent_id: "O", child_id: "P" })];
    expect(collectPremiseAncestors("P", edges)).toEqual(["O"]);
  });

  it("walks multi-hop to all premise ancestors (signal -> opp -> prd)", () => {
    const edges = [
      edge({ id: "e1", parent_id: "O", child_id: "P", parent_kind: "opportunity" }),
      edge({ id: "e2", parent_id: "S", child_id: "O", parent_kind: "signal" }),
    ];
    expect(collectPremiseAncestors("P", edges).sort()).toEqual(["O", "S"]);
  });

  it("excludes supersedes/contradicts edges from the premise walk", () => {
    const edges = [
      edge({ id: "e1", parent_id: "X", child_id: "P", relation: "supersedes" }),
      edge({ id: "e2", parent_id: "O", child_id: "P", relation: "promoted" }),
    ];
    expect(collectPremiseAncestors("P", edges)).toEqual(["O"]);
  });

  it("is cycle-guarded (A<->B never loops)", () => {
    const edges = [
      edge({ id: "e1", parent_id: "B", child_id: "A" }),
      edge({ id: "e2", parent_id: "A", child_id: "B" }),
    ];
    expect(collectPremiseAncestors("A", edges)).toEqual(["B"]);
  });
});

describe("collectSharedPremiseCousins (descendants of premises, minus the target's path)", () => {
  // S -> O1 (target), S -> O2, O2 -> Pb, O1 -> Pa
  const edges = [
    edge({
      id: "e1",
      parent_id: "S",
      child_id: "O1",
      parent_kind: "signal",
      child_kind: "opportunity",
    }),
    edge({
      id: "e2",
      parent_id: "S",
      child_id: "O2",
      parent_kind: "signal",
      child_kind: "opportunity",
    }),
    edge({ id: "e3", parent_id: "O2", child_id: "Pb", child_kind: "prd" }),
    edge({ id: "e4", parent_id: "O1", child_id: "Pa", child_kind: "prd" }),
  ];
  const target = { kind: "opportunity", id: "O1" };
  const ancestors = collectPremiseAncestors("O1", edges); // ["S"]

  it("finds cousins that share the premise but sit off the target's path", () => {
    const ids = collectSharedPremiseCousins(target, ancestors, edges)
      .map((c) => c.id)
      .sort();
    expect(ids).toEqual(["O2", "Pb"]);
  });

  it("excludes the target itself and the target's own descendants (Pa)", () => {
    const ids = collectSharedPremiseCousins(target, ancestors, edges).map((c) => c.id);
    expect(ids).not.toContain("O1");
    expect(ids).not.toContain("Pa");
  });

  it("excludes the premise ancestors themselves", () => {
    const ids = collectSharedPremiseCousins(target, ancestors, edges).map((c) => c.id);
    expect(ids).not.toContain("S");
  });

  it("carries the cousin's node kind", () => {
    const cousins = collectSharedPremiseCousins(target, ancestors, edges);
    expect(cousins.find((c) => c.id === "Pb")?.kind).toBe("prd");
    expect(cousins.find((c) => c.id === "O2")?.kind).toBe("opportunity");
  });

  it("excludes a deep target-descendant even when a shorter sibling path also reaches it", () => {
    // A -> T (target); A -> B (sibling). The target owns a deep chain
    // T -> c1 -> c2 -> c3 -> c4 -> c5 -> X (X is 6 hops below the target), and B ALSO
    // reaches X in one hop. A depth-capped subtree walk would miss X (6 > MAX_HOPS) and
    // leak it as a false cousin; the depth-complete exclusion must still drop it.
    const deep = [
      edge({ id: "a1", parent_id: "A", child_id: "T" }),
      edge({ id: "a2", parent_id: "A", child_id: "B" }),
      edge({ id: "d1", parent_id: "T", child_id: "c1" }),
      edge({ id: "d2", parent_id: "c1", child_id: "c2" }),
      edge({ id: "d3", parent_id: "c2", child_id: "c3" }),
      edge({ id: "d4", parent_id: "c3", child_id: "c4" }),
      edge({ id: "d5", parent_id: "c4", child_id: "c5" }),
      edge({ id: "d6", parent_id: "c5", child_id: "X" }),
      edge({ id: "b1", parent_id: "B", child_id: "X" }),
    ];
    const t = { kind: "opportunity", id: "T" };
    const anc = collectPremiseAncestors("T", deep); // ["A"]
    const ids = collectSharedPremiseCousins(t, anc, deep).map((c) => c.id);
    expect(ids).toContain("B"); // the genuine sibling
    expect(ids).not.toContain("X"); // the target's own (deep) descendant, never a cousin
  });
});

describe("selectSharedPremisePrecedents", () => {
  const cousins = [
    { kind: "opportunity", id: "O2" },
    { kind: "prd", id: "Pb" },
    { kind: "prd", id: "Pc" },
  ];

  it("keeps only cousins with a recorded outcome", () => {
    const outcomes = new Map<string, SharedPremiseOutcome>([
      ["Pb", { verdict: "missed", title: "Spec B" }],
    ]);
    const items = selectSharedPremisePrecedents(cousins, outcomes);
    expect(items.map((i) => i.id)).toEqual(["Pb"]);
  });

  it("ranks the cautionary signal first (missed before validated)", () => {
    const outcomes = new Map<string, SharedPremiseOutcome>([
      ["Pc", { verdict: "validated", title: "Spec C", checkedAt: "2026-06-10T00:00:00Z" }],
      ["Pb", { verdict: "missed", title: "Spec B", checkedAt: "2026-06-01T00:00:00Z" }],
    ]);
    const items = selectSharedPremisePrecedents(cousins, outcomes);
    expect(items.map((i) => i.verdict)).toEqual(["missed", "validated"]);
  });

  it("orders ties by newest checkedAt", () => {
    const outcomes = new Map<string, SharedPremiseOutcome>([
      ["Pb", { verdict: "validated", title: "B", checkedAt: "2026-06-01T00:00:00Z" }],
      ["Pc", { verdict: "validated", title: "C", checkedAt: "2026-06-09T00:00:00Z" }],
    ]);
    const items = selectSharedPremisePrecedents(cousins, outcomes);
    expect(items.map((i) => i.id)).toEqual(["Pc", "Pb"]);
  });

  it("caps the result", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ kind: "prd", id: `P${i}` }));
    const outcomes = new Map<string, SharedPremiseOutcome>(
      many.map((c) => [c.id, { verdict: "missed" as const }]),
    );
    expect(selectSharedPremisePrecedents(many, outcomes, { max: 3 })).toHaveLength(3);
  });

  it("ignores an unknown verdict and empty input", () => {
    expect(selectSharedPremisePrecedents([], new Map())).toEqual([]);
    const outcomes = new Map<string, SharedPremiseOutcome>([
      ["Pb", { verdict: "bogus" as unknown as "missed" }],
    ]);
    expect(selectSharedPremisePrecedents(cousins, outcomes)).toEqual([]);
  });
});

describe("formatSharedPremisePrecedent", () => {
  it("returns '' for no items", () => {
    expect(formatSharedPremisePrecedent([])).toBe("");
  });

  it("names the precedent, its fate, and the shared-premise provenance", () => {
    const out = formatSharedPremisePrecedent([
      {
        kind: "prd",
        id: "Pb",
        title: "Checkout v1",
        verdict: "missed",
        summary: "shipped, no lift",
        checkedAt: null,
      },
    ]);
    expect(out).toContain("Shared-premise precedent");
    expect(out).toContain('"Checkout v1"');
    expect(out).toContain("MISSED");
    expect(out).toContain("shipped, no lift");
    expect(out).toContain("same upstream premise");
  });

  it("NAMES the shared premise when its title resolved (DBR-3h)", () => {
    const out = formatSharedPremisePrecedent([
      {
        kind: "prd",
        id: "Pb",
        title: "Checkout v1",
        verdict: "missed",
        summary: "no lift",
        checkedAt: null,
        premiseKind: "opportunity",
        premiseId: "O1",
        premiseTitle: "Mobile checkout revamp",
      },
    ]);
    expect(out).toContain('the same opportunity ("Mobile checkout revamp")');
    expect(out).not.toContain("the same upstream premise");
  });
});

describe("collectSharedPremiseCousins premise provenance (DBR-3h)", () => {
  it("shares the signal premise when cousins sit under sibling opportunities", () => {
    // S -> O1 (target), S -> O2, O2 -> Pb : O1 and O2 share signal S.
    const edges = [
      edge({
        id: "e1",
        parent_id: "S",
        child_id: "O1",
        parent_kind: "signal",
        child_kind: "opportunity",
      }),
      edge({
        id: "e2",
        parent_id: "S",
        child_id: "O2",
        parent_kind: "signal",
        child_kind: "opportunity",
      }),
      edge({ id: "e3", parent_id: "O2", child_id: "Pb", child_kind: "prd" }),
    ];
    const anc = collectPremiseAncestors("O1", edges);
    const cousins = collectSharedPremiseCousins({ kind: "opportunity", id: "O1" }, anc, edges);
    const pb = cousins.find((c) => c.id === "Pb");
    expect(pb?.premiseId).toBe("S");
    expect(pb?.premiseKind).toBe("signal");
  });

  it("shares the CLOSEST common ancestor (the opportunity, not the signal above it)", () => {
    // S -> O1; O1 -> Pa (target), O1 -> Pc : Pa and Pc share opportunity O1 (closer than S).
    const edges = [
      edge({
        id: "e1",
        parent_id: "S",
        child_id: "O1",
        parent_kind: "signal",
        child_kind: "opportunity",
      }),
      edge({
        id: "e2",
        parent_id: "O1",
        child_id: "Pa",
        parent_kind: "opportunity",
        child_kind: "prd",
      }),
      edge({
        id: "e3",
        parent_id: "O1",
        child_id: "Pc",
        parent_kind: "opportunity",
        child_kind: "prd",
      }),
    ];
    const anc = collectPremiseAncestors("Pa", edges); // [O1, S]
    const cousins = collectSharedPremiseCousins({ kind: "prd", id: "Pa" }, anc, edges);
    const pc = cousins.find((c) => c.id === "Pc");
    expect(pc?.premiseId).toBe("O1");
    expect(pc?.premiseKind).toBe("opportunity");
  });

  it("falls back to the id when the title is missing", () => {
    const out = formatSharedPremisePrecedent([
      {
        kind: "prd",
        id: "abc-123",
        title: null,
        verdict: "validated",
        summary: null,
        checkedAt: null,
      },
    ]);
    expect(out).toContain("(abc-123)");
    expect(out).toContain("was VALIDATED");
  });
});

describe("canonicalizeEdges (DBR entity-resolution wiring)", () => {
  it("rewrites parent_id/child_id through canonicalId, keeping every other field", () => {
    const edges = [
      edge({
        id: "e1",
        parent_id: "A",
        child_id: "B",
        parent_kind: "opportunity",
        child_kind: "prd",
      }),
    ];
    const out = canonicalizeEdges(edges, (id) => (id === "B" ? "B0" : id));
    expect(out[0].parent_id).toBe("A");
    expect(out[0].child_id).toBe("B0");
    expect(out[0].parent_kind).toBe("opportunity");
    expect(out[0].child_kind).toBe("prd");
    expect(out[0].relation).toBe(edges[0].relation);
    expect(out[0].id).toBe("e1");
  });

  it("identity canonicalId leaves ids unchanged (byte-identical walk)", () => {
    const edges = [edge({ id: "e1", parent_id: "A", child_id: "B" })];
    const out = canonicalizeEdges(edges, (id) => id);
    expect(out[0].parent_id).toBe("A");
    expect(out[0].child_id).toBe("B");
  });

  it("collapsing two same-entity premises makes the walk find the cousin across them", () => {
    // O1 -> Pa (target), O2 -> Pb. O1 and O2 are the SAME initiative (collapse O2 -> O1).
    // Without collapse Pa and Pb have DIFFERENT premises (no shared cousin); after collapse
    // they share premise O1, so Pb becomes a cousin of Pa.
    const edges = [
      edge({
        id: "e1",
        parent_id: "O1",
        child_id: "Pa",
        parent_kind: "opportunity",
        child_kind: "prd",
      }),
      edge({
        id: "e2",
        parent_id: "O2",
        child_id: "Pb",
        parent_kind: "opportunity",
        child_kind: "prd",
      }),
    ];
    // baseline: no collapse -> Pa's only ancestor is O1, Pb sits under O2 -> not a cousin
    const baseAnc = collectPremiseAncestors("Pa", edges);
    expect(
      collectSharedPremiseCousins({ kind: "prd", id: "Pa" }, baseAnc, edges).map((c) => c.id),
    ).not.toContain("Pb");
    // collapse O2 -> O1 -> Pb is now reachable down from Pa's premise O1
    const collapsed = canonicalizeEdges(edges, (id) => (id === "O2" ? "O1" : id));
    const anc = collectPremiseAncestors("Pa", collapsed);
    expect(anc).toContain("O1");
    expect(
      collectSharedPremiseCousins({ kind: "prd", id: "Pa" }, anc, collapsed).map((c) => c.id),
    ).toContain("Pb");
  });
});

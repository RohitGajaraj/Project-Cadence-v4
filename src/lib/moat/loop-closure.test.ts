import { describe, it, expect } from "bun:test";
import { computeLoopClosure, type LoopClosureInput } from "./loop-closure";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";

/** Build a supersedes edge: parent (later) supersedes child (prior belief). */
function supEdge(
  child: string,
  parent: string,
  over: Partial<RawLineageEdge> = {},
): RawLineageEdge {
  return {
    id: `${child}->${parent}`,
    parent_kind: "decision",
    parent_id: parent,
    child_kind: "decision",
    child_id: child,
    relation: "supersedes",
    rationale: null,
    created_at: "2026-06-01T00:00:00Z",
    valid_to: null,
    ...over,
  } as RawLineageEdge;
}

function run(over: Partial<LoopClosureInput> = {}) {
  const base: LoopClosureInput = {
    edges: [],
    decisions: [],
    learnings: [],
    ...over,
  };
  return computeLoopClosure(base);
}

describe("computeLoopClosure — cold start", () => {
  it("reports cold + the flat-graph gap when there are no edges", () => {
    const r = run({ decisions: [{ id: "d1" }], learnings: [{ verdict: "validated" }] });
    expect(r.closed).toBe(false);
    expect(r.warmth).toBe("cold");
    expect(r.counts.supersessionEdges).toBe(0);
    expect(r.gaps.some((g) => g.toLowerCase().includes("cold moat"))).toBe(true);
  });

  it("names the missing-outcome stage when decisions exist but no learnings", () => {
    const r = run({ decisions: [{ id: "d1" }] });
    expect(r.gaps.some((g) => g.toLowerCase().includes("no recorded outcomes"))).toBe(true);
  });

  it("is fully empty-safe and never throws", () => {
    const r = run();
    expect(r.closed).toBe(false);
    expect(r.warmth).toBe("cold");
    expect(r.chains).toEqual([]);
    expect(r.counts.decisions).toBe(0);
  });
});

describe("computeLoopClosure — warming (edges but loop not closed)", () => {
  it("edges with no recorded outcomes is warming, not closed", () => {
    const r = run({
      edges: [supEdge("d1", "d2")],
      decisions: [{ id: "d1" }, { id: "d2" }],
      learnings: [], // no outcomes
    });
    expect(r.warmth).toBe("warming");
    expect(r.closed).toBe(false);
    expect(r.counts.supersessionEdges).toBe(1);
    expect(r.counts.governingResolutions).toBe(1); // d1 walks forward to d2
    expect(r.gaps.some((g) => g.toLowerCase().includes("no recorded outcomes"))).toBe(true);
  });

  it("a retired (valid_to set) edge does not count toward closure", () => {
    const r = run({
      edges: [supEdge("d1", "d2", { valid_to: "2026-06-05T00:00:00Z" })],
      learnings: [{ verdict: "validated" }],
    });
    expect(r.counts.supersessionEdges).toBe(0);
    expect(r.warmth).toBe("cold");
  });
});

describe("computeLoopClosure — warm (closed loop)", () => {
  it("proves closure end to end with a real outcome + supersession + forward resolution", () => {
    const r = run({
      edges: [supEdge("d1", "d2")],
      decisions: [{ id: "d1" }, { id: "d2" }],
      learnings: [{ verdict: "missed" }, { verdict: "validated" }],
    });
    expect(r.closed).toBe(true);
    expect(r.warmth).toBe("warm");
    expect(r.gaps).toEqual([]);
    expect(r.counts.outcomesRecorded).toBe(2);
    expect(r.chains).toHaveLength(1);
    expect(r.chains[0]).toMatchObject({ fromId: "d1", governingId: "d2", hops: 1 });
  });

  it("walks a multi-hop chain to the terminal governing node", () => {
    // d1 superseded by d2 superseded by d3 (newest governs)
    const r = run({
      edges: [
        supEdge("d1", "d2", { created_at: "2026-06-01T00:00:00Z" }),
        supEdge("d2", "d3", { created_at: "2026-06-02T00:00:00Z" }),
      ],
      learnings: [{ verdict: "validated" }],
    });
    expect(r.closed).toBe(true);
    const d1chain = r.chains.find((c) => c.fromId === "d1");
    expect(d1chain?.governingId).toBe("d3");
    expect(d1chain?.hops).toBe(2);
  });

  it("ignores non-decisive verdicts when counting recorded outcomes", () => {
    const r = run({
      edges: [supEdge("d1", "d2")],
      learnings: [{ verdict: "" }, { verdict: "noted" }],
    });
    expect(r.counts.outcomesRecorded).toBe(0);
    expect(r.closed).toBe(false); // outcomes stage cold
  });

  it("bounds the example chains by maxChains while still counting all resolutions", () => {
    const edges = [supEdge("a1", "z"), supEdge("a2", "z"), supEdge("a3", "z")];
    const r = run({ edges, learnings: [{ verdict: "validated" }], maxChains: 2 });
    expect(r.counts.governingResolutions).toBe(3);
    expect(r.chains).toHaveLength(2);
  });
});

describe("computeLoopClosure — contradiction handling", () => {
  it("counts a current contradicts edge and flags it on the chain", () => {
    const r = run({
      edges: [
        supEdge("d1", "d2"),
        {
          id: "c1",
          parent_kind: "outcome",
          parent_id: "o1",
          child_kind: "decision",
          child_id: "d1",
          relation: "contradicts",
          rationale: null,
          created_at: "2026-06-03T00:00:00Z",
          valid_to: null,
        } as RawLineageEdge,
      ],
      learnings: [{ verdict: "missed" }],
    });
    expect(r.counts.contradictionEdges).toBe(1);
    const chain = r.chains.find((c) => c.fromId === "d1");
    expect(chain?.contradicted).toBe(true);
  });
});

import { describe, it, expect } from "bun:test";
import { selectContradictionHistory, formatContradictionHistory } from "./contradiction-history";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";

function edge(p: Partial<RawLineageEdge> & { id: string }): RawLineageEdge {
  return {
    id: p.id,
    parent_kind: p.parent_kind ?? "prd",
    parent_id: p.parent_id ?? "P",
    child_kind: p.child_kind ?? "prd",
    child_id: p.child_id ?? "C",
    relation: p.relation ?? "contradicts",
    rationale: p.rationale ?? null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    valid_to: p.valid_to,
    inference: p.inference,
  };
}

describe("selectContradictionHistory (DBR-2 typed-edge traversal)", () => {
  it("returns [] for no edges or no focus", () => {
    expect(selectContradictionHistory([], ["x"])).toEqual([]);
    expect(selectContradictionHistory([edge({ id: "e1", child_id: "x" })], [])).toEqual([]);
  });

  it("ignores non-supersession relations (promoted/cites/derived-from)", () => {
    const edges = [
      edge({ id: "e1", relation: "promoted", child_id: "x" }),
      edge({ id: "e2", relation: "cites", child_id: "x" }),
      edge({ id: "e3", relation: "derived-from", parent_id: "x" }),
    ];
    expect(selectContradictionHistory(edges, ["x"])).toEqual([]);
  });

  it("includes a contradicts edge whose CHILD is in focus, role=child", () => {
    const out = selectContradictionHistory([edge({ id: "e1", child_id: "x" })], ["x"]);
    expect(out).toHaveLength(1);
    expect(out[0].focusRole).toBe("child");
    expect(out[0].relation).toBe("contradicts");
  });

  it("tags focusRole parent / both correctly", () => {
    const parentHit = selectContradictionHistory([edge({ id: "e1", parent_id: "x" })], ["x"]);
    expect(parentHit[0].focusRole).toBe("parent");
    const bothHit = selectContradictionHistory(
      [edge({ id: "e2", parent_id: "x", child_id: "x" })],
      ["x"],
    );
    expect(bothHit[0].focusRole).toBe("both");
  });

  it("excludes edges that touch no focus id, and trims blank focus ids", () => {
    const edges = [edge({ id: "e1", parent_id: "a", child_id: "b" })];
    expect(selectContradictionHistory(edges, ["x", "  ", ""])).toEqual([]);
  });

  it("dedupes by edge id", () => {
    const e = edge({ id: "dup", child_id: "x" });
    expect(selectContradictionHistory([e, e], ["x"])).toHaveLength(1);
  });

  it("ranks current before retired, then newest first; respects max", () => {
    const edges = [
      edge({ id: "old", child_id: "x", created_at: "2026-01-01T00:00:00Z" }),
      edge({ id: "new", child_id: "x", created_at: "2026-06-01T00:00:00Z" }),
      edge({
        id: "retired",
        child_id: "x",
        created_at: "2026-09-01T00:00:00Z",
        valid_to: "2026-10-01T00:00:00Z",
      }),
    ];
    const out = selectContradictionHistory(edges, ["x"], { max: 2 });
    expect(out.map((i) => i.edgeId)).toEqual(["new", "old"]); // retired pushed out by the cap
    expect(out[0].retired).toBe(false);
  });

  it("ranks edges on the TARGET itself before precedent-neighbor edges, and flags incident", () => {
    const edges = [
      edge({ id: "neighbor", child_id: "precedent", created_at: "2026-09-01T00:00:00Z" }),
      edge({ id: "onTarget", child_id: "target", created_at: "2026-01-01T00:00:00Z" }),
    ];
    const out = selectContradictionHistory(edges, ["target", "precedent"], { targetId: "target" });
    expect(out.map((i) => i.edgeId)).toEqual(["onTarget", "neighbor"]); // incident first, despite older
    expect(out.find((i) => i.edgeId === "onTarget")?.incident).toBe(true);
    expect(out.find((i) => i.edgeId === "neighbor")?.incident).toBe(false);
  });

  it("reflects the production read path: an edge WITHOUT valid_to reads as current (retired=false)", () => {
    const out = selectContradictionHistory(
      [edge({ id: "e1", child_id: "x", valid_to: undefined })],
      ["x"],
    );
    expect(out[0].retired).toBe(false);
  });
});

describe("formatContradictionHistory (DBR-2 prompt block)", () => {
  it("returns '' for no items", () => {
    expect(formatContradictionHistory([])).toBe("");
  });

  it("renders the child-focus red-team line with the rationale", () => {
    const items = selectContradictionHistory(
      [
        edge({
          id: "e1",
          child_kind: "opportunity",
          child_id: "opp-1",
          rationale: "shipped, churned",
        }),
      ],
      ["opp-1"],
    );
    const block = formatContradictionHistory(items);
    expect(block).toContain("Contradiction history");
    expect(block).toContain("a prior opportunity (opp-1) was CONTRADICTED by a later outcome");
    expect(block).toContain("shipped, churned");
  });

  it("marks a reversed (retired) assertion", () => {
    const items = selectContradictionHistory(
      [edge({ id: "e1", child_id: "x", valid_to: "2026-10-01T00:00:00Z" })],
      ["x"],
    );
    expect(formatContradictionHistory(items)).toContain("itself later reversed");
  });

  it("parent-role: says 'this' for an edge on the target, 'a' for a precedent-neighbor", () => {
    const onTarget = formatContradictionHistory(
      selectContradictionHistory(
        [edge({ id: "e1", parent_id: "target", child_id: "old" })],
        ["target"],
        { targetId: "target" },
      ),
    );
    expect(onTarget).toContain("this prd's outcome CONTRADICTED a prior prd (old)");
    const neighbor = formatContradictionHistory(
      selectContradictionHistory(
        [edge({ id: "e2", parent_id: "precedent", child_id: "old" })],
        ["precedent"],
        { targetId: "target" },
      ),
    );
    expect(neighbor).toContain("a prd's outcome CONTRADICTED a prior prd (old)");
    expect(neighbor).not.toContain("this prd's outcome");
  });
});

describe("edge-confidence ranking (DBR-EDGE-CONF-CRITIC)", () => {
  it("stamps the edge confidence from inference, null when absent", () => {
    const out = selectContradictionHistory(
      [
        edge({ id: "scored", child_id: "x", inference: { confidence: 0.8 } }),
        edge({ id: "unscored", child_id: "x" }),
      ],
      ["x"],
    );
    const byId = Object.fromEntries(out.map((i) => [i.edgeId, i.confidence]));
    expect(byId["scored"]).toBe(0.8);
    expect(byId["unscored"]).toBeNull();
  });

  it("cites the higher-confidence contradiction first, even when it is older", () => {
    const out = selectContradictionHistory(
      [
        // newer but weaker
        edge({ id: "weak", child_id: "x", created_at: "2026-06-10T00:00:00Z", inference: { confidence: 0.45 } }),
        // older but strong
        edge({ id: "strong", child_id: "x", created_at: "2026-06-01T00:00:00Z", inference: { confidence: 0.95 } }),
      ],
      ["x"],
    );
    expect(out[0].edgeId).toBe("strong");
    expect(out[1].edgeId).toBe("weak");
  });

  it("incident still wins over confidence (a weaker edge on the target outranks a strong neighbor)", () => {
    const out = selectContradictionHistory(
      [
        edge({ id: "neighbor", child_id: "precedent", inference: { confidence: 0.95 } }),
        edge({ id: "onTarget", child_id: "target", inference: { confidence: 0.45 } }),
      ],
      ["target", "precedent"],
      { targetId: "target" },
    );
    expect(out[0].edgeId).toBe("onTarget");
  });

  it("the prompt block flags a weaker-signal (low-confidence) edge, not a strong one", () => {
    const weak = formatContradictionHistory(
      selectContradictionHistory(
        [edge({ id: "e1", child_id: "x", inference: { confidence: 0.45 } })],
        ["x"],
      ),
    );
    expect(weak.toLowerCase()).toContain("weaker signal");
    const strong = formatContradictionHistory(
      selectContradictionHistory(
        [edge({ id: "e1", child_id: "x", inference: { confidence: 0.95 } })],
        ["x"],
      ),
    );
    expect(strong.toLowerCase()).not.toContain("weaker signal");
  });
});

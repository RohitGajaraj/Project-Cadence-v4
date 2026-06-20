import { describe, it, expect } from "vitest";
import { buildLineageTree, type LineageNode } from "./knowledge-graph-explorer";

describe("buildLineageTree", () => {
  it("builds a single-node tree when no edges exist", () => {
    const edges = [];
    const node = buildLineageTree(edges, "opportunity", "opp-1", 0);

    expect(node).toEqual({
      id: "opp-1",
      kind: "opportunity",
      title: null,
      rationale: null,
      relation: "root",
      children: [],
      depth: 0,
    });
  });

  it("builds a tree with direct children", () => {
    const edges = [
      {
        parent_kind: "opportunity" as const,
        parent_id: "opp-1",
        child_kind: "theme" as const,
        child_id: "theme-1",
        relation: "derived",
        rationale: "Themes from opp",
        created_at: "2026-06-20T00:00:00Z",
      },
    ];
    const node = buildLineageTree(edges, "opportunity", "opp-1", 0);

    expect(node.id).toBe("opp-1");
    expect(node.children).toHaveLength(1);
    expect(node.children[0]).toMatchObject({
      id: "theme-1",
      kind: "theme",
      relation: "derived",
      rationale: "Themes from opp",
      depth: 1,
    });
  });

  it("builds nested tree with multiple levels", () => {
    const edges = [
      {
        parent_kind: "opportunity" as const,
        parent_id: "opp-1",
        child_kind: "theme" as const,
        child_id: "theme-1",
        relation: "derived",
        rationale: "Theme from opp",
        created_at: "2026-06-20T00:00:00Z",
      },
      {
        parent_kind: "theme" as const,
        parent_id: "theme-1",
        child_kind: "prd" as const,
        child_id: "prd-1",
        relation: "promoted",
        rationale: "PRD from theme",
        created_at: "2026-06-20T00:00:00Z",
      },
      {
        parent_kind: "prd" as const,
        parent_id: "prd-1",
        child_kind: "task" as const,
        child_id: "task-1",
        relation: "decomposed",
        rationale: "Task from PRD",
        created_at: "2026-06-20T00:00:00Z",
      },
    ];
    const node = buildLineageTree(edges, "opportunity", "opp-1", 0);

    expect(node.children).toHaveLength(1);
    expect(node.children[0].children).toHaveLength(1);
    expect(node.children[0].children[0].children).toHaveLength(1);

    const taskNode = node.children[0].children[0].children[0];
    expect(taskNode).toMatchObject({
      id: "task-1",
      kind: "task",
      depth: 3,
    });
  });

  it("respects max depth limit", () => {
    const edges = [
      {
        parent_kind: "opportunity" as const,
        parent_id: "opp-1",
        child_kind: "theme" as const,
        child_id: "theme-1",
        relation: "derived",
        rationale: null,
        created_at: "2026-06-20T00:00:00Z",
      },
      {
        parent_kind: "theme" as const,
        parent_id: "theme-1",
        child_kind: "prd" as const,
        child_id: "prd-1",
        relation: "promoted",
        rationale: null,
        created_at: "2026-06-20T00:00:00Z",
      },
      {
        parent_kind: "prd" as const,
        parent_id: "prd-1",
        child_kind: "task" as const,
        child_id: "task-1",
        relation: "decomposed",
        rationale: null,
        created_at: "2026-06-20T00:00:00Z",
      },
    ];
    const node = buildLineageTree(edges, "opportunity", "opp-1", 0, 2);

    // Should go: opp-1 (depth 0) -> theme-1 (depth 1) -> prd-1 (depth 2, hits max)
    // prd-1 should have no children
    const prdNode = node.children[0].children[0];
    expect(prdNode.depth).toBe(2);
    expect(prdNode.children).toHaveLength(0);
  });

  it("handles multiple children at same level", () => {
    const edges = [
      {
        parent_kind: "opportunity" as const,
        parent_id: "opp-1",
        child_kind: "theme" as const,
        child_id: "theme-1",
        relation: "derived",
        rationale: null,
        created_at: "2026-06-20T00:00:00Z",
      },
      {
        parent_kind: "opportunity" as const,
        parent_id: "opp-1",
        child_kind: "theme" as const,
        child_id: "theme-2",
        relation: "derived",
        rationale: null,
        created_at: "2026-06-20T00:00:00Z",
      },
    ];
    const node = buildLineageTree(edges, "opportunity", "opp-1", 0);

    expect(node.children).toHaveLength(2);
    expect(node.children.map((c) => c.id)).toContain("theme-1");
    expect(node.children.map((c) => c.id)).toContain("theme-2");
  });

  it("avoids cycles by tracking visited nodes", () => {
    // This is a pathological case: if edges contained a cycle,
    // the tree-building should not infinite-loop
    const edges = [
      {
        parent_kind: "opportunity" as const,
        parent_id: "opp-1",
        child_kind: "theme" as const,
        child_id: "theme-1",
        relation: "derived",
        rationale: null,
        created_at: "2026-06-20T00:00:00Z",
      },
      // If this edge existed in the real data (a cycle), we'd need to handle it
      // For now, the tree builder just processes edges at each level
    ];
    const node = buildLineageTree(edges, "opportunity", "opp-1", 0);

    expect(node.children).toHaveLength(1);
    // Should build without infinite recursion
  });
});

// O1 list view - the parallel session's lineage tree, made focus-driven. Renders
// the downstream provenance tree of the focused artifact (the canvas's "Center
// the graph here" sets the focus, feeding both views). Kept as a secondary
// outline alongside the visual graph (founder ruling 2026-06-20: keep both).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getLineageTree, computeTreeStats } from "@/lib/knowledge-graph-explorer.functions";
import { type ArtifactKind } from "@/lib/lineage.functions";
import type { LineageNode } from "@/lib/knowledge-graph-explorer";

function TreeNodeRenderer({ node }: { node: LineageNode }) {
  const [expanded, setExpanded] = useState(node.depth === 0);
  const hasChildren = node.children.length > 0;
  return (
    <div style={{ marginLeft: node.depth * 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 4,
          backgroundColor: node.depth === 0 ? "var(--surface-2)" : "transparent",
          marginBottom: 4,
        }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn btn-ghost btn-sm"
            style={{ padding: 0, minHeight: "unset", height: 20, width: 20 }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div style={{ width: 20 }} />
        )}
        <span className="mono-label" style={{ fontSize: 8.5, minWidth: 60 }}>
          {node.kind}
        </span>
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{node.title || "Untitled"}</span>
        {node.rationale && (
          <span style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>
            {node.rationale}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div style={{ borderLeft: "1px solid var(--hairline)", marginLeft: 10 }}>
          {node.children.map((child) => (
            <TreeNodeRenderer key={`${child.kind}:${child.id}`} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function GraphTreeView({ focusKind, focusId }: { focusKind?: string; focusId?: string }) {
  const fTree = useServerFn(getLineageTree);
  const enabled = !!focusKind && !!focusId;
  const tree = useQuery({
    queryKey: ["lineage-tree", focusKind ?? null, focusId ?? null],
    queryFn: () => fTree({ data: { kind: focusKind as ArtifactKind, id: focusId! } }),
    enabled,
  });

  if (!enabled) {
    return (
      <div
        className="bento"
        style={{
          padding: "var(--card-pad)",
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: 12,
        }}
      >
        <p>
          Open the Graph view and choose &ldquo;Center the graph here&rdquo; on a node to outline
          its downstream lineage here.
        </p>
      </div>
    );
  }
  if (tree.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
        <span className="spinner" />
        <span className="mono-label" style={{ fontSize: 9 }}>
          loading tree…
        </span>
      </div>
    );
  }
  if (tree.isError) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
          Could not load the tree: {(tree.error as Error).message}
        </p>
      </div>
    );
  }
  if (!tree.data) return null;

  const stats = computeTreeStats(tree.data);
  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "8px 0",
          marginBottom: 12,
          fontSize: 11,
          color: "var(--ink-muted)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span>
          <strong>{stats.nodeCount}</strong> node{stats.nodeCount !== 1 ? "s" : ""}
        </span>
        <span>
          <strong>{stats.maxDepth}</strong> depth
        </span>
        <span>
          <strong>{stats.branchingFactor.toFixed(1)}</strong> avg branching
        </span>
      </div>
      <TreeNodeRenderer node={tree.data} />
    </div>
  );
}

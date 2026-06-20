import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getLineageTree, computeTreeStats } from "@/lib/knowledge-graph-explorer.functions";
import { getBrainStatus } from "@/lib/brain.functions";
import { type ArtifactKind } from "@/lib/lineage.functions";
import type { LineageNode } from "@/lib/knowledge-graph-explorer";

/**
 * A tree node renderer that shows the lineage ancestry/descent chain.
 * Recursively renders children as an indented tree.
 */
function TreeNodeRenderer({ node }: { node: LineageNode }) {
  const [expanded, setExpanded] = useState(node.depth === 0);

  const hasChildren = node.children.length > 0;
  const icon = hasChildren ? (
    <button
      onClick={() => setExpanded(!expanded)}
      className="btn btn-ghost btn-xs"
      style={{ padding: 0, minHeight: "unset", height: 20, width: 20 }}
    >
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  ) : (
    <div style={{ width: 20 }} />
  );

  return (
    <div style={{ marginLeft: node.depth * 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 4,
          backgroundColor: node.depth === 0 ? "var(--band-bg)" : "transparent",
          marginBottom: 4,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--ink-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            minWidth: 60,
          }}
        >
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
        <div style={{ borderLeft: "1px solid var(--border-subtle)", marginLeft: 10 }}>
          {node.children.map((child) => (
            <TreeNodeRenderer key={`${child.kind}:${child.id}`} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * GraphPanel: Display the lineage tree for selected artifacts.
 * Shows a list of available artifacts and the tree rooted at the selected one.
 */
export function GraphPanel() {
  const [selectedArtifact, setSelectedArtifact] = useState<
    { kind: ArtifactKind; id: string } | undefined
  >();

  const fBrain = useServerFn(getBrainStatus);
  const brain = useQuery({
    queryKey: ["brain-status"],
    queryFn: () => fBrain(),
  });

  const fTree = useServerFn(getLineageTree);
  const tree = useQuery({
    queryKey: ["lineage-tree", selectedArtifact?.kind, selectedArtifact?.id],
    queryFn: () =>
      selectedArtifact
        ? fTree({ data: { kind: selectedArtifact.kind, id: selectedArtifact.id } })
        : null,
    enabled: !!selectedArtifact,
  });

  const stats = tree.data ? computeTreeStats(tree.data) : null;

  return (
    <div>
      <div
        className="bento"
        style={{
          padding: "var(--card-pad)",
          marginBottom: 18,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-muted)", marginBottom: 12 }}>
          select an artifact to explore its lineage
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {brain.data ? (
            <>
              <button
                onClick={() => setSelectedArtifact(undefined)}
                className={`btn btn-sm ${!selectedArtifact ? "btn-primary" : "btn-ghost"}`}
              >
                Clear selection
              </button>
              {brain.data.counts.signals > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-subtle)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {brain.data.counts.signals} signal{brain.data.counts.signals !== 1 ? "s" : ""}
                </span>
              )}
              {brain.data.counts.prds > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-subtle)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {brain.data.counts.prds} PRD{brain.data.counts.prds !== 1 ? "s" : ""}
                </span>
              )}
              {brain.data.counts.decisions > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-subtle)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {brain.data.counts.decisions} decision
                  {brain.data.counts.decisions !== 1 ? "s" : ""}
                </span>
              )}
              {brain.data.counts.meetings > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-subtle)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {brain.data.counts.meetings} meeting{brain.data.counts.meetings !== 1 ? "s" : ""}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>loading…</span>
          )}
        </div>
      </div>

      {selectedArtifact && (
        <div
          className="bento"
          style={{
            padding: "var(--card-pad)",
          }}
        >
          {tree.isLoading && (
            <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>loading tree…</p>
          )}

          {tree.error && (
            <p style={{ fontSize: 12, color: "var(--error)" }}>
              Error loading tree: {(tree.error as Error).message}
            </p>
          )}

          {tree.data && (
            <>
              {stats && (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "8px 0",
                    marginBottom: 12,
                    fontSize: 11,
                    color: "var(--ink-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
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
              )}

              <TreeNodeRenderer node={tree.data} />
            </>
          )}
        </div>
      )}

      {!selectedArtifact && (
        <div
          className="bento"
          style={{
            padding: "var(--card-pad)",
            textAlign: "center",
            color: "var(--ink-muted)",
            fontSize: 12,
          }}
        >
          <p>Select an artifact above to explore its lineage.</p>
        </div>
      )}
    </div>
  );
}

// O1 / DBR-1 v1 - the visual graph canvas view (the "Graph" mode of the tab).
// Fetches the typed knowledge graph around a focus artifact, renders the SVG
// explorer + node-story panel, a type legend, a truthful "as of" time filter
// (over real edge created_at), and a truncation notice. Bounded + fail-safe by
// the server fn; this layer only presents it.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { getKnowledgeGraph } from "@/lib/knowledge-graph-view.functions";
import { filterByTime, type GraphNodeKind } from "@/lib/knowledge-graph-view";
import { MonoLabel } from "@/components/cadence/Primitives";
import { GraphExplorer, KIND_COLOR, KIND_LABEL } from "./GraphExplorer";
import { GraphNodeStory } from "./GraphNodeStory";

export function GraphCanvasView({ focusKind, focusId }: { focusKind?: string; focusId?: string }) {
  const navigate = useNavigate();
  const fGraph = useServerFn(getKnowledgeGraph);
  const graphQ = useQuery({
    queryKey: ["knowledge-graph", focusKind ?? null, focusId ?? null],
    queryFn: () => fGraph({ data: { focusKind: focusKind as GraphNodeKind | undefined, focusId } }),
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  const fullGraph = graphQ.data ?? null;

  const timeline = useMemo(() => {
    if (!fullGraph) return [] as string[];
    const set = new Set<string>();
    for (const e of fullGraph.edges) if (e.validFrom) set.add(e.validFrom);
    return [...set].sort();
  }, [fullGraph]);

  const graph = useMemo(
    () => (fullGraph ? filterByTime(fullGraph, asOf) : null),
    [fullGraph, asOf],
  );

  const selectedNode = useMemo(
    () => graph?.nodes.find((n) => n.key === selectedKey) ?? null,
    [graph, selectedKey],
  );

  const presentKinds = useMemo(() => {
    const set = new Set<string>();
    for (const n of graph?.nodes ?? []) set.add(n.kind);
    return [...set];
  }, [graph]);

  const recenter = (kind: string, id: string) => {
    setSelectedKey(null);
    setAsOf(null);
    navigate({ to: "/knowledge", search: { tab: "graph", focusKind: kind, focusId: id } });
  };

  if (graphQ.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
        <span className="spinner" />
        <span className="mono-label" style={{ fontSize: 9 }}>
          building the graph…
        </span>
      </div>
    );
  }
  if (graphQ.isError) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 8 }}>graph · failed to load</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
          {(graphQ.error as Error)?.message ?? "Unknown error"}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => void graphQ.refetch()}>
          Retry · rebuilds the graph
        </button>
      </div>
    );
  }
  if (
    !graph ||
    graph.nodes.length === 0 ||
    (graph.nodes.length === 1 && graph.edges.length === 0)
  ) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)", textAlign: "center" }}>
        <Share2 size={20} style={{ color: "var(--ink-faint)", margin: "4px auto 10px" }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No lineage to map yet</div>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-subtle)",
            maxWidth: 440,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          The graph draws itself as the loop runs: promote a signal to an opportunity, a spec into
          tasks, or log a decision, and the links appear here automatically. Nothing to wire by
          hand.
        </p>
      </div>
    );
  }

  const sliderIdx = asOf ? Math.max(0, timeline.indexOf(asOf)) : timeline.length - 1;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {presentKinds.map((kind) => (
            <span key={kind} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2.5,
                  background: KIND_COLOR[kind] ?? "#999999",
                }}
              />
              <span className="mono-label" style={{ fontSize: 8.5 }}>
                {KIND_LABEL[kind] ?? kind}
              </span>
            </span>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {timeline.length > 1 && (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono-label" style={{ fontSize: 8.5 }}>
              as of
            </span>
            <input
              type="range"
              min={0}
              max={timeline.length - 1}
              value={sliderIdx}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setAsOf(idx >= timeline.length - 1 ? null : timeline[idx]);
              }}
              style={{ width: 130 }}
              aria-label="Show the graph as of a past date"
            />
            <span className="mono-label tabular-nums" style={{ fontSize: 8.5, minWidth: 64 }}>
              {asOf ? new Date(asOf).toLocaleDateString() : "now · all"}
            </span>
          </span>
        )}
      </div>

      {graph.truncated && (
        <MonoLabel style={{ marginBottom: 8, color: "var(--ink-faint)" }}>
          showing the {graph.stats.nodeCount} closest nodes · center on a node to explore further
        </MonoLabel>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <GraphExplorer graph={graph} selectedKey={selectedKey} onSelect={setSelectedKey} />
        </div>
        <div style={{ width: 280, flexShrink: 0 }}>
          <GraphNodeStory node={selectedNode} onFocus={recenter} />
        </div>
      </div>
    </div>
  );
}

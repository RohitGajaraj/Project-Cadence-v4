// O1 / DBR-1 v1 - the dependency-free SVG canvas for the knowledge graph.
// Renders the typed {nodes, edges} from projectGraph: nodes color-coded by
// kind + sized by influence, edges as lines (supersession edges dashed/madder),
// with pan + zoom and click-to-select. All titles render as React text nodes,
// so user data is escaped by construction (no raw-HTML injection path).
import { useMemo, useRef, useState } from "react";
import type { KnowledgeGraph, GraphNode } from "@/lib/knowledge-graph-view";

/** Calm, editorial, type-distinct palette (muted so the canvas stays quiet). */
export const KIND_COLOR: Record<string, string> = {
  signal: "#6b8bbd",
  theme: "#8a78b8",
  opportunity: "#c8794a",
  prd: "#4f9d8a",
  roadmap_item: "#5c9bb0",
  task: "#9a9488",
  meeting: "#bd7a93",
  decision: "#caa24a",
  mission: "#7b86c4",
};

export const KIND_LABEL: Record<string, string> = {
  signal: "Signal",
  theme: "Theme",
  opportunity: "Opportunity",
  prd: "PRD",
  roadmap_item: "Roadmap",
  task: "Task",
  meeting: "Meeting",
  decision: "Decision",
  mission: "Mission",
};

function nodeRadius(n: GraphNode, isFocus: boolean): number {
  const base = 7 + Math.min(n.influence, 8) * 1.4;
  return isFocus ? base + 3 : base;
}

function truncate(s: string, max = 22): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function GraphExplorer({
  graph,
  selectedKey,
  onSelect,
  staleKeys,
}: {
  graph: KnowledgeGraph;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  staleKeys?: Set<string>;
}) {
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const nodeByKey = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of graph.nodes) m.set(n.key, n);
    return m;
  }, [graph.nodes]);

  const onWheel = (e: React.WheelEvent) => {
    setView((v) => {
      const k = Math.min(3, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      return { ...v, k };
    });
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const W = 640;
  const H = 460;
  const cx = W / 2 + view.x;
  const cy = H / 2 + view.y;

  return (
    <div className="bento" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{
          display: "block",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${cx} ${cy}) scale(${view.k})`}>
          {graph.edges.map((e) => {
            const s = nodeByKey.get(e.source);
            const t = nodeByKey.get(e.target);
            if (!s || !t) return null;
            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={e.superseding ? "var(--madder, #b0573f)" : "var(--hairline, #d9d4cc)"}
                strokeWidth={e.superseding ? 1.4 : 1}
                strokeDasharray={e.superseding ? "4 3" : undefined}
                opacity={0.7}
              />
            );
          })}
          {graph.nodes.map((n) => {
            const isFocus = n.key === graph.focusKey;
            const isSel = n.key === selectedKey;
            const r = nodeRadius(n, isFocus);
            return (
              <g
                key={n.key}
                transform={`translate(${n.x} ${n.y})`}
                style={{ cursor: "pointer" }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(n.key);
                }}
              >
                <circle
                  r={r}
                  fill={KIND_COLOR[n.kind] ?? "#999999"}
                  stroke={
                    isSel
                      ? "var(--ink, #222222)"
                      : isFocus
                        ? "var(--ink-muted, #555555)"
                        : "#ffffff"
                  }
                  strokeWidth={isSel ? 2.5 : isFocus ? 2 : 1}
                  opacity={0.92}
                />
                {staleKeys?.has(n.key) && (
                  <circle
                    r={r + 3.5}
                    fill="none"
                    stroke="#c2982f"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.85}
                  />
                )}
                <text
                  y={r + 11}
                  textAnchor="middle"
                  style={{
                    fontSize: 9.5,
                    fill: "var(--ink-muted, #555555)",
                    pointerEvents: "none",
                    fontWeight: isFocus ? 600 : 400,
                  }}
                >
                  {truncate(n.title || KIND_LABEL[n.kind] || n.kind)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div style={{ position: "absolute", right: 10, bottom: 8 }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 10 }}
          onClick={() => setView({ k: 1, x: 0, y: 0 })}
        >
          Reset view
        </button>
      </div>
    </div>
  );
}

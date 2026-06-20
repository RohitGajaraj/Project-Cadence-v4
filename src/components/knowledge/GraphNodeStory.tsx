// O1 / DBR-1 v1 - the "story" side panel for a selected graph node. Reuses the
// existing getLineage (immediate parents/children with hydrated titles), so the
// graph stays a thin read surface over the lineage we already record.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Crosshair,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";
import { getLineage } from "@/lib/lineage.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import type { GraphNode } from "@/lib/knowledge-graph-view";
import { KIND_COLOR, KIND_LABEL } from "./GraphExplorer";

type StoryRow = { id: string; relation: string; peer_title?: string | null };

export function GraphNodeStory({
  node,
  onFocus,
}: {
  node: GraphNode | null;
  onFocus: (kind: string, id: string) => void;
}) {
  const fLineage = useServerFn(getLineage);
  const story = useQuery({
    queryKey: ["graph-node-story", node?.kind ?? null, node?.id ?? null],
    queryFn: () => fLineage({ data: { kind: node!.kind, id: node!.id } }),
    enabled: !!node && !!node.id,
  });

  if (!node) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 6 }}>node story</MonoLabel>
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12.5,
            color: "var(--ink-subtle)",
          }}
        >
          <MousePointerClick size={13} /> Click any node to trace where it came from and what it led
          to.
        </p>
      </div>
    );
  }

  const ancestors = (story.data?.ancestors ?? []) as StoryRow[];
  const descendants = (story.data?.descendants ?? []) as StoryRow[];

  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            background: KIND_COLOR[node.kind] ?? "#999999",
            flexShrink: 0,
          }}
        />
        <span className="mono-label" style={{ fontSize: 8.5 }}>
          {KIND_LABEL[node.kind] ?? node.kind}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, lineHeight: 1.3 }}>
        {node.title || "(untitled)"}
      </div>
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 10.5, marginBottom: 4 }}
        onClick={() => onFocus(node.kind, node.id)}
      >
        <Crosshair size={11} style={{ marginRight: 5 }} /> Center the graph here
      </button>

      {story.isLoading ? (
        <p className="mono-label" style={{ fontSize: 9, marginTop: 10 }}>
          tracing…
        </p>
      ) : (
        <>
          <StorySection
            icon={ArrowUpRight}
            label="came from"
            rows={ancestors}
            emptyText="no recorded source"
          />
          <StorySection
            icon={ArrowDownRight}
            label="led to"
            rows={descendants}
            emptyText="nothing downstream yet"
          />
        </>
      )}
    </div>
  );
}

function StorySection({
  icon: Icon,
  label,
  rows,
  emptyText,
}: {
  icon: LucideIcon;
  label: string;
  rows: StoryRow[];
  emptyText: string;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        className="mono-label"
        style={{ fontSize: 8.5, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}
      >
        <Icon size={11} /> {label}
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{emptyText}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.slice(0, 8).map((r) => (
            <div
              key={r.id}
              style={{
                fontSize: 12,
                color: "var(--ink-muted)",
                display: "flex",
                gap: 6,
                alignItems: "baseline",
              }}
            >
              <span
                className="mono-label"
                style={{ fontSize: 8, color: "var(--ink-faint)", flexShrink: 0 }}
              >
                {r.relation}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.peer_title || "(untitled)"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

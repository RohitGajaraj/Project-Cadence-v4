// O1 / DBR-1 v1 - the "story" side panel for a selected graph node. Reuses the
// existing getLineage (immediate parents/children with hydrated titles), so the
// graph stays a thin read surface over the lineage we already record.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Crosshair,
  History,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";
import { getLineage } from "@/lib/lineage.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import {
  buildSupersessionStory,
  isSupersessionRelation,
  type GraphNode,
  type LineageRowLike,
  type SupersessionStory,
} from "@/lib/knowledge-graph-view";
import { KIND_COLOR, KIND_LABEL } from "./GraphExplorer";

type StoryRow = { id: string; relation: string; peer_title?: string | null };

/** Madder accent for the supersession mechanic; matches the canvas edge colour. */
const MADDER = "var(--madder, #b0573f)";

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

  // Raw rows carry the full edge fields (parent/child kind+id) the supersession
  // story needs. The generic came-from / led-to lists then drop the supersession
  // edges, so the moat mechanic reads once, in its own section, not as a cryptic
  // "supersedes" tag buried in the lineage.
  const ancestorsRaw = (story.data?.ancestors ?? []) as LineageRowLike[];
  const descendantsRaw = (story.data?.descendants ?? []) as LineageRowLike[];
  const supersession = buildSupersessionStory(ancestorsRaw, descendantsRaw);
  const ancestors = ancestorsRaw.filter((r) => !isSupersessionRelation(r.relation)) as StoryRow[];
  const descendants = descendantsRaw.filter(
    (r) => !isSupersessionRelation(r.relation),
  ) as StoryRow[];

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
          <SupersessionSection story={supersession} onFocus={onFocus} />
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

// DBR-1.5 read-side: the supersession "decision history" for the selected node.
// Renders nothing until the engine writes a supersedes/contradicts edge, so the
// panel is byte-identical in the current dormant state (fail-safe). When edges do
// exist, it names, in plain language (madder-accented to match the canvas), which
// beliefs this decision revised, and whether a later outcome revised IT (the moat
// mechanic made legible). Links recenter the graph on the counterpart artifact.
function SupersessionSection({
  story,
  onFocus,
}: {
  story: SupersessionStory;
  onFocus: (kind: string, id: string) => void;
}) {
  if (story.links.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div
        className="mono-label"
        style={{
          fontSize: 8.5,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: MADDER,
        }}
      >
        <History size={11} /> decision history
      </div>
      {story.revised && (
        <p style={{ fontSize: 11.5, color: MADDER, marginBottom: 8, lineHeight: 1.4 }}>
          A later recorded outcome revised this belief.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {story.links.slice(0, 8).map((l) => {
          const canFocus = !!l.peerKind && !!l.peerId;
          // Guard the date so a malformed valid_to can never render "Invalid Date".
          const retiredOn =
            l.retiredAt && !Number.isNaN(Date.parse(l.retiredAt))
              ? new Date(l.retiredAt).toLocaleDateString()
              : null;
          return (
            <button
              key={l.id}
              type="button"
              disabled={!canFocus}
              onClick={() => canFocus && onFocus(l.peerKind, l.peerId)}
              aria-label={`${l.label} ${l.peerTitle || "untitled"}${
                l.retired ? " (no longer current)" : ""
              }`}
              style={{
                background: "none",
                border: "none",
                borderRadius: 4,
                padding: 0,
                margin: 0,
                font: "inherit",
                textAlign: "left",
                width: "100%",
                cursor: canFocus ? "pointer" : "default",
                display: "flex",
                gap: 6,
                alignItems: "baseline",
                fontSize: 12,
                color: "var(--ink-muted)",
                // Retired (reversed) assertions stay visible as history, de-emphasized.
                opacity: l.retired ? 0.5 : 1,
              }}
            >
              <span
                className="mono-label"
                style={{
                  fontSize: 8,
                  color: MADDER,
                  flexShrink: 0,
                  border: `1px solid ${MADDER}`,
                  borderRadius: 4,
                  padding: "1px 4px",
                  opacity: 0.85,
                  textDecoration: l.retired ? "line-through" : undefined,
                }}
              >
                {l.label}
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  flexShrink: 1,
                }}
              >
                {l.peerTitle || "(untitled)"}
              </span>
              {l.retired && (
                <span
                  className="mono-label"
                  style={{ fontSize: 8, color: "var(--ink-faint)", flexShrink: 0 }}
                >
                  {retiredOn ? `· no longer current · ${retiredOn}` : "· no longer current"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

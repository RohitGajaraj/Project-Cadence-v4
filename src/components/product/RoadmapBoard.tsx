// H2 · Outcome roadmap board. The human commits an opportunity to a Now / Next /
// Later bucket (native HTML5 drag, no @dnd-kit dep), declares its outcome +
// measure inline, and the agent's ICE ranking orders within each bucket. The
// backlog column is the agent-ranked pool to commit from. Optimistic moves;
// reads stay pre-migration tolerant (everything shows as backlog until the
// roadmap columns land on the next sync).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/notify";
import { MonoLabel, VerdictChip } from "@/components/cadence/Primitives";
import {
  getRoadmap,
  updateRoadmapItem,
  commitRoadmapItem,
  type RoadmapItem,
  type RoadmapBucket,
} from "@/lib/roadmap.functions";
import { isCommitmentGoverned } from "@/lib/roadmap-governance";
import { RoadmapHistory } from "@/components/product/RoadmapHistory";

const COLS: { key: RoadmapBucket | null; label: string }[] = [
  { key: null, label: "Backlog" },
  { key: "now", label: "Now" },
  { key: "next", label: "Next" },
  { key: "later", label: "Later" },
];

export function RoadmapBoard() {
  const qc = useQueryClient();
  const fRoadmap = useServerFn(getRoadmap);
  const roadmap = useQuery({ queryKey: ["roadmap"], queryFn: () => fRoadmap() });
  const fUpdate = useServerFn(updateRoadmapItem);
  const fCommit = useServerFn(commitRoadmapItem);

  const [dragId, setDragId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [measure, setMeasure] = useState("");

  const mMove = useMutation({
    mutationFn: (v: { id: string; bucket: RoadmapBucket | null }) =>
      fUpdate({ data: { id: v.id, bucket: v.bucket } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["roadmap"] });
      const prev = qc.getQueryData<{ items: RoadmapItem[] }>(["roadmap"]);
      qc.setQueryData<{ items: RoadmapItem[] }>(["roadmap"], (old) =>
        old
          ? { items: old.items.map((it) => (it.id === v.id ? { ...it, bucket: v.bucket } : it)) }
          : old,
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["roadmap"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["roadmap"] }),
  });

  // H2-WRITES: saving the outcome for a COMMITTED item goes through the governed
  // path, which requires both an outcome and a measure (anti-feature-factory). The
  // lenient drag move (mMove) stays unconstrained, so you can still place first.
  const mFields = useMutation({
    mutationFn: (v: {
      id: string;
      bucket: RoadmapBucket | null;
      outcome: string;
      measure: string;
    }) =>
      fCommit({
        data: {
          id: v.id,
          bucket: v.bucket,
          outcome: v.outcome || null,
          measure: v.measure || null,
        },
      }),
    onSuccess: () => {
      setEditId(null);
      setOutcome("");
      setMeasure("");
      qc.invalidateQueries({ queryKey: ["roadmap"] });
      toast.success("Outcome saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = roadmap.data?.items ?? [];
  const gaps = roadmap.data?.governanceGaps ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {gaps > 0 && (
        <p style={{ fontSize: 11, color: "var(--ink-subtle)", lineHeight: 1.4 }}>
          {gaps} {gaps === 1 ? "commitment needs" : "commitments need"} a declared outcome and
          measure.
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {COLS.map((col) => {
          const colItems = items.filter((i) => i.bucket === col.key);
          return (
            <div
              key={String(col.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) {
                  mMove.mutate({ id: dragId, bucket: col.key });
                  setDragId(null);
                }
              }}
              className="bento"
              style={{
                padding: "10px 12px",
                minHeight: 200,
                background: col.key ? "transparent" : "var(--surface-1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 10,
                }}
              >
                <MonoLabel style={{ color: col.key === "now" ? "var(--ember)" : "var(--ink)" }}>
                  {col.label}
                </MonoLabel>
                <span className="mono-label tabular-nums" style={{ color: "var(--ink-faint)" }}>
                  {colItems.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {colItems.length === 0 && (
                  <p style={{ fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.4 }}>
                    {col.key ? "Drag an opportunity here to commit it" : "No opportunities yet"}
                  </p>
                )}
                {colItems.map((it) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    onDragEnd={() => setDragId(null)}
                    className="lift"
                    style={{
                      border: "1px solid var(--hairline)",
                      borderRadius: 7,
                      padding: "8px 10px",
                      background: "var(--card)",
                      cursor: "grab",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {it.title}
                      </span>
                      <span
                        style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                      >
                        <span
                          className="mono-label tabular-nums"
                          style={{ color: "var(--ink-subtle)" }}
                        >
                          {it.ice_score != null ? it.ice_score.toFixed(1) : "—"}
                        </span>
                        {/* Keyboard / click move (drag is the mouse path); closes the
                          drag-only a11y gap. */}
                        <select
                          aria-label={`Move ${it.title} to a bucket`}
                          value={it.bucket ?? "backlog"}
                          onChange={(e) => {
                            const v = e.target.value;
                            mMove.mutate({
                              id: it.id,
                              bucket: v === "backlog" ? null : (v as RoadmapBucket),
                            });
                          }}
                          className="mono-label"
                          style={{
                            fontSize: 9,
                            color: "var(--ink-faint)",
                            background: "transparent",
                            border: "1px solid var(--hairline)",
                            borderRadius: 5,
                            padding: "1px 3px",
                            cursor: "pointer",
                          }}
                        >
                          <option value="backlog">Backlog</option>
                          <option value="now">Now</option>
                          <option value="next">Next</option>
                          <option value="later">Later</option>
                        </select>
                      </span>
                    </div>

                    {col.key && editId !== it.id && (
                      <div style={{ marginTop: 5 }}>
                        {/* H2-WRITES: a committed item with no declared outcome is a
                            needs-human judgment, so lead with the canonical ember
                            VerdictChip (annotate, don't bury) per the design ruling. */}
                        {!isCommitmentGoverned(it) && (
                          <VerdictChip tone="ember" style={{ marginBottom: 4 }}>
                            Needs outcome
                          </VerdictChip>
                        )}
                        {(it.outcome || it.measure) && (
                          <p
                            style={{ fontSize: 10.5, color: "var(--ink-subtle)", lineHeight: 1.4 }}
                          >
                            {it.outcome}
                            {it.outcome && it.measure ? " · " : ""}
                            {it.measure && (
                              <span style={{ color: "var(--ink-faint)" }}>{it.measure}</span>
                            )}
                          </p>
                        )}
                        <span
                          style={{ display: "inline-flex", alignItems: "center", marginTop: 3 }}
                        >
                          <button
                            className="mono-label"
                            style={{ color: "var(--action-blue)" }}
                            onClick={() => {
                              setEditId(it.id);
                              setOutcome(it.outcome ?? "");
                              setMeasure(it.measure ?? "");
                            }}
                          >
                            {it.outcome ? "edit outcome" : "+ outcome & measure"}
                          </button>
                          {/* H2-AUDIT-UI: reveal the decision history (why this is here). */}
                          <RoadmapHistory opportunityId={it.id} />
                        </span>
                      </div>
                    )}

                    {col.key && editId === it.id && (
                      <div
                        style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}
                      >
                        <input
                          className="input"
                          style={{ fontSize: 11 }}
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                          placeholder="Outcome: what changes"
                        />
                        <input
                          className="input"
                          style={{ fontSize: 11 }}
                          value={measure}
                          onChange={(e) => setMeasure(e.target.value)}
                          placeholder="Measure: how we know"
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            className="mono-label"
                            style={{ color: "var(--ink-subtle)" }}
                            onClick={() => setEditId(null)}
                          >
                            cancel
                          </button>
                          <button
                            className="mono-label"
                            style={{ color: "var(--action-blue)" }}
                            onClick={() =>
                              mFields.mutate({ id: it.id, bucket: it.bucket, outcome, measure })
                            }
                            disabled={mFields.isPending}
                          >
                            save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

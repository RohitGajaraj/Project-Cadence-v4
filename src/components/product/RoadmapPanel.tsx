// Roadmap tab — ported 1:1 from design-reference/cadence/loop.jsx
// (ProductScreen, tab "Roadmap"): Now / Next / Later band-stone lanes with
// draggable bento cards, "AI rebalance" ghost + "Plan next 2 weeks" primary
// buttons, and the ember-tinted sprint-plan preview bento with StepDot task
// rows and "Commit · adds to Tasks". Production functionality kept: real
// moveOpportunity / rebalanceRoadmap / planSprint server functions, ICE on
// cards, the linked-spec deep link, and LineageDrawer.
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, GitBranch } from "lucide-react";
import { getRoadmap, moveOpportunity, rebalanceRoadmap, planSprint } from "@/lib/roadmap.functions";
import { MonoLabel, StepDot } from "@/components/cadence/Primitives";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";

const LANES = [
  { id: "now", label: "Now", hint: "Shipping in the current sprint" },
  { id: "next", label: "Next", hint: "Queued for the next 2–4 weeks" },
  { id: "later", label: "Later", hint: "Strategic backlog" },
] as const;

type Lane = (typeof LANES)[number]["id"];

export function RoadmapPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fRoadmap = useServerFn(getRoadmap);
  const mMove = useServerFn(moveOpportunity);
  const mRebalance = useServerFn(rebalanceRoadmap);
  const mPlan = useServerFn(planSprint);

  const roadmap = useQuery({ queryKey: ["roadmap"], queryFn: () => fRoadmap() });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["roadmap"] });
    qc.invalidateQueries({ queryKey: ["opportunities"] });
  };

  const move = useMutation({
    mutationFn: (d: { id: string; lane: Lane }) => mMove({ data: d }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(e.message),
  });
  const rebalance = useMutation({
    mutationFn: () => mRebalance({}),
    onSuccess: (r) => {
      inv();
      toast.success(r.message ?? "Rebalanced.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [preview, setPreview] = useState<null | {
    capacityHours: number;
    tasks: { title: string; estimate_hours: number; is_deep_work: boolean; priority: string }[];
  }>(null);
  const [dragItem, setDragItem] = useState<{ id: string; title: string } | null>(null);
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);

  const plan = useMutation({
    mutationFn: (commit: boolean) => mPlan({ data: { horizon_days: 14, commit } }),
    onSuccess: (r) => {
      if ("preview" in r && r.preview) {
        setPreview(r.preview);
      } else if ("committed" in r && r.committed) {
        toast.success(`Sprint committed. ${r.committed.tasks} tasks added.`);
        setPreview(null);
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        navigate({ to: "/product", search: { tab: "tasks" } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const opps = roadmap.data?.opportunities ?? [];
  const prds = roadmap.data?.prds ?? [];
  const prdByOpp = new Map<string, { id: string; title: string }>();
  for (const p of prds)
    if (p.opportunity_id) prdByOpp.set(p.opportunity_id, { id: p.id, title: p.title });

  const previewHours = preview ? preview.tasks.reduce((a, t) => a + (t.estimate_hours || 0), 0) : 0;

  if (roadmap.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load the roadmap
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(roadmap.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => roadmap.refetch()}
        >
          Retry · reloads lanes
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          disabled={rebalance.isPending || opps.length === 0}
          onClick={() => rebalance.mutate()}
        >
          {rebalance.isPending ? "Rebalancing…" : "AI rebalance"}
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={plan.isPending}
          onClick={() => plan.mutate(false)}
        >
          {plan.isPending && !preview ? "Planning…" : "Plan next 2 weeks"}
        </button>
      </div>

      {preview ? (
        <div
          className="fade-up bento"
          style={{
            marginBottom: 12,
            padding: "14px 16px",
            borderColor: "color-mix(in oklab, var(--ember) 40%, transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="font-display" style={{ fontSize: 15 }}>
                Sprint plan preview
              </div>
              <div className="mono-label" style={{ fontSize: 8.5, marginTop: 2 }}>
                {preview.tasks.length} tasks · ~{previewHours.toFixed(1)}h of{" "}
                {preview.capacityHours}h capacity
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>
              Dismiss
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={plan.isPending}
              onClick={() => plan.mutate(true)}
            >
              {plan.isPending ? "Committing…" : "Commit · adds to Tasks"}
            </button>
          </div>
          <ul
            style={{
              listStyle: "none",
              paddingLeft: 0,
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {preview.tasks.map((t) => (
              <li
                key={t.title}
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <StepDot status="planned" />
                <span style={{ flex: 1 }}>{t.title}</span>
                <span className="mono-label tabular-nums" style={{ fontSize: 8.5 }}>
                  {t.estimate_hours}h · {t.priority}
                  {t.is_deep_work ? " · deep" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {roadmap.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading the roadmap…
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {LANES.map((lane) => {
            const items = opps.filter((o) => o.status === lane.id);
            return (
              <div
                key={lane.id}
                className="band-stone"
                title={lane.hint}
                style={{ minHeight: 220, padding: 16 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragItem?.id;
                  const title = dragItem?.title;
                  setDragItem(null);
                  if (!id) return;
                  move.mutate(
                    { id, lane: lane.id },
                    {
                      onSuccess: () =>
                        toast.success(
                          title ? `“${title}” → ${lane.label}.` : `Moved to ${lane.label}.`,
                        ),
                    },
                  );
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <MonoLabel>{lane.label}</MonoLabel>
                  <span className="mono-label tabular-nums">{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((o) => {
                    const prd = prdByOpp.get(o.id);
                    return (
                      <div
                        key={o.id}
                        className="bento lift"
                        draggable
                        onDragStart={(e) => {
                          setDragItem({ id: o.id, title: o.title });
                          e.dataTransfer.setData("text/plain", o.id);
                        }}
                        onDragEnd={() => setDragItem(null)}
                        style={{
                          padding: "10px 12px",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "grab",
                        }}
                      >
                        {o.title}
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}
                        >
                          <span className="mono-label tabular-nums" style={{ fontSize: 8.5 }}>
                            ICE {Number(o.ice_score).toFixed(1)}
                          </span>
                          {prd ? (
                            <Link
                              to="/prds/$id"
                              params={{ id: prd.id }}
                              onClick={(e) => e.stopPropagation()}
                              className="mono-label"
                              style={{
                                fontSize: 8.5,
                                color: "var(--action-blue)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <FileText size={10} /> spec
                            </Link>
                          ) : null}
                          <span style={{ flex: 1 }}></span>
                          <button
                            title="Lineage"
                            aria-label="Lineage"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLineage({ id: o.id, title: o.title });
                            }}
                            style={{ color: "var(--ink-faint)", display: "inline-flex" }}
                          >
                            <GitBranch size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mono-label" style={{ fontSize: 8.5, textAlign: "center", marginTop: 10 }}>
        drag a card between lanes
      </p>

      <LineageDrawer
        open={Boolean(lineage)}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind="opportunity"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Sparkles, FileText, Calendar, GitBranch } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { getRoadmap, moveOpportunity, rebalanceRoadmap, planSprint } from "@/lib/roadmap.functions";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";

export const Route = createFileRoute("/_authenticated/roadmap")({
  component: RoadmapPage,
  head: () => ({ meta: [{ title: "Roadmap · Cadence" }] }),
});

const LANES = [
  { id: "now", label: "Now", hint: "Shipping in the current sprint" },
  { id: "next", label: "Next", hint: "Queued for the next 2–4 weeks" },
  { id: "later", label: "Later", hint: "Strategic backlog" },
] as const;

type Lane = (typeof LANES)[number]["id"];

function RoadmapPage() {
  const qc = useQueryClient();
  const fProjects = useServerFn(listProjects);
  const fRoadmap = useServerFn(getRoadmap);
  const mMove = useServerFn(moveOpportunity);
  const mRebalance = useServerFn(rebalanceRoadmap);
  const mPlan = useServerFn(planSprint);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const roadmap = useQuery({ queryKey: ["roadmap"], queryFn: () => fRoadmap() });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["roadmap"] });
    qc.invalidateQueries({ queryKey: ["opportunities"] });
  };

  const move = useMutation({
    mutationFn: (d: { id: string; lane: Lane }) => mMove({ data: d }),
    onSuccess: inv,
  });
  const rebalance = useMutation({
    mutationFn: () => mRebalance({}),
    onSuccess: (r) => {
      inv();
      toast.success(r.message ?? "Rebalanced");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [preview, setPreview] = useState<null | {
    capacityHours: number;
    tasks: { title: string; estimate_hours: number; is_deep_work: boolean; priority: string }[];
  }>(null);
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);
  const plan = useMutation({
    mutationFn: (commit: boolean) => mPlan({ data: { horizon_days: 14, commit } }),
    onSuccess: (r) => {
      if ("preview" in r && r.preview) {
        setPreview(r.preview);
      } else if ("committed" in r && r.committed) {
        toast.success(`Created ${r.committed.tasks} tasks`);
        setPreview(null);
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const opps = roadmap.data?.opportunities ?? [];
  const prds = roadmap.data?.prds ?? [];
  const prdByOpp = new Map<string, { id: string; title: string }>();
  for (const p of prds)
    if (p.opportunity_id) prdByOpp.set(p.opportunity_id, { id: p.id, title: p.title });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1500px] mx-auto">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Plan</div>
            <h1 className="mt-3 font-display text-4xl tracking-tight">
              <span className="neural-text">Roadmap</span> &amp; Sprint
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Now / Next / Later. Drop a card to a lane, or let AI plan the next 2 weeks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => rebalance.mutate()}
              disabled={rebalance.isPending || opps.length === 0}
              className="rounded-xl border hairline px-3 py-2 text-xs inline-flex items-center gap-1.5 hover:bg-secondary disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />{" "}
              {rebalance.isPending ? "Rebalancing…" : "AI rebalance"}
            </button>
            <button
              onClick={() => plan.mutate(false)}
              disabled={plan.isPending}
              className="btn-agentic rounded-xl px-3.5 py-2 text-sm font-medium inline-flex items-center gap-1.5"
            >
              <Wand2 className="h-4 w-4" /> {plan.isPending ? "Planning…" : "Plan next 2 weeks"}
            </button>
          </div>
        </header>

        {preview && (
          <section className="bento p-5 mb-6 border-violet-500/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-sm">Sprint plan preview</h3>
                <p className="text-xs text-muted-foreground">
                  {preview.tasks.length} tasks · ~
                  {preview.tasks.reduce((a, t) => a + (t.estimate_hours || 0), 0).toFixed(1)}h
                  estimated · capacity {preview.capacityHours}h
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg border hairline px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Discard
                </button>
                <button
                  onClick={() => plan.mutate(true)}
                  disabled={plan.isPending}
                  className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {plan.isPending ? "Committing…" : "Commit to Tasks"}
                </button>
              </div>
            </div>
            <ul className="grid sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto scrollbar-thin">
              {preview.tasks.map((t, i) => (
                <li
                  key={i}
                  className="rounded-lg border hairline px-3 py-2 text-sm flex items-start gap-2"
                >
                  <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-1.5 py-0.5 mt-0.5">
                    {t.priority}
                  </span>
                  <span className="flex-1">{t.title}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {t.estimate_hours}h{t.is_deep_work ? " · deep" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {LANES.map((lane) => {
            const items = opps.filter((o) => o.status === lane.id);
            return (
              <section
                key={lane.id}
                className="bento p-4 min-h-[320px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) move.mutate({ id, lane: lane.id });
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-sm">{lane.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{lane.hint}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {items.map((o) => {
                    const prd = prdByOpp.get(o.id);
                    return (
                      <li
                        key={o.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
                        className="rounded-xl border hairline p-3 bg-background/40 cursor-grab active:cursor-grabbing hover:border-violet-500/40 transition"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{o.title}</div>
                            {o.problem && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {o.problem}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="neural-text font-display text-sm tabular-nums">
                              {Number(o.ice_score).toFixed(1)}
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              I{o.impact}·C{o.confidence}·E{o.ease}
                            </div>
                          </div>
                        </div>
                        {prd && (
                          <Link
                            to="/prds/$id"
                            params={{ id: prd.id }}
                            className="mt-2 inline-flex items-center gap-1 text-[10px] text-violet-300 hover:underline"
                          >
                            <FileText className="h-3 w-3" /> {prd.title}
                          </Link>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLineage({ id: o.id, title: o.title });
                          }}
                          className="mt-2 ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          <GitBranch className="h-3 w-3" /> Lineage
                        </button>
                      </li>
                    );
                  })}
                  {items.length === 0 && (
                    <li className="text-xs text-muted-foreground py-6 text-center border hairline border-dashed rounded-xl">
                      Drop here
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Items in <strong>backlog</strong>,{" "}
          <strong>shipped</strong>, or <strong>dropped</strong> live on the{" "}
          <Link to="/opportunities" className="underline">
            Opportunities
          </Link>{" "}
          page.
        </p>
      </div>
      <LineageDrawer
        open={Boolean(lineage)}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind="opportunity"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </AppShell>
  );
}

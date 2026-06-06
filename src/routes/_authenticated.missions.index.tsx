import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GitBranch, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listMissions } from "@/lib/missions.functions";
import { startOrchestratedMission } from "@/lib/orchestrator.functions";

export const Route = createFileRoute("/_authenticated/missions/")({
  component: MissionsPage,
  head: () => ({ meta: [{ title: "Missions · Cadence" }] }),
});

function statusTone(s: string): string {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "running") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "failed") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  return "bg-muted text-muted-foreground border-border";
}

function MissionsPage() {
  const fProjects = useServerFn(listProjects);
  const fMissions = useServerFn(listMissions);
  const fStart = useServerFn(startOrchestratedMission);
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const missions = useQuery({ queryKey: ["missions"], queryFn: () => fMissions() });
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");
  const start = useMutation({
    mutationFn: (input: { goal: string; title?: string }) => fStart({ data: input }),
    onSuccess: (res) => {
      toast.success(`Orchestrator dispatched ${res.approvals_queued ?? 0} approval(s); mission running.`);
      setGoal(""); setTitle("");
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = missions.data?.missions ?? [];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <header>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-violet-300" /> Agent-to-agent
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight">Missions</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            A mission groups every hop an agent makes on one operator intent — Discovery → Strategist → PRD Writer → Builder.
            Each hop is a structured handoff (not a pasted prompt). Start an <strong>orchestrated</strong> mission below — the Orchestrator
            plans a DAG and dispatches specialists for you — or start a single-agent mission from <Link to="/agents" className="underline">Agents</Link>.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" /> New orchestrated mission
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mission title (optional)"
            maxLength={200}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Mission goal — e.g. 'Investigate top 3 churn signals this week, draft a PRD for the highest-impact fix, and queue the engineering plan.'"
            rows={3}
            maxLength={4000}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              The Orchestrator will plan a 1–6 step DAG and dispatch the right specialists. Requires at least one enabled specialist agent.
            </p>
            <button
              onClick={() => start.mutate({ goal: goal.trim(), title: title.trim() || undefined })}
              disabled={start.isPending || goal.trim().length < 4}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Plan & dispatch
            </button>
          </div>
        </section>

        {missions.isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground text-sm">
            No missions yet. Dispatch an agent on /agents with "Start as mission" enabled to create one.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((m) => (
              <Link
                key={m.id}
                to="/missions/$missionId"
                params={{ missionId: m.id }}
                className="block bento p-4 hover:ring-1 hover:ring-white/15 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm truncate">{m.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{m.goal}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusTone(m.status)}`}>
                    {m.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{m.hop_count} hop{m.hop_count === 1 ? "" : "s"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
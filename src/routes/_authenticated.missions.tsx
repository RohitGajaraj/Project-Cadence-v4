import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listMissions } from "@/lib/missions.functions";

export const Route = createFileRoute("/_authenticated/missions")({
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
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const missions = useQuery({ queryKey: ["missions"], queryFn: () => fMissions() });

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
            Each hop is a structured handoff (not a pasted prompt). Start a mission from <Link to="/agents" className="underline">Agents</Link> by ticking "Start as mission".
          </p>
        </header>

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
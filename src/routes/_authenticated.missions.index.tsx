import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, GitBranch } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { AgentsPanel } from "@/components/cockpit/AgentsPanel";
import { MissionsPanel } from "@/components/cockpit/MissionsPanel";

// Missions surface — the v4 IA "Missions" station.
// Absorbs: /cockpit, /swarm. /build and /agents (view) will fold in
// once their bodies are extracted into panel components.
// Sibling /missions/$missionId remains the deep-link target.

type Tab = "missions" | "agents";

export const Route = createFileRoute("/_authenticated/missions/")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === "agents" ? "agents" : "missions",
  }),
  component: MissionsPage,
  head: () => ({ meta: [{ title: "Missions · Cadence" }] }),
});

function MissionsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/missions/" });
  const { activeWorkspaceId } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const tabs: {
    id: Tab;
    label: string;
    description: string;
    Icon: typeof Bot;
    tone: "violet" | "cyan";
  }[] = [
    {
      id: "missions",
      label: "Missions",
      description: "Live mission graph. Each run is a goal carried through the agent mesh.",
      Icon: GitBranch,
      tone: "violet",
    },
    {
      id: "agents",
      label: "Agents",
      description: "Per-agent telemetry, throughput, handoffs, and queue depth.",
      Icon: Bot,
      tone: "cyan",
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;
  const setTab = (next: Tab) => navigate({ search: { tab: next } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <header>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-agent" /> Build
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight">Missions</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Goal-driven runs across the agent mesh. Watch the work, jump into any step.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 border-b hairline">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.Icon;
            const toneIcon =
              t.tone === "violet"
                ? "bg-violet/10 text-violet border-violet/30"
                : "bg-cyan/10 text-cyan border-cyan/30";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-2 ${
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${toneIcon} ${
                    active ? "ring-1 ring-foreground/20" : "opacity-80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground max-w-2xl">{activeTab.description}</p>

        {tab === "missions" && <MissionsPanel />}
        {tab === "agents" && <AgentsPanel activeWorkspaceId={activeWorkspaceId} />}
      </div>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, GitBranch } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { AgentsPanel } from "@/components/cockpit/AgentsPanel";
import { MissionsPanel } from "@/components/cockpit/MissionsPanel";

type Tab = "agents" | "missions";

export const Route = createFileRoute("/_authenticated/cockpit")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === "missions" ? "missions" : "agents",
  }),
  component: CockpitPage,
  head: () => ({ meta: [{ title: "Cockpit · Cadence" }] }),
});

function CockpitPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/cockpit" });
  const { activeWorkspaceId } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const tabs: {
    id: Tab;
    label: string;
    description: string;
    Icon: typeof Bot;
    tone: "cyan" | "violet";
  }[] = [
    {
      id: "agents",
      label: "Agents",
      description: "Live agent telemetry, throughput, handoffs, and queue.",
      Icon: Bot,
      tone: "cyan",
    },
    {
      id: "missions",
      label: "Missions",
      description: "Goal-driven orchestrated agent workflows and plans.",
      Icon: GitBranch,
      tone: "violet",
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;

  function setTab(next: Tab) {
    navigate({ search: { tab: next } });
  }

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <header>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-violet-300" /> Cockpit
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight">Cockpit</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Live agent execution telemetry, throughput, and goal-directed missions under your
            command.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 border-b hairline">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.Icon;
            const toneIcon =
              t.tone === "cyan"
                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                : "bg-violet-500/10 text-violet-300 border-violet-500/30";
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

        {tab === "agents" && <AgentsPanel activeWorkspaceId={activeWorkspaceId} />}
        {tab === "missions" && <MissionsPanel />}
      </div>
    </AppShell>
  );
}

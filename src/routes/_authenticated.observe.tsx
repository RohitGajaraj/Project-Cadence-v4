import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Route as RouteIcon, Waves } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listTraces } from "@/lib/traces.functions";
import { getDriftOverview } from "@/lib/drift.functions";
import { AnalyticsPanel } from "@/components/observe/AnalyticsPanel";
import { TracesPanel } from "@/components/observe/TracesPanel";
import { DriftPanel } from "@/components/observe/DriftPanel";

type Tab = "analytics" | "traces" | "drift";

export const Route = createFileRoute("/_authenticated/observe")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === "traces" || search.tab === "drift" ? search.tab : "analytics",
  }),
  component: ObservePage,
  head: () => ({ meta: [{ title: "Observe · Cadence" }] }),
});

function ObservePage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/observe" });

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  // Live counts for tab labels (lightweight; reuse existing server fns)
  const fTraces = useServerFn(listTraces);
  const fDrift = useServerFn(getDriftOverview);
  const tracesQ = useQuery({
    queryKey: ["observe-trace-count"],
    queryFn: () => fTraces({ data: { days: 1, status: "all", limit: 100 } }),
  });
  const driftQ = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fDrift(),
  });

  const tracesToday = tracesQ.data?.traces?.length ?? 0;
  const driftOpen = driftQ.data?.openIncidents?.length ?? 0;

  const tabs: {
    id: Tab;
    label: string;
    description: string;
    badge?: number;
    Icon: typeof Activity;
    tone: "sky" | "violet" | "amber";
  }[] = [
    {
      id: "analytics",
      label: "Analytics",
      description: "Spend, tokens, and latency rolled up across every agent run.",
      Icon: BarChart3,
      tone: "sky",
    },
    {
      id: "traces",
      label: "Traces",
      description: "Step-by-step replay of each agent run, with timing and tool calls.",
      badge: tracesToday || undefined,
      Icon: RouteIcon,
      tone: "violet",
    },
    {
      id: "drift",
      label: "Drift",
      description: "Quality shifts against baseline. Flags when answers start changing.",
      badge: driftOpen || undefined,
      Icon: Waves,
      tone: "amber",
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;

  function setTab(next: Tab) {
    navigate({ search: { tab: next } });
  }

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-violet-300" /> Run
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">Observe</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            How agents are performing right now. Spend, traces, and drift in one place.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 mb-6 border-b hairline">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.Icon;
            const toneIcon =
              t.tone === "sky"
                ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                : t.tone === "violet"
                ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-2 ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${toneIcon} ${active ? "ring-1 ring-foreground/20" : "opacity-80"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{t.label}</span>
                {t.badge != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.id === "drift" ? "bg-amber-500/15 text-amber-300" : "bg-secondary text-muted-foreground"}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          {activeTab.description}
        </p>

        {tab === "analytics" && <AnalyticsPanel />}
        {tab === "traces" && <TracesPanel />}
        {tab === "drift" && <DriftPanel />}
      </div>
    </AppShell>
  );
}
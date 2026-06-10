import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
  Shield,
  Wallet,
  BarChart3,
  Route as RouteIcon,
  Waves,
  FlaskConical,
  FileCode,
} from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listTraces } from "@/lib/traces.functions";
import { getDriftOverview } from "@/lib/drift.functions";
import { ControlsPanel } from "@/components/governance/ControlsPanel";
import { ApprovalsPanel } from "@/components/governance/ApprovalsPanel";
import { GuardrailsPanel } from "@/components/governance/GuardrailsPanel";
import { BudgetsPanel } from "@/components/governance/BudgetsPanel";
import { AnalyticsPanel } from "@/components/observe/AnalyticsPanel";
import { TracesPanel } from "@/components/observe/TracesPanel";
import { DriftPanel } from "@/components/observe/DriftPanel";
import { EvalsPanel } from "@/components/governance/EvalsPanel";
import { PromptsPanel } from "@/components/governance/PromptsPanel";

// Govern surface — v4 IA. Absorbs /governance + /observe + thin redirects
// (/guardrails, /budgets, /traces, /drift) and, in Phase 1b-2, /evals + /prompts.

type Tab =
  | "controls"
  | "approvals"
  | "guardrails"
  | "budgets"
  | "prompts"
  | "evals"
  | "analytics"
  | "traces"
  | "drift";

const TABS: Tab[] = [
  "controls",
  "approvals",
  "guardrails",
  "budgets",
  "prompts",
  "evals",
  "analytics",
  "traces",
  "drift",
];

export const Route = createFileRoute("/_authenticated/govern")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => {
    const t = search.tab;
    return { tab: (TABS as string[]).includes(t as string) ? (t as Tab) : "controls" };
  },
  component: GovernPage,
  head: () => ({ meta: [{ title: "Govern · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Couldn't load govern</h2>
          <p className="mt-2 text-sm text-rose-200/70">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-md border hairline px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Retry
          </button>
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-muted-foreground">Not found.</div>
    </AppShell>
  ),
});

type TabDef = {
  id: Tab;
  label: string;
  description: string;
  Icon: typeof SlidersHorizontal;
  tone: "violet" | "emerald" | "sky" | "amber";
  badge?: number;
};

function GovernPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/govern" });

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  // Lightweight badge counts for the run-side tabs.
  const fTraces = useServerFn(listTraces);
  const fDrift = useServerFn(getDriftOverview);
  const tracesQ = useQuery({
    queryKey: ["govern-trace-count"],
    queryFn: () => fTraces({ data: { days: 1, status: "all", limit: 100 } }),
    enabled: tab === "traces" || tab === "analytics" || tab === "drift",
  });
  const driftQ = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fDrift(),
    enabled: tab === "drift" || tab === "analytics",
  });

  const tracesToday = tracesQ.data?.traces?.length ?? 0;
  const driftOpen = driftQ.data?.openIncidents?.length ?? 0;

  const tabs: TabDef[] = [
    {
      id: "controls",
      label: "Controls",
      description: "Kill switch, mission caps, stuck approvals, auto-pipelines.",
      Icon: SlidersHorizontal,
      tone: "violet",
    },
    {
      id: "approvals",
      label: "Approvals",
      description: "Tool calls waiting on a human. Approve runs them; reject keeps them paused.",
      Icon: CheckCircle2,
      tone: "emerald",
    },
    {
      id: "guardrails",
      label: "Guardrails",
      description: "Rules that block, warn, or redact text on every AI call.",
      Icon: Shield,
      tone: "sky",
    },
    {
      id: "budgets",
      label: "Budgets",
      description: "Spend caps per day, month, and AI surface. Over-cap calls are blocked.",
      Icon: Wallet,
      tone: "amber",
    },
    {
      id: "prompts",
      label: "Prompts",
      description: "Version, A/B test, and roll back the system prompts powering every AI surface.",
      Icon: FileCode,
      tone: "violet",
    },
    {
      id: "evals",
      label: "Evals",
      description: "Regression tests on prompts. Catch quality drops before they ship.",
      Icon: FlaskConical,
      tone: "emerald",
    },
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
      Icon: RouteIcon,
      tone: "violet",
      badge: tracesToday || undefined,
    },
    {
      id: "drift",
      label: "Drift",
      description: "Quality shifts against baseline. Flags when answers start changing.",
      Icon: Waves,
      tone: "amber",
      badge: driftOpen || undefined,
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;
  const setTab = (next: Tab) => navigate({ search: { tab: next } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldAlert className="h-3 w-3" /> Govern
          </div>
          <h1 className="font-display text-3xl tracking-tight mt-1">Govern</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rules, approvals, spend, and proof of what ran. One place to keep the swarm safe.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 border-b hairline">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.Icon;
            const toneIcon =
              t.tone === "violet"
                ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                : t.tone === "emerald"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : t.tone === "sky"
                    ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px inline-flex items-center gap-2 ${
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
                {t.badge != null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      t.id === "drift"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{activeTab.description}</p>

        {tab === "controls" && <ControlsPanel />}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "guardrails" && <GuardrailsPanel />}
        {tab === "budgets" && <BudgetsPanel />}
        {tab === "prompts" && <PromptsPanel />}
        {tab === "evals" && <EvalsPanel />}
        {tab === "analytics" && <AnalyticsPanel />}
        {tab === "traces" && <TracesPanel />}
        {tab === "drift" && <DriftPanel />}
      </div>
    </AppShell>
  );
}
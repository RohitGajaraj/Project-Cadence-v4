// Govern — screen 5 (wave B) of the Ember Editorial migration, ported 1:1
// from design-reference/cadence/loop.jsx (GovernScreen + GOVERN_DESC): mono
// kicker "Engine room", serif h1, hairline TabRow with per-tab description
// lines. Production functionality rides the reference layout: the ?tab=
// search-param contract (lowercase ids preserved), the trace-count and
// drift-open badge queries on the TabRow badge prop, and each tab's TanStack
// Query + server-function wiring in its panel.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader, TabRow, type TabRowItem } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
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
import { EvalSuiteDetail } from "@/components/governance/EvalSuiteDetail";
import { AgentSpendDetail } from "@/components/observe/AgentSpendDetail";
import { TraceDetail } from "@/components/observe/TraceDetail";
import { DriftSurfaceDetail } from "@/components/observe/DriftSurfaceDetail";

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

const TABS: { id: Tab; label: string }[] = [
  { id: "controls", label: "Controls" },
  { id: "approvals", label: "Approvals" },
  { id: "guardrails", label: "Guardrails" },
  { id: "budgets", label: "Budgets" },
  { id: "prompts", label: "Prompts" },
  { id: "evals", label: "Evals" },
  { id: "analytics", label: "Analytics" },
  { id: "traces", label: "Traces" },
  { id: "drift", label: "Drift" },
];

// GOVERN_DESC from the reference, verbatim — keyed by the lowercase tab ids.
const GOVERN_DESC: Record<Tab, string> = {
  controls: "Kill switch, mission caps, stuck approvals, auto-pipelines.",
  approvals: "Tool calls waiting on a human. Approve runs them; reject keeps them paused.",
  guardrails: "Rules that block, warn, or redact text on every AI call.",
  budgets: "Spend caps per day, month, and AI surface. Over-cap calls are blocked.",
  prompts: "Version, A/B test, and roll back the system prompts powering every AI surface.",
  evals: "Regression tests on prompts. Catch quality drops before they ship.",
  analytics: "Spend, tokens, and latency rolled up across every agent run.",
  traces: "Step-by-step replay of each agent run, with timing and tool calls.",
  drift: "Quality shifts against baseline. Flags when answers start changing.",
};

export const Route = createFileRoute("/_authenticated/govern")({
  // Screen-7 drill contract (inherited verbatim from screen 6): optional
  // search params open a detail in the tab body only — SurfaceHeader +
  // TabRow stay; setTab navigates with a fresh search object so switching
  // tabs clears any open drill; DrillHeader back returns to the bare tab.
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab: Tab; suite?: string; agent?: string; trace?: string; surface?: string } => {
    const t = search.tab;
    return {
      tab: TABS.some((x) => x.id === t) ? (t as Tab) : "controls",
      suite: typeof search.suite === "string" ? search.suite : undefined,
      agent: typeof search.agent === "string" ? search.agent : undefined,
      trace: typeof search.trace === "string" ? search.trace : undefined,
      surface: typeof search.surface === "string" ? search.surface : undefined,
    };
  },
  component: GovernPage,
  head: () => ({ meta: [{ title: "Govern · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: 24 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load Govern
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 480 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={reset}>
            Retry · reloads the surface
          </button>
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <p style={{ fontSize: 13, color: "var(--ink-subtle)" }}>Not found.</p>
      </div>
    </AppShell>
  ),
});

function GovernPage() {
  const { tab, suite, agent, trace, surface } = Route.useSearch();
  const navigate = useNavigate({ from: "/govern" });
  const { activeWorkspace } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  // Lightweight badge counts for the run-side tabs — a production affordance
  // the reference lacks; they ride the TabRow badge prop as quiet mono counts.
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

  const tabs: TabRowItem[] = TABS.map((t) => ({
    ...t,
    badge:
      t.id === "traces"
        ? tracesToday || undefined
        : t.id === "drift"
          ? driftOpen || undefined
          : undefined,
  }));

  const setTab = (next: string) => navigate({ search: { tab: next as Tab } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Govern"]} />
      <div
        data-screen-label="Govern"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Engine room"
          icon={Shield}
          title="Govern"
          sub="Every autonomous action is cited, observable, gated, and reversible."
        />
        <TabRow tabs={tabs} active={tab} onSet={setTab} desc={GOVERN_DESC} />

        {tab === "controls" && <ControlsPanel onOpenQueue={() => setTab("approvals")} />}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "guardrails" && <GuardrailsPanel />}
        {tab === "budgets" && <BudgetsPanel />}
        {tab === "prompts" && <PromptsPanel />}
        {tab === "evals" && (suite ? <EvalSuiteDetail id={suite} /> : <EvalsPanel />)}
        {tab === "analytics" && (agent ? <AgentSpendDetail id={agent} /> : <AnalyticsPanel />)}
        {tab === "traces" && (trace ? <TraceDetail id={trace} /> : <TracesPanel />)}
        {tab === "drift" && (surface ? <DriftSurfaceDetail id={surface} /> : <DriftPanel />)}
      </div>
    </AppShell>
  );
}

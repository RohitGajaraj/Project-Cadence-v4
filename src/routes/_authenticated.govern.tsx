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
import { SubTabs, SurfaceHeader, TabRow, type TabRowItem } from "@/components/cadence/Primitives";
import {
  ENGINE_ROOM_BANDS,
  bandForTab,
  tabsInBand,
  primaryTabForBand,
  findBand,
  type EngineRoomTab,
} from "@/lib/engine-room-bands";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { listTraces } from "@/lib/traces.functions";
import { getDriftOverview } from "@/lib/drift.functions";
import { ControlsPanel } from "@/components/governance/ControlsPanel";
import { AgentRosterPanel } from "@/components/governance/AgentRosterPanel";
import { ApprovalsPanel } from "@/components/governance/ApprovalsPanel";
import { NotificationsPanel } from "@/components/governance/NotificationsPanel";
import { IncidentsPanel } from "@/components/governance/IncidentsPanel";
import { GuardrailsPanel } from "@/components/governance/GuardrailsPanel";
import { BudgetsPanel } from "@/components/governance/BudgetsPanel";
import { AnalyticsPanel } from "@/components/observe/AnalyticsPanel";
import { GauntletMetricsPanel } from "@/components/observe/GauntletMetricsPanel";
import { TracesPanel } from "@/components/observe/TracesPanel";
import { DriftPanel } from "@/components/observe/DriftPanel";
import { EvalsPanel } from "@/components/governance/EvalsPanel";
import { PromptsPanel } from "@/components/governance/PromptsPanel";
import { EvalSuiteDetail } from "@/components/governance/EvalSuiteDetail";
import { AgentSpendDetail } from "@/components/observe/AgentSpendDetail";
import { DriftSurfaceDetail } from "@/components/observe/DriftSurfaceDetail";

// Engine Room surface (route id 'govern', user-facing title "Engine Room"). Absorbs /governance +
// /observe + thin redirects (/guardrails, /budgets, /traces, /drift) and /evals + /prompts.
// Tab labels are outcome-named per the Engine-Room Doctrine; the ?tab=<id> ids are the routing
// contract and stay unchanged. See docs/conventions/engine-room-doctrine.md.

// The tab id set + band grouping live in the pure, unit-tested
// @/lib/engine-room-bands module (IA-DEPTH-V11 #23): the 13 tabs are presented in
// 3 calm bands (Needs you / Trust & safety / Quality & insight) while every ?tab=
// id is preserved unchanged so deep links keep landing.
type Tab = EngineRoomTab;

// Engine-Room Doctrine: ids are the routing contract (unchanged); labels name the outcome, not the mechanism.
const TABS: { id: Tab; label: string }[] = [
  { id: "controls", label: "Controls" },
  { id: "attention", label: "Attention" },
  { id: "team", label: "Team" },
  { id: "approvals", label: "Approvals" },
  { id: "guardrails", label: "Safety" },
  { id: "budgets", label: "Spend" },
  { id: "prompts", label: "Prompts" },
  { id: "evals", label: "Quality checks" },
  { id: "analytics", label: "Analytics" },
  { id: "gauntlet", label: "Quality" },
  { id: "traces", label: "Activity" },
  { id: "drift", label: "Trends" },
  { id: "incidents", label: "Incidents" },
];

// GOVERN_DESC from the reference, verbatim — keyed by the lowercase tab ids.
const GOVERN_DESC: Record<Tab, string> = {
  attention: "What needs you right now: approvals waiting, spend nearing caps, and a stalled loop.",
  team: "Your agents: who they are, what they are trusted to do, and what each has been up to.",
  controls: "Kill switch, mission caps, stuck approvals, auto-pipelines.",
  approvals: "Tool calls waiting on a human. Approve runs them; reject keeps them paused.",
  guardrails: "Rules that block, warn, or redact text on every AI call.",
  budgets: "Spend caps per day, month, and AI surface. Over-cap calls are blocked.",
  prompts: "Version, A/B test, and roll back the system prompts powering every AI surface.",
  evals: "Regression tests on prompts. Catch quality drops before they ship.",
  analytics: "Spend, tokens, and latency rolled up across every agent run.",
  gauntlet:
    "The three proof metrics: how often you approve the loop's calls, how much it runs unattended, and your daily-ritual retention.",
  traces: "Step-by-step replay of each agent run, with timing and tool calls.",
  drift: "Quality shifts against baseline. Flags when answers start changing.",
  incidents:
    "What went wrong: failed tool executions, errored auto-pipelines, and guardrail blocks, newest first, linked to traces.",
};

export const Route = createFileRoute("/_authenticated/govern")({
  // Screen-7 drill contract (inherited verbatim from screen 6): optional
  // search params open a detail in the tab body only — SurfaceHeader +
  // TabRow stay; setTab navigates with a fresh search object so switching
  // tabs clears any open drill; DrillHeader back returns to the bare tab.
  // Traces deliberately have NO drill param here — /traces/$traceId is the
  // one detail surface for a trace (screen-6 one-surface ruling).
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab: Tab; suite?: string; agent?: string; surface?: string } => {
    const t = search.tab;
    return {
      tab: TABS.some((x) => x.id === t) ? (t as Tab) : "controls",
      suite: typeof search.suite === "string" ? search.suite : undefined,
      agent: typeof search.agent === "string" ? search.agent : undefined,
      surface: typeof search.surface === "string" ? search.surface : undefined,
    };
  },
  component: GovernPage,
  head: () => ({ meta: [{ title: "Engine Room · Cadence" }] }),
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
  const { tab, suite, agent, surface } = Route.useSearch();
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

  // IA-DEPTH-V11 (#23): the 13 tabs are grouped into 3 bands. Tier 1 selects a
  // band (landing on its first tab); tier 2 is the existing TabRow filtered to
  // the active band's tabs (badges + descriptions preserved). The ?tab= id stays
  // the routing key, so deep links into any tab keep working.
  const activeBand = bandForTab(tab);
  const bandTabIds = tabsInBand(activeBand);
  const bandTabs = bandTabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is TabRowItem => Boolean(t));
  const setBand = (label: string) => {
    const band = ENGINE_ROOM_BANDS.find((b) => b.label === label);
    if (band) navigate({ search: { tab: primaryTabForBand(band.id) } });
  };

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Engine Room"]} />
      <div
        data-screen-label="Govern"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Operator tools"
          icon={Shield}
          title="Engine Room"
          sub="Every autonomous action is cited, observable, gated, and reversible."
        />
        {/* Tier 1: the 3 calm bands (IA-DEPTH-V11). Tier 2: the active band's
            tabs, with their live badges + per-tab descriptions preserved. */}
        <div style={{ marginBottom: 4 }}>
          <SubTabs
            tabs={ENGINE_ROOM_BANDS.map((b) => b.label)}
            active={findBand(activeBand)?.label ?? ENGINE_ROOM_BANDS[0]!.label}
            onSet={setBand}
          />
        </div>
        <TabRow tabs={bandTabs} active={tab} onSet={setTab} desc={GOVERN_DESC} />

        {tab === "controls" && <ControlsPanel onOpenQueue={() => setTab("approvals")} />}
        {tab === "attention" && <NotificationsPanel />}
        {tab === "team" && <AgentRosterPanel workspaceId={activeWorkspace?.id ?? null} />}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "guardrails" && <GuardrailsPanel />}
        {tab === "budgets" && <BudgetsPanel />}
        {tab === "prompts" && <PromptsPanel />}
        {tab === "evals" && (suite ? <EvalSuiteDetail id={suite} /> : <EvalsPanel />)}
        {tab === "analytics" && (agent ? <AgentSpendDetail id={agent} /> : <AnalyticsPanel />)}
        {tab === "gauntlet" && <GauntletMetricsPanel />}
        {tab === "traces" && <TracesPanel />}
        {tab === "drift" && (surface ? <DriftSurfaceDetail id={surface} /> : <DriftPanel />)}
        {tab === "incidents" && <IncidentsPanel />}
      </div>
    </AppShell>
  );
}

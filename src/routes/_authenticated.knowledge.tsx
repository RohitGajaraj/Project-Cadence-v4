// Knowledge — screen 5 of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/loop.jsx (KnowledgeScreen): kicker "Loop · Learn",
// serif h1, the Company-brain strip (REAL counts only — getBrainStatus +
// getCompanyBrainStats), TabRow Calendar | Memory | Learnings | Decisions | Docs with
// KNOWLEDGE_DESC lines. Production contracts ride the reference layout:
// ?tab= + ?meeting= search params, panel-level server-function wiring.
// Screen-6 drill contract: detail state rides optional search params
// (?decision= → DecisionDetail, ?learning= → LearningDetail); the detail
// replaces ONLY the tab body — SurfaceHeader, Company-brain strip and TabRow
// stay. setTab navigates with a fresh search object, so drills clear on tab
// switch; DrillHeader onBack navigates to the same tab without the param.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Brain, Sparkles } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel, SurfaceHeader, TabRow } from "@/components/cadence/Primitives";
import { MemoryUpgradeNudge } from "@/components/billing/MemoryUpgradeNudge";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { getBrainStatus, getCompanyBrainStats } from "@/lib/brain.functions";
import { MemoryList } from "@/components/memory/MemoryList";
import { DecisionsPanel } from "@/components/knowledge/DecisionsPanel";
import { CompoundingPanel } from "@/components/knowledge/CompoundingPanel";
import { DecisionDetail } from "@/components/knowledge/DecisionDetail";
import { LearningDetail } from "@/components/knowledge/LearningDetail";
import { DocsPanel } from "@/components/knowledge/DocsPanel";
import { CalendarPanel } from "@/components/knowledge/CalendarPanel";
import { GraphPanel } from "@/components/knowledge/GraphPanel";

// Brain (formerly Knowledge) — the product's brain: one substrate of everything
// it knows. The "memory" tab is the compounding agent-recall (the moat, folded
// in from the old /memory surface); "learnings" is the human-recorded outcome
// feed (the tab kept id "memory" until this restructure — now re-id'd to
// "learnings" so the agent-recall tab can own "memory"). Founder ruling
// 2026-06-16: Knowledge→Brain, /chat→Ask, /memory folds in here.
type Tab = "calendar" | "memory" | "learnings" | "decisions" | "graph" | "docs";
const TABS: Tab[] = ["calendar", "memory", "learnings", "decisions", "graph", "docs"];

const KNOWLEDGE_DESC: Record<string, string> = {
  calendar: "Events and meeting transcripts. Open a meeting to capture and extract.",
  memory:
    "What the loop recalls: reflections agents wrote and outcomes they distilled, the compounding product memory.",
  learnings:
    "What your team recorded: re-scored opportunities and outcome memos, each with a verdict.",
  decisions: "Every choice your team made, captured once. Sourced from missions, specs, meetings.",
  graph:
    "Trace why anything exists: the live map of how signals, specs, and decisions connect. Click a node to walk its provenance.",
  docs: "Workspace pages. Import from Google Docs or Notion, edit inline.",
};

export const Route = createFileRoute("/_authenticated/knowledge")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab: Tab;
    meeting?: string;
    decision?: string;
    learning?: string;
    focusKind?: string;
    focusId?: string;
  } => {
    const t = search.tab;
    return {
      tab: (TABS as string[]).includes(t as string) ? (t as Tab) : "calendar",
      meeting: typeof search.meeting === "string" ? search.meeting : undefined,
      decision: typeof search.decision === "string" ? search.decision : undefined,
      learning: typeof search.learning === "string" ? search.learning : undefined,
      focusKind: typeof search.focusKind === "string" ? search.focusKind : undefined,
      focusId: typeof search.focusId === "string" ? search.focusId : undefined,
    };
  },
  component: KnowledgePage,
  head: () => ({ meta: [{ title: "Brain · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>knowledge · failed to load</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            Retry · reloads this surface
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

function KnowledgePage() {
  const { tab, meeting, decision, learning, focusKind, focusId } = Route.useSearch();
  const navigate = useNavigate({ from: "/knowledge" });
  const { activeWorkspace } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const fBrain = useServerFn(getBrainStatus);
  const brain = useQuery({ queryKey: ["brain-status"], queryFn: () => fBrain() });
  const fStats = useServerFn(getCompanyBrainStats);
  const stats = useQuery({ queryKey: ["company-brain-stats"], queryFn: () => fStats() });

  const setTab = (next: Tab) => navigate({ search: { tab: next, meeting } });
  const setMeeting = (m: string | undefined) => navigate({ search: { tab, meeting: m } });

  // Company brain strip — every count is a real head count; nothing renders
  // until both queries resolve (no-filler law: no placeholder numbers).
  const brainStats: [string, string][] | null =
    brain.data && stats.data
      ? [
          ["chat threads", String(stats.data.conversations)],
          ["signals", String(brain.data.counts.signals)],
          ["meetings", String(brain.data.counts.meetings)],
          ["decisions", String(brain.data.counts.decisions)],
          ["learnings", String(stats.data.learnings)],
          ["docs", String(brain.data.counts.docs)],
          ["connectors", `${stats.data.connectorsLive} live`],
        ]
      : null;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Brain"]} />
      <div
        data-screen-label="Brain"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Brain"
          icon={Brain}
          title="Brain"
          sub="Your product's brain. Memory, learnings, decisions, docs, and calendar in one place."
        />

        {/* Company brain strip — one consolidated substrate, queryable from Chat. */}
        <div
          className="band-stone"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "12px 18px",
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <MonoLabel icon={Sparkles} style={{ color: "var(--ink)" }}>
            Product brain
          </MonoLabel>
          {brainStats ? (
            brainStats.map(([l, v]) => (
              <span key={l} className="mono-label" style={{ fontSize: 9 }}>
                <strong className="tabular-nums" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {v}
                </strong>{" "}
                {l}
              </span>
            ))
          ) : (
            <span className="mono-label" style={{ fontSize: 9 }}>
              loading…
            </span>
          )}
          <span style={{ flex: 1 }}></span>
          <span className="mono-label" style={{ fontSize: 8.5 }}>
            everything here is what Ask reasons over — one brain
          </span>
        </div>

        <MemoryUpgradeNudge />

        <TabRow
          tabs={[
            { id: "calendar", label: "Calendar" },
            { id: "memory", label: "Memory" },
            { id: "learnings", label: "Learnings" },
            { id: "decisions", label: "Decisions" },
            { id: "graph", label: "Graph" },
            { id: "docs", label: "Docs" },
          ]}
          active={tab}
          onSet={(t) => setTab(t as Tab)}
          desc={KNOWLEDGE_DESC}
        />

        {tab === "calendar" && <CalendarPanel meetingId={meeting} onMeetingChange={setMeeting} />}
        {tab === "memory" && <MemoryList />}
        {tab === "learnings" &&
          (learning ? <LearningDetail id={learning} /> : <CompoundingPanel />)}
        {tab === "decisions" && (decision ? <DecisionDetail id={decision} /> : <DecisionsPanel />)}
        {tab === "graph" && <GraphPanel focusKind={focusKind} focusId={focusId} />}
        {tab === "docs" && <DocsPanel />}
      </div>
    </AppShell>
  );
}

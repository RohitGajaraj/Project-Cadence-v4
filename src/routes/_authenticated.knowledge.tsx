// Knowledge — screen 5 of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/loop.jsx (KnowledgeScreen): kicker "Loop · Learn",
// serif h1, the Company-brain strip (REAL counts only — getBrainStatus +
// getCompanyBrainStats), TabRow Calendar | Memory | Decisions | Docs with
// KNOWLEDGE_DESC lines. Production contracts ride the reference layout:
// ?tab= + ?meeting= search params, panel-level server-function wiring.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel, SurfaceHeader, TabRow } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { getBrainStatus, getCompanyBrainStats } from "@/lib/brain.functions";
import { MemoryPanel } from "@/components/knowledge/MemoryPanel";
import { DecisionsPanel } from "@/components/knowledge/DecisionsPanel";
import { DocsPanel } from "@/components/knowledge/DocsPanel";
import { CalendarPanel } from "@/components/knowledge/CalendarPanel";

type Tab = "calendar" | "memory" | "decisions" | "docs";
const TABS: Tab[] = ["calendar", "memory", "decisions", "docs"];

const KNOWLEDGE_DESC: Record<string, string> = {
  calendar: "Events and meeting transcripts. Open a meeting to capture and extract.",
  memory: "What the swarm has learned about your workspace, customers, and product.",
  decisions: "Every choice your team made, captured once. Sourced from missions, specs, meetings.",
  docs: "Workspace pages. Import from Google Docs or Notion, edit inline.",
};

export const Route = createFileRoute("/_authenticated/knowledge")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab; meeting?: string } => {
    const t = search.tab;
    return {
      tab: (TABS as string[]).includes(t as string) ? (t as Tab) : "calendar",
      meeting: typeof search.meeting === "string" ? search.meeting : undefined,
    };
  },
  component: KnowledgePage,
  head: () => ({ meta: [{ title: "Knowledge · Cadence" }] }),
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
  const { tab, meeting } = Route.useSearch();
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
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Knowledge"]} />
      <div
        data-screen-label="Knowledge"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Learn"
          icon={BookOpen}
          title="Knowledge"
          sub="What the swarm knows. Calendar, memory, decisions, docs in one place."
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
            Company brain
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
            everything here is what Chat reasons over — one brain
          </span>
        </div>

        <TabRow
          tabs={[
            { id: "calendar", label: "Calendar" },
            { id: "memory", label: "Memory" },
            { id: "decisions", label: "Decisions" },
            { id: "docs", label: "Docs" },
          ]}
          active={tab}
          onSet={(t) => setTab(t as Tab)}
          desc={KNOWLEDGE_DESC}
        />

        {tab === "calendar" && <CalendarPanel meetingId={meeting} onMeetingChange={setMeeting} />}
        {tab === "memory" && <MemoryPanel />}
        {tab === "decisions" && <DecisionsPanel />}
        {tab === "docs" && <DocsPanel />}
      </div>
    </AppShell>
  );
}

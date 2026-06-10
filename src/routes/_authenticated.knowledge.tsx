import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Brain, Gavel, FileText, Calendar as CalIcon } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { MemoryPanel } from "@/components/knowledge/MemoryPanel";
import { DecisionsPanel } from "@/components/knowledge/DecisionsPanel";
import { DocsPanel } from "@/components/knowledge/DocsPanel";
import { CalendarPanel } from "@/components/knowledge/CalendarPanel";

// Knowledge surface — v4 IA Phase 1d. Absorbs /docs, /calendar, /meetings, and
// stubs Memory + Decisions ahead of those features landing. Calendar is the
// default tab (highest-frequency use). `meeting` search param preserves the
// meeting deep-link sheet from the prior /calendar route.

type Tab = "calendar" | "memory" | "decisions" | "docs";
const TABS: Tab[] = ["calendar", "memory", "decisions", "docs"];

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
      <div className="p-8">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Couldn't load knowledge</h2>
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
  Icon: typeof BookOpen;
  tone: "violet" | "emerald" | "sky" | "amber";
};

function KnowledgePage() {
  const { tab, meeting } = Route.useSearch();
  const navigate = useNavigate({ from: "/knowledge" });

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const tabs: TabDef[] = [
    {
      id: "calendar",
      label: "Calendar",
      description:
        "Events and meeting transcripts in one feed. Open a meeting to capture and extract.",
      Icon: CalIcon,
      tone: "violet",
    },
    {
      id: "memory",
      label: "Memory",
      description: "What the swarm has learned about your workspace, customers, and product.",
      Icon: Brain,
      tone: "emerald",
    },
    {
      id: "decisions",
      label: "Decisions",
      description:
        "Every choice your team made, captured once. Sourced from missions, specs, meetings.",
      Icon: Gavel,
      tone: "amber",
    },
    {
      id: "docs",
      label: "Docs",
      description: "Workspace pages. Import from Google Docs or Notion, edit inline.",
      Icon: FileText,
      tone: "sky",
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;
  const setTab = (next: Tab) =>
    navigate({ search: (prev) => ({ ...prev, tab: next }) });
  const setMeeting = (m: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, meeting: m }) });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <BookOpen className="h-3 w-3" /> Knowledge
          </div>
          <h1 className="font-display text-3xl tracking-tight mt-1">Knowledge</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One place for what the swarm knows and what's on the calendar. Memory, decisions, docs,
            meetings.
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
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{activeTab.description}</p>

        {tab === "calendar" && (
          <CalendarPanel meetingId={meeting} onMeetingChange={setMeeting} />
        )}
        {tab === "memory" && <MemoryPanel />}
        {tab === "decisions" && <DecisionsPanel />}
        {tab === "docs" && <DocsPanel />}
      </div>
    </AppShell>
  );
}
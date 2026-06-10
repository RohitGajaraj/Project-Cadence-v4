import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, LifeBuoy, Megaphone, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { SupportPanel } from "@/components/learn/SupportPanel";
import { OutcomesPanel } from "@/components/learn/OutcomesPanel";
import { LearningsPanel } from "@/components/learn/LearningsPanel";

// Learn surface — v4 IA Phase 1d. Closes the loop: outbound (outcomes) →
// inbound (support) → re-score (learnings). Sourced from getOutcomeData minus
// Releases (which moved to /product/releases in Phase 1c).

type Tab = "outcomes" | "support" | "learnings";
const TABS: Tab[] = ["outcomes", "support", "learnings"];

export const Route = createFileRoute("/_authenticated/learn")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => {
    const t = search.tab;
    return { tab: (TABS as string[]).includes(t as string) ? (t as Tab) : "outcomes" };
  },
  component: LearnPage,
  head: () => ({ meta: [{ title: "Learn · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Couldn't load learn</h2>
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
  Icon: typeof Sparkles;
  tone: "violet" | "emerald" | "sky" | "amber";
};

function LearnPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/learn" });

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const tabs: TabDef[] = [
    {
      id: "outcomes",
      label: "Outcomes",
      description:
        "Growth-agent drafts queued behind approval. Changelogs, announcements, Slack posts.",
      Icon: Megaphone,
      tone: "violet",
    },
    {
      id: "support",
      label: "Support",
      description:
        "Inbound from email, helpdesk, and connected channels. Triaged back into Product → Signals.",
      Icon: LifeBuoy,
      tone: "sky",
    },
    {
      id: "learnings",
      label: "Learnings",
      description:
        "Re-scored opportunities and outcome memos. The loop closing back to discovery.",
      Icon: Sparkles,
      tone: "amber",
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;
  const setTab = (next: Tab) => navigate({ search: { tab: next } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <GraduationCap className="h-3 w-3" /> Learn
          </div>
          <h1 className="font-display text-3xl tracking-tight mt-1">Learn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What shipped, what came back, what to do next. The loop closes here.
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

        {tab === "outcomes" && <OutcomesPanel />}
        {tab === "support" && <SupportPanel />}
        {tab === "learnings" && <LearningsPanel />}
      </div>
    </AppShell>
  );
}
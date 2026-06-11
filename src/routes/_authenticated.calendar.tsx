import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalIcon } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { CalendarPanel } from "@/components/knowledge/CalendarPanel";

// /calendar stays a top-level pinned surface (daily cadence). The panel
// itself lives under components/knowledge/ since it was extracted during
// Phase 1d, but the route is its own pinned destination.
export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>): { meeting?: string } => ({
    meeting: typeof search.meeting === "string" ? search.meeting : undefined,
  }),
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar · Cadence" }] }),
});

function CalendarPage() {
  const { meeting } = Route.useSearch();
  const navigate = useNavigate({ from: "/calendar" });

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const setMeeting = (m: string | undefined) =>
    navigate({ search: { meeting: m } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <CalIcon className="h-3 w-3" /> Calendar
          </div>
          <h1 className="font-display text-3xl tracking-tight mt-1">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Events and meeting transcripts in one feed. Open a meeting to capture and extract.
          </p>
        </header>
        <CalendarPanel meetingId={meeting} onMeetingChange={setMeeting} />
      </div>
    </AppShell>
  );
}

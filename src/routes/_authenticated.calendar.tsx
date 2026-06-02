import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalIcon, RefreshCw, ExternalLink, Video, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listCalendarEvents, syncCalendar, createCalendarEvent, proposeSlots } from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar · Cadence" }] }),
});

type EventRow = {
  id: string; title: string; description: string | null; location: string | null;
  start_at: string; end_at: string | null; all_day: boolean;
  hangout_link: string | null; html_link: string | null; organizer_email: string | null;
  attendees: { email: string; displayName?: string; responseStatus?: string }[];
};

function fmtTime(iso: string, allDay: boolean) {
  const d = new Date(iso);
  if (allDay) return "All day";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function CalendarPage() {
  const qc = useQueryClient();
  const fProjects = useServerFn(listProjects);
  const fEvents = useServerFn(listCalendarEvents);
  const fSync = useServerFn(syncCalendar);
  const fCreate = useServerFn(createCalendarEvent);
  const fPropose = useServerFn(proposeSlots);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const events = useQuery({ queryKey: ["calendar-events"], queryFn: () => fEvents() });

  const mSync = useMutation({
    mutationFn: () => fSync({ data: { calendarId: "primary", daysAhead: 14 } }),
    onSuccess: ({ count }) => {
      toast.success(`Synced ${count} events`);
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [slots, setSlots] = useState<{ start_at: string; end_at: string; label: string }[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  const mPropose = useMutation({
    mutationFn: () => fPropose({ data: { durationMinutes: 60, daysAhead: 7, count: 3 } }),
    onSuccess: (r) => { setSlots(r.slots); if (r.slots[0]) setPicked(r.slots[0].start_at); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCreate = useMutation({
    mutationFn: () => {
      const slot = slots.find((s) => s.start_at === picked) ?? slots[0];
      if (!slot || !title.trim()) throw new Error("Pick a slot and add a title");
      return fCreate({ data: { summary: title, start_at: slot.start_at, end_at: slot.end_at } });
    },
    onSuccess: () => {
      toast.success("Event created");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowNew(false); setTitle(""); setSlots([]); setPicked(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (events.data?.events ?? []) as unknown as EventRow[];
  const groups = list.reduce((acc, e) => {
    const k = new Date(e.start_at).toDateString();
    (acc[k] = acc[k] ?? []).push(e);
    return acc;
  }, {} as Record<string, EventRow[]>);

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1100px] mx-auto">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
              <CalIcon className="h-3.5 w-3.5 text-violet-300" /> Calendar
            </div>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Upcoming <span className="neural-text">meetings</span></h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Pulled from your connected Google Calendar. Cadence treats these as context for agents and daily briefs.
            </p>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowNew(true); if (slots.length === 0) mPropose.mutate(); }}
            className="inline-flex items-center gap-2 rounded-xl border hairline px-3.5 py-2 text-sm hover:bg-secondary/60"
          >
            <Plus className="h-3.5 w-3.5" /> New event
          </button>
          <button
            onClick={() => mSync.mutate()}
            disabled={mSync.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-3.5 py-2 text-sm disabled:opacity-60"
          >
            {mSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync now
          </button>
          </div>
        </header>

        {showNew && (
          <div className="bento p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-display text-sm flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-violet-300" /> Schedule with AI</div>
              <button onClick={() => setShowNew(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title (e.g. Deep-work block)"
                   className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm" />
            <div>
              <div className="text-xs text-muted-foreground mb-2">Suggested slots (within your working hours, no conflicts)</div>
              {mPropose.isPending && <div className="text-xs text-muted-foreground">Finding open time…</div>}
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button key={s.start_at} onClick={() => setPicked(s.start_at)}
                          className={`text-xs rounded-md px-2.5 py-1.5 border hairline ${picked === s.start_at ? "bg-foreground text-background" : "hover:bg-secondary/60"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => mPropose.mutate()} className="text-xs rounded-md border hairline px-3 py-1.5 hover:bg-secondary/60">
                Re-suggest
              </button>
              <button onClick={() => mCreate.mutate()} disabled={!picked || !title.trim() || mCreate.isPending}
                      className="text-xs rounded-md bg-foreground text-background px-3 py-1.5 disabled:opacity-50">
                {mCreate.isPending ? "Creating…" : "Create event"}
              </button>
            </div>
          </div>
        )}

        {events.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {!events.isLoading && list.length === 0 && (
          <div className="bento p-10 text-center">
            <CalIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <div className="font-display text-lg">No events yet</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Click <span className="text-foreground">Sync now</span> to pull the next two weeks from your primary Google Calendar.
            </p>
          </div>
        )}

        <div className="space-y-6 mt-4">
          {Object.entries(groups).map(([day, evs]) => (
            <section key={day}>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">{fmtDate(evs[0].start_at)}</div>
              <div className="bento divide-y divide-white/5">
                {evs.map((e) => (
                  <div key={e.id} className="p-4 flex gap-4">
                    <div className="w-24 shrink-0 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{fmtTime(e.start_at, e.all_day)}</div>
                      {e.end_at && !e.all_day && <div>{fmtTime(e.end_at, false)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm flex items-center gap-2">
                        {e.title}
                        {e.hangout_link && (
                          <a href={e.hangout_link} target="_blank" rel="noreferrer" className="text-emerald-400 hover:opacity-80">
                            <Video className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {e.location && <div className="text-xs text-muted-foreground mt-0.5">{e.location}</div>}
                      {e.attendees?.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {e.attendees.slice(0, 5).map((a) => a.displayName || a.email).join(", ")}
                          {e.attendees.length > 5 && ` +${e.attendees.length - 5}`}
                        </div>
                      )}
                    </div>
                    {e.html_link && (
                      <a href={e.html_link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
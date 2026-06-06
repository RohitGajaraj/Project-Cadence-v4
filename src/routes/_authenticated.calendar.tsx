import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalIcon, RefreshCw, ExternalLink, Video, Loader2, Plus, Sparkles, List, FileText, CheckCircle2, Users as UsersIcon, ChevronLeft, ChevronRight, Trash2, Pencil, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listCalendarEvents, syncCalendar, createCalendarEvent, proposeSlots, updateCalendarEvent, deleteCalendarEvent } from "@/lib/calendar.functions";
import { listMyCalendarConnections, startCalendarConnect, saveCalendarConnection, disconnectCalendar } from "@/lib/calendar-connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { listMeetings } from "@/lib/meetings.functions";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MeetingDetailBody } from "@/components/cadence/MeetingDetailBody";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/use-confirm";

type View = "list" | "grid";
const VIEW_KEY = "cadence.calendar.view";

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>): { meeting?: string } => ({
    meeting: typeof search.meeting === "string" ? search.meeting : undefined,
  }),
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
  const { meeting: meetingId } = Route.useSearch();
  const navigate = useNavigate({ from: "/calendar" });
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fProjects = useServerFn(listProjects);
  const fEvents = useServerFn(listCalendarEvents);
  const fSync = useServerFn(syncCalendar);
  const fCreate = useServerFn(createCalendarEvent);
  const fPropose = useServerFn(proposeSlots);
  const fMeetings = useServerFn(listMeetings);
  const fListConns = useServerFn(listMyCalendarConnections);
  const fStartConnect = useServerFn(startCalendarConnect);
  const fSaveConn = useServerFn(saveCalendarConnection);
  const fDisconnect = useServerFn(disconnectCalendar);
  const fUpdate = useServerFn(updateCalendarEvent);
  const fDelete = useServerFn(deleteCalendarEvent);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const events = useQuery({ queryKey: ["calendar-events"], queryFn: () => fEvents() });
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => fMeetings() });
  const connections = useQuery({ queryKey: ["calendar-connections"], queryFn: () => fListConns() });

  // View preference persists per-user (list is default — capture/extract is the
  // value flow, not time-blocking).
  const [view, setView] = useState<View>("list");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(VIEW_KEY);
    if (v === "grid" || v === "list") setView(v);
  }, []);
  function setViewPersist(v: View) {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, v);
  }

  function openMeeting(id: string) {
    void navigate({ search: { meeting: id } });
  }
  function closeMeeting() {
    void navigate({ search: { meeting: undefined } });
  }

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

  // Month grid state
  const [gridCursor, setGridCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  // Event editor
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function openEditor(e: EventRow) {
    setEditing(e);
    setEditTitle(e.title);
    setEditDesc(e.description ?? "");
    setEditStart(toLocalInput(e.start_at));
    setEditEnd(e.end_at ? toLocalInput(e.end_at) : toLocalInput(e.start_at));
  }

  const mConnect = useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const result = await connectAppUser({
        connectorId: provider === "google" ? "google_calendar" : "microsoft_outlook",
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        start: (targetOrigin) =>
          fStartConnect({ data: { provider, targetOrigin } }),
      });
      if (!result.success || !result.connectionId) throw new Error(result.error ?? "Connect failed");
      return fSaveConn({ data: { provider, connectionId: result.connectionId } });
    },
    onSuccess: () => {
      toast.success("Calendar connected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDisconnect = useMutation({
    mutationFn: (id: string) => fDisconnect({ data: { id } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mUpdateEvt = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No event");
      return fUpdate({ data: {
        calendarId: "primary",
        externalId: editing.id,
        summary: editTitle,
        description: editDesc || undefined,
        start_at: new Date(editStart).toISOString(),
        end_at: new Date(editEnd).toISOString(),
      } });
    },
    onSuccess: () => {
      toast.success("Event updated");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDeleteEvt = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No event");
      return fDelete({ data: { calendarId: "primary", externalId: editing.id } });
    },
    onSuccess: () => {
      toast.success("Event deleted");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  // Unified chronological feed for List view: meetings + calendar events,
  // sorted by start time. Meetings get a "Meeting" badge; events stay native.
  type FeedItem =
    | { kind: "meeting"; id: string; title: string; start_at: string; stakeholder: string | null; processed: boolean; summary: string | null }
    | { kind: "event"; id: string; title: string; start_at: string; end_at: string | null; all_day: boolean; location: string | null; hangout_link: string | null; html_link: string | null; attendees: { email: string; displayName?: string }[] };

  const meetingItems: FeedItem[] = (meetings.data?.meetings ?? []).map((m) => ({
    kind: "meeting" as const,
    id: m.id,
    title: m.title,
    start_at: m.start_at,
    stakeholder: m.stakeholder ?? null,
    processed: !!m.processed_at,
    summary: (m.summary as string | null) ?? null,
  }));
  const eventItems: FeedItem[] = list.map((e) => ({
    kind: "event" as const,
    id: e.id,
    title: e.title,
    start_at: e.start_at,
    end_at: e.end_at,
    all_day: e.all_day,
    location: e.location,
    hangout_link: e.hangout_link,
    html_link: e.html_link,
    attendees: e.attendees ?? [],
  }));
  // Clamp to today → +14d and sort ascending so the next event is at the top.
  const _now = Date.now();
  const _end = _now + 14 * 24 * 60 * 60 * 1000;
  const feed = [...meetingItems, ...eventItems]
    .filter((it) => {
      const t = new Date(it.start_at).getTime();
      return t >= _now - 12 * 60 * 60 * 1000 && t <= _end;
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1100px] mx-auto">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
              <CalIcon className="h-3.5 w-3.5 text-violet-300" /> Calendar
            </div>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Time and meetings</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Your calendar events and meeting transcripts in one place. Click any meeting to capture a transcript and extract decisions, tasks, and questions.
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground/80">
              Showing the next 14 days.
            </p>
          </div>
          <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border hairline p-0.5">
            <button
              onClick={() => setViewPersist("list")}
              aria-pressed={view === "list"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${view === "list" ? "bg-foreground text-background" : "hover:bg-secondary/60"}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setViewPersist("grid")}
              aria-pressed={view === "grid"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${view === "grid" ? "bg-foreground text-background" : "hover:bg-secondary/60"}`}
            >
              <CalIcon className="h-3.5 w-3.5" /> Calendar
            </button>
          </div>
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

        {!events.isLoading && !meetings.isLoading && feed.length === 0 && (
          <div className="bento p-10 text-center">
            <CalIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <div className="font-display text-lg">Nothing on the calendar yet</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Click <span className="text-foreground">Sync now</span> to pull events from Google Calendar, or use the dashboard to log a meeting.
            </p>
          </div>
        )}

        {view === "list" && feed.length > 0 && (
          <div className="bento overflow-hidden mt-4">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr className="border-b hairline">
                  <th className="text-left px-4 py-3 w-28">When</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3 w-32">Kind</th>
                  <th className="text-left px-4 py-3 w-40">Context</th>
                  <th className="text-right px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {feed.map((it) => (
                  <tr
                    key={`${it.kind}:${it.id}`}
                    className={`border-b hairline/40 ${it.kind === "meeting" ? "hover:bg-secondary/40 cursor-pointer" : ""}`}
                    onClick={() => it.kind === "meeting" && openMeeting(it.id)}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      <div>{new Date(it.start_at).toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                      <div className="text-[11px]">{new Date(it.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.title}</div>
                      {it.kind === "meeting" && it.summary && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{it.summary}</div>
                      )}
                      {it.kind === "event" && it.location && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{it.location}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {it.kind === "meeting" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-full border hairline px-2 py-0.5 text-foreground">
                          <FileText className="h-3 w-3" /> Meeting
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-full border hairline px-2 py-0.5 text-muted-foreground">
                          <CalIcon className="h-3 w-3" /> Event
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {it.kind === "meeting" ? (
                        it.processed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Extracted</span>
                        ) : (
                          it.stakeholder ?? "—"
                        )
                      ) : it.attendees.length > 0 ? (
                        <span className="inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {it.attendees.length}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {it.kind === "meeting" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openMeeting(it.id); }}
                          className="inline-flex items-center gap-1 text-xs rounded-lg border hairline px-2.5 py-1.5 hover:bg-secondary"
                        >
                          Open
                        </button>
                      ) : (it.kind === "event" && it.html_link) ? (
                        <a href={it.html_link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-flex">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "grid" && (
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
        )}
      </div>

      <Sheet open={!!meetingId} onOpenChange={(o) => { if (!o) closeMeeting(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {meetingId && <MeetingDetailBody id={meetingId} />}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
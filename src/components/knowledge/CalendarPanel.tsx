// Calendar — Knowledge tab 1, ported from design-reference/cadence/loop.jsx
// (KnowledgeScreen · Calendar): list / Month / Year mono switcher, bento event
// rows with the expandable Historian capture section, the contribution-style
// pixel month (ember-mix occupancy, today ringed ember, quick-add that syncs
// back) and the 52×7 year occupancy grid. Production functionality rides the
// reference visuals: real calendar/meetings queries, two-way sync + create /
// update / delete mutations, the Scheduler slot proposer, calendar OAuth
// connections, and the ?meeting= deep link (opens the meeting sheet).
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalIcon,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listCalendarEvents,
  syncCalendar,
  createCalendarEvent,
  proposeSlots,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/calendar.functions";
import {
  listMyCalendarConnections,
  startCalendarConnect,
  saveCalendarConnection,
  disconnectCalendar,
} from "@/lib/calendar-connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { listMeetings } from "@/lib/meetings.functions";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MeetingDetailBody } from "@/components/cadence/MeetingDetailBody";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/hooks/use-confirm";
import { EmptyState, MonoLabel, VerdictChip } from "@/components/cadence/Primitives";

type View = "list" | "month" | "year";
const VIEW_KEY = "cadence.calendar.view";

/* Occupancy shades — pixel intensity = how occupied the day is (reference). */
const SHADES = [
  "var(--surface-2)",
  "color-mix(in oklab, var(--ember) 18%, var(--canvas))",
  "color-mix(in oklab, var(--ember) 38%, var(--canvas))",
  "color-mix(in oklab, var(--ember) 60%, var(--canvas))",
];

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  hangout_link: string | null;
  html_link: string | null;
  organizer_email: string | null;
  attendees: { email: string; displayName?: string; responseStatus?: string }[];
};

type DayItem = {
  kind: "meeting" | "event";
  id: string;
  title: string;
  start_at: string;
  allDay: boolean;
  /** meeting only */
  processed?: boolean;
  summary?: string | null;
  stakeholder?: string | null;
  /** event only */
  event?: EventRow;
};

function fmtTime(iso: string, allDay: boolean) {
  if (allDay) return "all day";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
/** Reference "when" column format: "Fri 12 · 11:00". */
function whenLabel(iso: string, allDay: boolean) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: "short" })} ${d.getDate()} · ${fmtTime(iso, allDay)}`;
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarPanel({
  meetingId,
  onMeetingChange,
}: {
  meetingId: string | undefined;
  onMeetingChange: (id: string | undefined) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
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
  const events = useQuery({ queryKey: ["calendar-events"], queryFn: () => fEvents() });
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => fMeetings() });
  const connections = useQuery({ queryKey: ["calendar-connections"], queryFn: () => fListConns() });

  const [view, setView] = useState<View>("list");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(VIEW_KEY);
    if (v === "list" || v === "month" || v === "year") setView(v);
    else if (v === "grid") setView("month"); // pre-Ember stored value
  }, []);
  function setViewPersist(v: View) {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, v);
  }

  const [openRow, setOpenRow] = useState<string | null>(null);
  const [calCursor, setCalCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Today is selected by default (founder 2026-06-12): opening Month shows
  // today accent-highlighted with its day list already open below the grid.
  // The cursor starts on the current month, so today's date is always valid.
  const [selDay, setSelDay] = useState<number | null>(() => new Date().getDate());
  const [connectOpen, setConnectOpen] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [slots, setSlots] = useState<{ start_at: string; end_at: string; label: string }[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

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

  const mSync = useMutation({
    mutationFn: () => fSync({ data: { calendarId: "primary", daysAhead: 14 } }),
    onSuccess: ({ count }) => {
      toast.success(`Synced ${count} events`);
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mConnect = useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const result = await connectAppUser({
        connectorId: provider === "google" ? "google_calendar" : "microsoft_outlook",
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        start: (targetOrigin) => fStartConnect({ data: { provider, targetOrigin } }),
      });
      if (!result.success || !result.connectionId)
        throw new Error(result.error ?? "Connect failed");
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
      return fUpdate({
        data: {
          calendarId: "primary",
          externalId: editing.id,
          summary: editTitle,
          description: editDesc || undefined,
          start_at: new Date(editStart).toISOString(),
          end_at: new Date(editEnd).toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Event updated · synced back to your calendar");
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
      toast.success("Event deleted · removed from your calendar");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mPropose = useMutation({
    mutationFn: () => fPropose({ data: { durationMinutes: 60, daysAhead: 7, count: 3 } }),
    onSuccess: (r) => {
      setSlots(r.slots);
      if (r.slots[0]) setPicked(r.slots[0].start_at);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCreate = useMutation({
    mutationFn: () => {
      const slot = slots.find((s) => s.start_at === picked) ?? slots[0];
      if (!slot || !title.trim()) throw new Error("Pick a slot and add a title");
      return fCreate({ data: { summary: title, start_at: slot.start_at, end_at: slot.end_at } });
    },
    onSuccess: () => {
      toast.success("Event created · synced back to your calendar");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowNew(false);
      setTitle("");
      setSlots([]);
      setPicked(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* "+ Add · syncs back" — a real focus-block hold on the selected day
     (09:00–10:00 local; production events carry times). */
  const mQuickAdd = useMutation({
    mutationFn: (day: Date) => {
      const s = new Date(day);
      s.setHours(9, 0, 0, 0);
      const e = new Date(day);
      e.setHours(10, 0, 0, 0);
      return fCreate({
        data: {
          summary: "Hold · focus block",
          start_at: s.toISOString(),
          end_at: e.toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Added here · syncs to your calendar");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (events.data?.events ?? []) as unknown as EventRow[];

  const meetingItems: DayItem[] = (meetings.data?.meetings ?? []).map((m) => ({
    kind: "meeting" as const,
    id: m.id,
    title: m.title,
    start_at: m.start_at,
    allDay: false,
    processed: !!m.processed_at,
    summary: (m.summary as string | null) ?? null,
    stakeholder: m.stakeholder ?? null,
  }));
  const eventItems: DayItem[] = list.map((e) => ({
    kind: "event" as const,
    id: e.id,
    title: e.title,
    start_at: e.start_at,
    allDay: e.all_day,
    event: e,
  }));
  const allItems = [...meetingItems, ...eventItems];

  // List view scope: the next 14 days (the synced window).
  const _now = Date.now();
  const _end = _now + 14 * 24 * 60 * 60 * 1000;
  const feed = allItems
    .filter((it) => {
      const t = new Date(it.start_at).getTime();
      return t >= _now - 12 * 60 * 60 * 1000 && t <= _end;
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  // Month/year occupancy buckets from everything loaded (events + meetings).
  const buckets: Record<string, DayItem[]> = {};
  for (const it of allItems) {
    const k = new Date(it.start_at).toDateString();
    (buckets[k] = buckets[k] ?? []).push(it);
  }

  function openItem(it: DayItem) {
    if (it.kind === "meeting") onMeetingChange(it.id);
    else if (it.event) openEditor(it.event);
  }

  const loading = events.isLoading || meetings.isLoading;
  const loadError = (events.error ?? meetings.error) as Error | null;

  return (
    <div>
      {/* Production actions (left) ride the reference's right-aligned view switcher. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <ConnectButton
          open={connectOpen}
          setOpen={setConnectOpen}
          connections={connections.data?.connections ?? []}
          available={connections.data?.providersAvailable ?? { google: false, microsoft: false }}
          onConnect={(p) => mConnect.mutate(p)}
          onDisconnect={async (id) => {
            const ok = await confirm({
              title: "Disconnect this calendar?",
              body: "Stored events stay but no further sync will happen.",
              confirmLabel: "Disconnect",
              destructive: true,
            });
            if (ok) mDisconnect.mutate(id);
          }}
          connecting={mConnect.isPending}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setShowNew(true);
            if (slots.length === 0) mPropose.mutate();
          }}
        >
          New event · Scheduler proposes slots
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => mSync.mutate()}
          disabled={mSync.isPending}
        >
          {mSync.isPending ? "Syncing…" : "Sync · pulls 14 days"}
        </button>
        <span style={{ flex: 1 }}></span>
        <div
          style={{
            display: "flex",
            gap: 2,
            border: "1px solid var(--hairline)",
            borderRadius: 7,
            padding: 2,
          }}
        >
          {(
            [
              ["list", "List"],
              ["month", "Month"],
              ["year", "Year"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setViewPersist(id)}
              className="mono-label"
              style={{
                fontSize: 9,
                padding: "3px 10px",
                borderRadius: 5,
                background: view === id ? "var(--surface-2)" : "transparent",
                color: view === id ? "var(--ink)" : "var(--ink-subtle)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {showNew && (
        <div className="bento fade-up" style={{ padding: "var(--card-pad)", marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <MonoLabel icon={Sparkles}>Schedule · Scheduler finds open time</MonoLabel>
            <button
              className="mono-label"
              style={{ fontSize: 9, color: "var(--ink-subtle)" }}
              onClick={() => setShowNew(false)}
            >
              cancel
            </button>
          </div>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title · e.g. Deep-work block"
          />
          <div style={{ marginTop: 10 }}>
            <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 6 }}>
              suggested slots · inside your working hours, no conflicts
            </div>
            {mPropose.isPending ? (
              <span className="mono-label" style={{ fontSize: 9 }}>
                finding open time…
              </span>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {slots.map((s) => (
                <button
                  key={s.start_at}
                  onClick={() => setPicked(s.start_at)}
                  className="mono-label"
                  style={{
                    fontSize: 9,
                    padding: "4px 10px",
                    borderRadius: 99,
                    border: `1px solid ${picked === s.start_at ? "var(--ink)" : "var(--hairline)"}`,
                    background: picked === s.start_at ? "var(--surface-2)" : "transparent",
                    color: picked === s.start_at ? "var(--ink)" : "var(--ink-muted)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => mPropose.mutate()}>
              Re-suggest · new slots
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => mCreate.mutate()}
              disabled={!picked || !title.trim() || mCreate.isPending}
            >
              {mCreate.isPending ? "Creating…" : "Create · syncs back"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
          <span className="spinner" />
          <span className="mono-label" style={{ fontSize: 9 }}>
            loading…
          </span>
        </div>
      ) : loadError ? (
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>calendar · failed to load</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
            {loadError.message}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              void events.refetch();
              void meetings.refetch();
            }}
          >
            Retry · reloads the feed
          </button>
        </div>
      ) : view === "list" && feed.length === 0 ? (
        <EmptyState
          icon={CalIcon}
          title="Nothing on the calendar yet"
          body="Sync pulls events from your connected calendar; meetings logged on the dashboard land here too."
          cta="Sync · pulls 14 days"
          onCta={() => mSync.mutate()}
        />
      ) : view === "month" ? (
        <MonthGrid
          cursor={calCursor}
          setCursor={setCalCursor}
          selDay={selDay}
          setSelDay={setSelDay}
          buckets={buckets}
          onOpenItem={openItem}
          onQuickAdd={(d) => mQuickAdd.mutate(d)}
          quickAddPending={mQuickAdd.isPending}
        />
      ) : view === "year" ? (
        <YearGrid buckets={buckets} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {feed.map((it) => {
            const key = `${it.kind}:${it.id}`;
            const expandable = it.kind === "meeting" && !!it.summary;
            const expanded = openRow === key;
            return (
              <div key={key} className="bento lift" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (expandable) setOpenRow(expanded ? null : key);
                    else openItem(it);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (expandable) setOpenRow(expanded ? null : key);
                      else openItem(it);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    textAlign: "left",
                    padding: "13px 16px",
                    cursor: "pointer",
                  }}
                >
                  <span
                    className="mono-label tabular-nums"
                    style={{ width: 104, flexShrink: 0, color: "var(--ink)" }}
                  >
                    {whenLabel(it.start_at, it.allDay)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 500, fontSize: 13.5 }}>
                      {it.title}
                    </span>
                    {it.kind === "meeting" ? (
                      it.stakeholder ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            color: "var(--ink-faint)",
                            marginTop: 1,
                          }}
                        >
                          {it.stakeholder}
                        </span>
                      ) : null
                    ) : it.event?.location || (it.event?.attendees.length ?? 0) > 0 ? (
                      <span
                        style={{
                          display: "block",
                          fontSize: 11.5,
                          color: "var(--ink-faint)",
                          marginTop: 1,
                        }}
                      >
                        {it.event?.location ?? `${it.event?.attendees.length} attendees`}
                      </span>
                    ) : null}
                  </span>
                  {it.kind === "meeting" && it.processed ? (
                    <VerdictChip tone="orchid">extracted</VerdictChip>
                  ) : null}
                  <span
                    className="mono-label"
                    style={{ fontSize: 8.5, color: "var(--ink-subtle)" }}
                  >
                    {it.kind}
                  </span>
                  {it.kind === "event" && it.event?.html_link ? (
                    <a
                      href={it.event.html_link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Open in provider"
                      style={{ color: "var(--ink-faint)", display: "inline-flex" }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  ) : expandable ? (
                    expanded ? (
                      <ChevronDown size={13} style={{ color: "var(--ink-faint)" }} />
                    ) : (
                      <ChevronRight size={13} style={{ color: "var(--ink-faint)" }} />
                    )
                  ) : it.kind === "meeting" ? (
                    <ChevronRight size={13} style={{ color: "var(--ink-faint)" }} />
                  ) : (
                    <span style={{ width: 13 }}></span>
                  )}
                </div>
                {expanded && it.summary ? (
                  <div
                    className="fade-up"
                    style={{
                      padding: "12px 16px 14px 134px",
                      borderTop: "1px solid var(--hairline)",
                      background: "var(--surface-1)",
                    }}
                  >
                    <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 6 }}>
                      capture · extracted by Historian
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6 }}>
                      {it.summary}
                    </p>
                    <button
                      className="mono-label"
                      style={{ fontSize: 8.5, color: "var(--action-blue)", marginTop: 8 }}
                      onClick={() => onMeetingChange(it.id)}
                    >
                      Open · capture &amp; extract
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          <span className="mono-label" style={{ fontSize: 7.5, padding: "4px 2px" }}>
            next 14 days · synced two-way with your calendar
          </span>
        </div>
      )}

      <Sheet
        open={!!meetingId}
        onOpenChange={(o) => {
          if (!o) onMeetingChange(undefined);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {meetingId && <MeetingDetailBody id={meetingId} />}
        </SheetContent>
      </Sheet>

      {editing ? (
        <EventEditor
          editing={editing}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editStart={editStart}
          setEditStart={setEditStart}
          editEnd={editEnd}
          setEditEnd={setEditEnd}
          editDesc={editDesc}
          setEditDesc={setEditDesc}
          onClose={() => setEditing(null)}
          onSave={() => mUpdateEvt.mutate()}
          saving={mUpdateEvt.isPending}
          onDelete={async () => {
            const ok = await confirm({
              title: "Delete this event?",
              body: "This removes it from your calendar provider too.",
              confirmLabel: "Delete",
              destructive: true,
            });
            if (ok) mDeleteEvt.mutate();
          }}
          deleting={mDeleteEvt.isPending}
        />
      ) : null}
    </div>
  );
}

/* —— Month — contribution-style pixel month (reference). —— */
function MonthGrid({
  cursor,
  setCursor,
  selDay,
  setSelDay,
  buckets,
  onOpenItem,
  onQuickAdd,
  quickAddPending,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  selDay: number | null;
  setSelDay: (d: number | null) => void;
  buckets: Record<string, DayItem[]>;
  onOpenItem: (it: DayItem) => void;
  onQuickAdd: (d: Date) => void;
  quickAddPending: boolean;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleDateString([], { month: "long" });
  const label = `${monthName} ${year}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const first = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const cells = Math.ceil((first + daysInMonth) / 7) * 7;
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  const dayItems = (d: number) => buckets[new Date(year, month, d).toDateString()] ?? [];
  const selItems = selDay != null ? dayItems(selDay) : [];

  return (
    <div className="bento" style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          padding: "0 2px",
        }}
      >
        <span className="font-display" style={{ fontSize: 16, flex: 1 }}>
          {label}
        </span>
        <button
          aria-label="Previous month"
          className="btn btn-ghost btn-sm"
          style={{ padding: "3px 8px" }}
          onClick={() => {
            setCursor(new Date(year, month - 1, 1));
            setSelDay(null);
          }}
        >
          ‹
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 10.5 }}
          onClick={() => {
            const d = new Date();
            const day = d.getDate();
            d.setDate(1);
            d.setHours(0, 0, 0, 0);
            setCursor(d);
            setSelDay(day);
          }}
        >
          Today
        </button>
        <button
          aria-label="Next month"
          className="btn btn-ghost btn-sm"
          style={{ padding: "3px 8px" }}
          onClick={() => {
            setCursor(new Date(year, month + 1, 1));
            setSelDay(null);
          }}
        >
          ›
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, di) => (
          <div
            key={d}
            className="mono-label"
            style={{
              fontSize: 8,
              textAlign: "center",
              padding: "2px 0 4px",
              opacity: di > 4 ? 0.5 : 1,
            }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: cells }, (_, i) => {
          const day = i - first + 1;
          const inMonth = day >= 1 && day <= daysInMonth;
          const isToday = isThisMonth && day === today.getDate();
          const isSel = selDay === day && inMonth;
          const its = inMonth ? dayItems(day) : [];
          const n = its.length;
          const weekend = i % 7 > 4;
          // Today always carries the ember accent (founder 2026-06-12) — a
          // quiet wash when free, the occupancy shade (already ember-mixed,
          // and stronger) when occupied.
          const fill = !inMonth
            ? "transparent"
            : isToday && n === 0
              ? "color-mix(in oklab, var(--ember) 12%, var(--canvas))"
              : SHADES[Math.min(n, 3)];
          return (
            <button
              key={i}
              disabled={!inMonth}
              aria-label={
                inMonth ? `${monthName} ${day} · ${n} event${n === 1 ? "" : "s"}` : undefined
              }
              onClick={() => setSelDay(isSel ? null : day)}
              title={inMonth ? (n ? its.map((e) => e.title).join(" · ") : "free") : undefined}
              style={{
                aspectRatio: "1.6",
                borderRadius: 5,
                position: "relative",
                overflow: "hidden",
                background: fill,
                border: isToday
                  ? "1.5px solid var(--ember)"
                  : isSel
                    ? "1.5px solid var(--ink)"
                    : "1px solid var(--hairline)",
                opacity: !inMonth ? 0.25 : weekend ? 0.55 : 1,
                cursor: inMonth ? "pointer" : "default",
                transition: "background var(--dur-fast), border-color var(--dur-fast)",
              }}
            >
              <span
                className="mono-label tabular-nums"
                style={{
                  fontSize: 7.5,
                  position: "absolute",
                  top: 3,
                  left: 5,
                  color: n >= 2 ? "var(--canvas)" : isToday ? "var(--ember)" : "var(--ink-faint)",
                }}
              >
                {inMonth ? day : ""}
              </span>
              {n > 0 ? (
                <span
                  style={{
                    position: "absolute",
                    left: 5,
                    right: 4,
                    bottom: 2,
                    fontSize: 7,
                    lineHeight: 1.2,
                    fontFamily: "var(--font-mono)",
                    color: n >= 2 ? "var(--canvas)" : "var(--ink-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textAlign: "left",
                  }}
                >
                  {its[0].title}
                  {n > 1 ? ` +${n - 1}` : ""}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "0 2px" }}
      >
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          free
        </span>
        {SHADES.map((c) => (
          <span
            key={c}
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: c,
              border: "1px solid var(--hairline)",
              display: "inline-block",
            }}
          ></span>
        ))}
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          occupied
        </span>
        <span style={{ flex: 1 }}></span>
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          synced two-way with your calendar · weekends: Settings → Profile
        </span>
      </div>
      {selDay != null ? (
        <div
          className="fade-up"
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--surface-1)",
            border: "1px solid var(--hairline)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: selItems.length ? 6 : 0,
            }}
          >
            <span className="mono-label" style={{ fontSize: 8.5, color: "var(--ink)" }}>
              {monthName} {selDay}
              {isThisMonth && selDay === today.getDate() ? (
                <span style={{ color: "var(--ember)" }}> · today</span>
              ) : null}
            </span>
            <span style={{ flex: 1 }}></span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 10 }}
              disabled={quickAddPending}
              onClick={() => onQuickAdd(new Date(year, month, selDay))}
            >
              {quickAddPending ? "Adding…" : "+ Add · syncs back"}
            </button>
          </div>
          {selItems.map((it) => (
            <button
              key={`${it.kind}:${it.id}`}
              onClick={() => onOpenItem(it)}
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--action-blue)",
                padding: "2px 0",
                textAlign: "left",
              }}
            >
              {whenLabel(it.start_at, it.allDay)} · {it.title}
            </button>
          ))}
          {selItems.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
              Nothing scheduled — a good deep-work day.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* —— Year — GitHub-contribution-style occupancy from real events only.
   Founder ruling 2026-06-12: the grid runs January → today ONLY — the latest
   date closes the grid at the right edge, exactly like a contribution graph;
   pending future months never render (the year fills in as it happens).
   The synced window (last 30 days of meetings + the synced events ahead)
   renders shaded; days inside the year but outside it stay open. —— */
function YearGrid({ buckets }: { buckets: Record<string, DayItem[]> }) {
  const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const year = today.getFullYear();
  const coverageStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  coverageStart.setHours(0, 0, 0, 0);
  const offset = (new Date(year, 0, 1).getDay() + 6) % 7; // Monday-first
  const dateAt = (w: number, d: number) => new Date(year, 0, 1 + (w * 7 + d - offset));
  // Weeks elapsed this year — the last rendered column holds today.
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(year, 0, 1).getTime()) / (24 * 60 * 60 * 1000),
  );
  const weeksToShow = Math.floor((offset + dayOfYear) / 7) + 1;
  const inRange = (dt: Date) => dt.getFullYear() === year && dt <= today;
  const busy = (w: number, d: number): number => {
    const dt = dateAt(w, d);
    if (!inRange(dt)) return -1;
    if (dt < coverageStart) return -1; // before the synced window — no data, stays open
    return Math.min((buckets[dt.toDateString()] ?? []).length, 3);
  };
  const isTodayCell = (w: number, d: number) => {
    const dt = dateAt(w, d);
    return (
      dt.getFullYear() === today.getFullYear() &&
      dt.getMonth() === today.getMonth() &&
      dt.getDate() === today.getDate()
    );
  };
  return (
    <div className="bento" style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
          padding: "0 2px",
        }}
      >
        <span className="font-display" style={{ fontSize: 16, flex: 1 }}>
          {year} · occupancy
        </span>
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          like a contribution graph — but for your time
        </span>
      </div>
      {/* The grid FILLS the card width — cell size derives from the weeks
          elapsed (founder 2026-06-12: no dead space on the right while the
          year is young). Capped so January doesn't render comedy-sized cells;
          by mid-year the quilt runs edge to edge. */}
      <div style={{ paddingBottom: 4, maxWidth: weeksToShow * 37 + 30 }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
          <span style={{ width: 27, flexShrink: 0 }}></span>
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: `repeat(${weeksToShow}, 1fr)`,
              gap: 3,
            }}
          >
            {MO.slice(0, today.getMonth() + 1).map((m, mi) => {
              const firstOfMonth = new Date(year, mi, 1);
              const col = Math.floor(
                (offset +
                  Math.floor(
                    (firstOfMonth.getTime() - new Date(year, 0, 1).getTime()) /
                      (24 * 60 * 60 * 1000),
                  )) /
                  7,
              );
              return (
                <span
                  key={m}
                  className="mono-label"
                  style={{
                    fontSize: 7,
                    gridRow: 1,
                    gridColumnStart: col + 1,
                    gridColumnEnd: `span ${Math.min(3, weeksToShow - col)}`,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "stretch" }}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 3, width: 27, flexShrink: 0 }}
          >
            {WD.map((d, i) => (
              <span
                key={d}
                className="mono-label"
                style={{
                  fontSize: 6.5,
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  opacity: i > 4 ? 0.5 : 1,
                }}
              >
                {i % 2 === 0 ? d : ""}
              </span>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: `repeat(${weeksToShow}, 1fr)`,
              gap: 3,
            }}
          >
            {Array.from({ length: weeksToShow }, (_, w) => (
              <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {Array.from({ length: 7 }, (_, d) => {
                  const b = busy(w, d);
                  const dt = dateAt(w, d);
                  const isToday = isTodayCell(w, d);
                  // Days before Jan 1 or after today don't exist on this grid —
                  // invisible spacers keep the week lattice aligned.
                  if (!inRange(dt)) {
                    return (
                      <span
                        key={d}
                        style={{ width: "100%", aspectRatio: "1", visibility: "hidden" }}
                      ></span>
                    );
                  }
                  return (
                    <span
                      key={d}
                      title={`${MO[dt.getMonth()]} ${dt.getDate()} · ${WD[d]} · ${b <= 0 ? "free" : `${b} event${b > 1 ? "s" : ""}`}`}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: "22%",
                        background: b < 0 ? "transparent" : SHADES[b],
                        border: isToday ? "1.5px solid var(--ember)" : "1px solid var(--hairline)",
                        opacity: d > 4 ? 0.55 : 1,
                        display: "block",
                      }}
                    ></span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "0 2px" }}
      >
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          free
        </span>
        {SHADES.map((c) => (
          <span
            key={c}
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: c,
              border: "1px solid var(--hairline)",
              display: "inline-block",
            }}
          ></span>
        ))}
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          occupied
        </span>
        <span style={{ flex: 1 }}></span>
        <span className="mono-label" style={{ fontSize: 7.5 }}>
          today ringed ember · the year fills in as it happens
        </span>
      </div>
    </div>
  );
}

/* —— Event editor — production update/delete mutations, quiet-Ember chrome. —— */
function EventEditor({
  editing,
  editTitle,
  setEditTitle,
  editStart,
  setEditStart,
  editEnd,
  setEditEnd,
  editDesc,
  setEditDesc,
  onClose,
  onSave,
  saving,
  onDelete,
  deleting,
}: {
  editing: EventRow;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editStart: string;
  setEditStart: (v: string) => void;
  editEnd: string;
  setEditEnd: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-label="Edit event"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 96,
        background: "color-mix(in oklab, var(--ink) 28%, transparent)",
      }}
      onClick={onClose}
    >
      <div
        className="bento fade-up"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 0,
          overflow: "hidden",
          boxShadow: "var(--shadow-elevated)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <MonoLabel icon={CalIcon}>Edit event · syncs back</MonoLabel>
          <span style={{ flex: 1 }}></span>
          <button
            className="mono-label"
            style={{ fontSize: 9, color: "var(--ink-subtle)" }}
            onClick={onClose}
          >
            close
          </button>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
              title
            </div>
            <input
              className="input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
                start
              </div>
              <input
                type="datetime-local"
                className="input"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
            </div>
            <div>
              <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
                end
              </div>
              <input
                type="datetime-local"
                className="input"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
              notes
            </div>
            <textarea
              className="input"
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              style={{ resize: "vertical", minHeight: 64 }}
            />
          </div>
          {editing.html_link ? (
            <a
              href={editing.html_link}
              target="_blank"
              rel="noreferrer"
              className="mono-label"
              style={{
                fontSize: 8.5,
                color: "var(--action-blue)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <ExternalLink size={11} /> open in provider
            </a>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <button
              className="btn btn-reject btn-sm"
              onClick={onDelete}
              disabled={deleting}
              style={{ marginRight: "auto" }}
            >
              {deleting ? "Deleting…" : "Delete · removes everywhere"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel · keeps it
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={saving || !editTitle.trim()}
            >
              {saving ? "Saving…" : "Save · syncs back"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* —— Calendar connections — production OAuth flow, quiet-Ember popover. —— */
function ConnectButton({
  open,
  setOpen,
  connections,
  available,
  onConnect,
  onDisconnect,
  connecting,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  connections: Array<{
    id: string;
    provider: "google" | "microsoft";
    account_email: string | null;
  }>;
  available: { google: boolean; microsoft: boolean };
  onConnect: (p: "google" | "microsoft") => void;
  onDisconnect: (id: string) => void;
  connecting: boolean;
}) {
  const hasGoogle = connections.some((c) => c.provider === "google");
  const hasMicrosoft = connections.some((c) => c.provider === "microsoft");
  const any = connections.length > 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label="Calendar connections" className="btn btn-ghost btn-sm">
          <Link2 size={12} strokeWidth={1.75} />
          <span
            className="dot"
            style={{
              width: 5,
              height: 5,
              background: any ? "var(--emerald)" : "var(--ink-faint)",
              marginLeft: 5,
            }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72" style={{ padding: 10 }}>
        <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 8 }}>
          calendar accounts
        </div>
        {connections.length === 0 ? (
          <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginBottom: 8 }}>
            Connect once and your events flow into Cadence. You can change this anytime.
          </p>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {connections.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              <span className="dot" style={{ width: 5, height: 5, background: "var(--emerald)" }} />
              <span
                style={{
                  fontSize: 11.5,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.provider === "google" ? "Google" : "Microsoft"}
                {c.account_email ? (
                  <span style={{ color: "var(--ink-subtle)" }}> · {c.account_email}</span>
                ) : null}
              </span>
              <button
                onClick={() => onDisconnect(c.id)}
                className="mono-label"
                style={{ fontSize: 9, color: "var(--ink-subtle)" }}
                aria-label="Disconnect"
              >
                ×
              </button>
            </div>
          ))}
          {!hasGoogle ? (
            <button
              onClick={() => onConnect("google")}
              disabled={connecting}
              title={available.google ? "" : "Provider credentials not yet configured"}
              className="cmdk-item"
              style={{ fontSize: 11.5, padding: "6px 8px" }}
            >
              <Plus size={11} style={{ marginRight: 6 }} /> Connect Google Calendar · OAuth
            </button>
          ) : null}
          {!hasMicrosoft ? (
            <button
              onClick={() => onConnect("microsoft")}
              disabled={connecting}
              title={available.microsoft ? "" : "Provider credentials not yet configured"}
              className="cmdk-item"
              style={{ fontSize: 11.5, padding: "6px 8px" }}
            >
              <Plus size={11} style={{ marginRight: 6 }} /> Connect Microsoft Outlook · OAuth
            </button>
          ) : null}
        </div>
        {!available.google && !available.microsoft && connections.length === 0 ? (
          <p className="mono-label" style={{ fontSize: 7.5, marginTop: 8 }}>
            connect setup pending · admin must add provider credentials
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

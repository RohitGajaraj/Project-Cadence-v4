import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

function headers() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!GOOGLE_CALENDAR_API_KEY) throw new Error("GOOGLE_CALENDAR_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
  };
}

type GEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  htmlLink?: string;
  organizer?: { email?: string };
};

async function gFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, { headers: headers() });
  const body = await res.text();
  if (!res.ok) throw new Error(`Google Calendar ${path} failed [${res.status}]: ${body.slice(0, 400)}`);
  return JSON.parse(body) as T;
}

async function gFetchMethod<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T | null> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: { ...headers(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Calendar ${method} ${path} failed [${res.status}]: ${text.slice(0, 400)}`);
  return text ? (JSON.parse(text) as T) : null;
}

function normalizeStart(e: GEvent): { start_at: string; end_at: string | null; all_day: boolean } {
  const allDay = !!(e.start?.date && !e.start?.dateTime);
  const startStr = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00Z` : new Date().toISOString());
  const endStr = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00Z` : null);
  return { start_at: startStr, end_at: endStr, all_day: allDay };
}

export const listCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await gFetch<{ items: { id: string; summary: string; primary?: boolean }[] }>(
      `/users/me/calendarList`,
    );
    return { calendars: r.items ?? [] };
  });

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      calendarId: z.string().min(1).max(200).default("primary"),
      daysAhead: z.number().int().min(1).max(60).default(14),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + data.daysAhead * 86400000).toISOString();
    const qs = new URLSearchParams({
      timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "100",
    }).toString();
    const r = await gFetch<{ items: GEvent[] }>(
      `/calendars/${encodeURIComponent(data.calendarId)}/events?${qs}`,
    );
    const rows = (r.items ?? []).map((e) => {
      const { start_at, end_at, all_day } = normalizeStart(e);
      return {
        user_id: userId,
        external_id: e.id,
        calendar_id: data.calendarId,
        title: e.summary ?? "(no title)",
        description: e.description ?? null,
        location: e.location ?? null,
        start_at,
        end_at,
        all_day,
        status: e.status ?? "confirmed",
        attendees: (e.attendees ?? []) as never,
        hangout_link: e.hangoutLink ?? null,
        html_link: e.htmlLink ?? null,
        organizer_email: e.organizer?.email ?? null,
        last_synced_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const { error } = await supabase
        .from("calendar_events")
        .upsert(rows as never, { onConflict: "user_id,external_id" });
      if (error) throw new Error(error.message);
    }
    return { count: rows.length };
  });

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 1 * 86400000).toISOString();
    const { data, error } = await context.supabase
      .from("calendar_events")
      .select("*")
      .gte("start_at", since)
      .order("start_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });

export const getTodayEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const { data, error } = await context.supabase
      .from("calendar_events")
      .select("*")
      .gte("start_at", start.toISOString())
      .lte("start_at", end.toISOString())
      .order("start_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });

const CreateSchema = z.object({
  calendarId: z.string().min(1).max(200).default("primary"),
  summary: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  location: z.string().max(300).optional(),
  start_at: z.string().min(10),
  end_at: z.string().min(10),
  attendees: z.array(z.string().email()).max(20).optional(),
});

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const body = {
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: { dateTime: new Date(data.start_at).toISOString() },
      end: { dateTime: new Date(data.end_at).toISOString() },
      attendees: data.attendees?.map((email) => ({ email })),
    };
    const e = await gFetchMethod<GEvent>(
      `/calendars/${encodeURIComponent(data.calendarId)}/events`,
      "POST",
      body,
    );
    if (!e) throw new Error("Empty response from Google Calendar");
    const { start_at, end_at, all_day } = normalizeStart(e);
    await supabase.from("calendar_events").upsert({
      user_id: userId,
      external_id: e.id,
      calendar_id: data.calendarId,
      title: e.summary ?? data.summary,
      description: e.description ?? null,
      location: e.location ?? null,
      start_at, end_at, all_day,
      status: e.status ?? "confirmed",
      attendees: (e.attendees ?? []) as never,
      hangout_link: e.hangoutLink ?? null,
      html_link: e.htmlLink ?? null,
      organizer_email: e.organizer?.email ?? null,
      last_synced_at: new Date().toISOString(),
    } as never, { onConflict: "user_id,external_id" });
    return { id: e.id, html_link: e.htmlLink };
  });

const UpdateSchema = z.object({
  calendarId: z.string().min(1).max(200).default("primary"),
  externalId: z.string().min(1).max(300),
  summary: z.string().max(300).optional(),
  description: z.string().max(4000).optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
});

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateSchema.parse(i))
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {};
    if (data.summary !== undefined) patch.summary = data.summary;
    if (data.description !== undefined) patch.description = data.description;
    if (data.start_at) patch.start = { dateTime: new Date(data.start_at).toISOString() };
    if (data.end_at) patch.end = { dateTime: new Date(data.end_at).toISOString() };
    await gFetchMethod(
      `/calendars/${encodeURIComponent(data.calendarId)}/events/${encodeURIComponent(data.externalId)}`,
      "PATCH",
      patch,
    );
    await context.supabase
      .from("calendar_events")
      .update({
        title: data.summary ?? undefined,
        description: data.description ?? undefined,
        start_at: data.start_at ?? undefined,
        end_at: data.end_at ?? undefined,
      } as never)
      .eq("user_id", context.userId)
      .eq("external_id", data.externalId);
    return { ok: true };
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      calendarId: z.string().min(1).max(200).default("primary"),
      externalId: z.string().min(1).max(300),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await gFetchMethod(
      `/calendars/${encodeURIComponent(data.calendarId)}/events/${encodeURIComponent(data.externalId)}`,
      "DELETE",
    );
    await context.supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", context.userId)
      .eq("external_id", data.externalId);
    return { ok: true };
  });

/**
 * Scheduler agent: propose 1–3 open slots in the next `daysAhead` days,
 * within the user's working hours, that don't conflict with existing events.
 */
export const proposeSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      durationMinutes: z.number().int().min(15).max(480).default(60),
      daysAhead: z.number().int().min(1).max(14).default(7),
      count: z.number().int().min(1).max(5).default(3),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("working_hours_start,working_hours_end,timezone")
      .eq("id", userId)
      .maybeSingle();
    const whStart = (prof as { working_hours_start?: number } | null)?.working_hours_start ?? 9;
    const whEnd = (prof as { working_hours_end?: number } | null)?.working_hours_end ?? 18;

    const now = new Date();
    const horizon = new Date(now.getTime() + data.daysAhead * 86400000);
    const { data: events } = await supabase
      .from("calendar_events")
      .select("start_at,end_at")
      .gte("start_at", now.toISOString())
      .lte("start_at", horizon.toISOString());
    type Range = { s: number; e: number };
    const busy: Range[] = (events ?? [])
      .map((e) => ({
        s: new Date(e.start_at as string).getTime(),
        e: new Date((e.end_at as string) ?? e.start_at as string).getTime() + 30 * 60_000,
      }))
      .sort((a, b) => a.s - b.s);

    const slots: { start_at: string; end_at: string; label: string }[] = [];
    const stepMs = 30 * 60_000;
    const durMs = data.durationMinutes * 60_000;
    const cursor = new Date(now);
    cursor.setMinutes(cursor.getMinutes() + (30 - (cursor.getMinutes() % 30)));
    cursor.setSeconds(0, 0);

    while (cursor < horizon && slots.length < data.count) {
      const day = cursor.getDay();
      const hour = cursor.getHours();
      if (day === 0 || day === 6 || hour < whStart || hour + data.durationMinutes / 60 > whEnd) {
        cursor.setTime(cursor.getTime() + stepMs);
        continue;
      }
      const s = cursor.getTime();
      const e = s + durMs;
      const conflict = busy.some((b) => b.s < e && b.e > s);
      if (!conflict) {
        slots.push({
          start_at: new Date(s).toISOString(),
          end_at: new Date(e).toISOString(),
          label: new Date(s).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        });
        cursor.setTime(e + 2 * 60 * 60_000); // skip ahead 2h between proposals
      } else {
        cursor.setTime(cursor.getTime() + stepMs);
      }
    }
    return { slots };
  });
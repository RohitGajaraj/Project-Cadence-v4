## Goal

Make `/calendar` feel like the user's calendar (not the developer's), and turn it into a real workspace for events — no jumping to Google/Outlook to manage things.

Three parts, each shippable on its own. **A** ships first (small UI). **B** is the per-user connect. **C** is the full month grid + CRUD.

---

## Part A — UI tweaks (ship first, single file)

Scope: `src/routes/_authenticated.calendar.tsx` only.

1. Rename the **Grid** toggle to **Calendar** (swap `LayoutGrid` icon → `CalIcon`). Internal value stays `"grid"` so localStorage key `cadence.calendar.view` is unchanged.
2. Add a muted one-liner under the subhead: *"Showing the next 14 days."*
3. List view: keep current feed but **clamp to `today → today + 14d`** and sort **ascending** (today at top). Fixes the current descending sort showing past items first.
4. Voice check: no em/en dashes, no AI-tell buzzwords.

---

## Part B — Per-user Google + Microsoft (Apple dropped per your call)

Drop the developer-account leak. Each user connects their own Google or Microsoft calendar via Lovable's per-user OAuth (popup + `web_message` flow). The connect CTA disappears once they're connected. Apple is **out** — no public API.

### B.1 — Files
- `src/integrations/lovable/appUserConnector.ts` + `appUserConnectorClient.ts` (verbatim from knowledge — server-only + client-safe split).
- `src/lib/calendarConnections.functions.ts`:
  - `startCalendarConnect({ provider, targetOrigin })` → `authorizeAppUserOAuth` with `response_mode: "web_message"`. `provider ∈ {google, microsoft}`.
  - `saveCalendarConnection({ provider, connectionId, accountEmail })` → upsert row.
  - `listMyCalendarConnections()` → array (drives UI gating).
  - `disconnectCalendar({ id })`.
- Update `src/lib/calendar.functions.ts`: `syncCalendar` reads the user's row and dispatches to a Google fetcher (existing) or a new Microsoft Graph fetcher (`/me/calendar/events?startDateTime=…&endDateTime=…`). The current workspace connector becomes a no-row fallback only.

### B.2 — Schema (one migration)

Table `public.user_calendar_connections` (`id`, `user_id`, `workspace_id`, `provider` enum `google|microsoft`, `connection_id`, `account_email`, `display_name`, `last_sync_at`, `created_at`). RLS scoped to `auth.uid()`; standard GRANTs.

### B.3 — UI

- `/calendar`: if no connection, render a single **Connect your calendar** panel with two buttons (Google, Microsoft). Hide once connected.
- `/settings`: show connected account(s) with **Disconnect**.

### B.4 — Required env

`GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` and `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID` (server-only). I'll request them via the secrets tool when we start Part B.

---

## Part C — Real calendar surface + full CRUD

This is the "don't leave the app" part. Two halves: the **month grid** and **inline event management**.

### C.1 — Calendar (month) view

Replace today's grouped-by-day grid with a true **month grid**:

- Header row: ◀ **November 2026** ▶ · Month/Year dropdowns · **Today** button.
- 6-row × 7-col grid (Sun…Sat or Mon…Sun based on locale), 30–35 day cells.
- Each cell: date number + up to 3 event chips (color-coded: Meeting vs Event), "+N more" if overflow.
- Click a day → side sheet listing that day's events.
- Click an event chip → event detail/edit sheet (see C.2).
- Respects the user's connected calendar (Part B). Until Part B ships, falls back to whatever sync currently returns.

Lib: build with plain Tailwind + `date-fns` (already in deps via shadcn `Calendar`). No new heavy calendar library.

### C.2 — Full event CRUD (in-app, no Google/Outlook hop)

Server (`calendar.functions.ts`):
- `createCalendarEvent` — already exists; route through per-user connection.
- `updateCalendarEvent({ id, summary?, start_at?, end_at?, location?, description?, attendees? })` — PATCH against Google `events.patch` or Graph `PATCH /me/events/{id}`.
- `deleteCalendarEvent({ id })` — DELETE against the provider, then remove the local `calendar_events` row.

UI:
- **Event detail sheet** (right-side `Sheet`) opens on chip click. Fields: title, date/time pickers (shadcn `Calendar` + time input), location, description, attendee chips (email list).
- Three actions: **Save**, **Delete** (typed-name confirm via `useConfirm`), **Cancel**.
- **New event** button: same sheet, empty state. Removes the AI-slot "Schedule with AI" flow from default (keep it behind a secondary "Suggest a slot" action inside the sheet).
- Optimistic updates via TanStack Query mutations; `invalidate ["calendar-events"]` on success.

### C.3 — Provider parity

| Action | Google | Microsoft |
|---|---|---|
| List events (14d / month) | ✅ existing | ✅ new (Graph) |
| Create event | ✅ existing | ✅ new |
| Update event | new | new |
| Delete event | new | new |
| Hangout/Teams link surfaced | ✅ | ✅ (`onlineMeeting.joinUrl`) |

---

## Build order

1. **Part A** — single edit, ship in this turn.
2. **Part B** — schema + connector files + connect UI. ~1 focused session. Requires the two client-id secrets.
3. **Part C** — month grid first (read-only), then CRUD sheet, then provider-parity for update/delete. ~1–2 sessions.

## Doc loop

Each part: update `docs/feature-backlog.md` (status + "How to use / verify"), append a one-liner to `plan.md` §4. Part B also gets `docs/decisions/per-user-calendar-oauth.md` (records why Apple is excluded). Part C updates `architecture/integrations.md` (Graph endpoints) and `architecture/data.md` (new connections table from B).

## Recommendation

Approve and I'll execute Part A now. After it's in, I'll start Part B (will pause to request the two client-id secrets), then Part C.
## Goal

Ship the full calendar feature set end-to-end **without** real Google/Microsoft Client IDs. Code reads `process.env.GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` / `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`; when unset, the Connect buttons surface a friendly "Connect setup pending — admin must add Client ID" toast instead of crashing. When the IDs land later, zero code changes — just add the two secrets.

This is feasible and is the right way to stage the work.

---

## Part B — Per-user Google + Microsoft connections

**Database** (one migration)
- New table `public.user_calendar_connections`: `id`, `user_id`, `workspace_id` (nullable), `provider` (`google|microsoft` enum), `connection_id` (the Lovable app-user `connectionId`), `account_email`, `display_name`, `created_at`, `updated_at`, `last_sync_at`.
- RLS: owner-only (`auth.uid() = user_id`) for all ops. GRANTs for `authenticated` + `service_role`. Unique `(user_id, provider, account_email)` so the same Google account can't be added twice.

**Server-only helpers** (`src/integrations/lovable/appUserConnector.ts` + client `appUserConnectorClient.ts`)
- Drop in the canonical files from the `tanstack-app-user-connector` knowledge card. Server file reads `LOVABLE_API_KEY`; client file is secret-free.

**Server functions** (`src/lib/calendar-connections.functions.ts`)
- `startCalendarConnect({ provider, targetOrigin })` → calls `authorizeAppUserOAuth` with `response_mode: "web_message"`. If the matching client-ID env var is missing, throw a clean error: `"Connect setup pending — admin must configure provider credentials."` (UI shows toast.)
- `saveCalendarConnection({ provider, connectionId })` → after popup resolves, fetch the user's profile from Google/Microsoft via `callAsAppUser` to get `account_email` + `display_name`, then upsert the row.
- `listMyCalendarConnections()` → for the connect modal + header chips.
- `disconnectCalendar({ id })` → soft delete row (we keep `user_calendar_events` for history; sync just stops).

**Sync dispatch** (`src/lib/calendar.functions.ts`)
- Update existing `syncCalendar` to:
  1. Read the user's row in `user_calendar_connections`.
  2. If `google` → call `${gateway}/google_calendar/calendar/v3/calendars/primary/events?timeMin=…&timeMax=…` via `callAsAppUser`.
  3. If `microsoft` → call `${gateway}/microsoft/v1.0/me/calendarView?startDateTime=…&endDateTime=…` via `callAsAppUser`.
  4. Normalize into `user_calendar_events` (already exists) with `provider_event_id` for idempotency.
- Fallback to existing workspace connector if no per-user connection (back-compat).

**UI** (`src/routes/_authenticated.calendar.tsx`)
- First-time empty state already exists. Replace the single "Connect Google" CTA with two buttons: "Connect Google Calendar" + "Connect Microsoft Outlook" (Apple dropped per prior decision).
- After connection, hide the provider chooser; show a small "Connected: name@gmail.com · Disconnect" row in the header. Multiple accounts supported (stack chips).
- Existing 14-day list, view-toggle, and "Showing the next 14 days" hint stay.

---

## Part C — Month grid + inline CRUD

**Grid view** (`src/routes/_authenticated.calendar.tsx`)
- When user toggles to Grid: render a 30-day month grid (replace today's 14-day clamp for this view only). Month/year picker in header (`<<` `<` Month Year `>` `>>`).
- Cells show event chips (max 3 + "+N more"); click cell → opens day drawer; click chip → opens event editor.
- List view stays default and keeps its 14-day window.

**Inline CRUD** (`src/lib/calendar.functions.ts` + new dialog component)
- `createCalendarEvent({ provider, connectionId, title, start, end, description, attendees? })`
- `updateCalendarEvent({ provider, connectionId, providerEventId, …patch })`
- `deleteCalendarEvent({ provider, connectionId, providerEventId })`
- All three call the matching Google/Microsoft Graph endpoint via `callAsAppUser`, then refresh `user_calendar_events`. After each mutation, invalidate the `["calendar", userId]` query.
- New `EventDialog` component (shadcn `Dialog` + form): title, start/end (datetime), description, calendar account picker (when user has multiple connections).

---

## Documentation — the "come back later" item

In the same commit:
1. **`docs/feature-backlog.md`** Live status board: mark F-Calendar Parts B+C as **Shipped with provider-credentials pending**.
2. **New file `docs/decisions/calendar-oauth-credentials.md`** — captures: what's missing (the two Client IDs), why we stubbed, exact env var names, where to paste them, exact steps to create them in Google Cloud Console + Entra (redirect URI: `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`, scopes: Calendar full read/write).
3. **`plan.md` §4** — one-line log entry: "Calendar Parts B+C shipped, awaiting Google + Microsoft Client IDs (see decision doc)."
4. **`architecture/integrations.md`** — short subsection on the per-user calendar OAuth flow and the credential dependency.
5. **`active-task.md`** — replace with a single open item: "Add `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` + `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID` secrets to unlock per-user calendar connect" (so the next session immediately sees it).

---

## What works the moment this ships
- Schema, helpers, sync dispatcher, full UI (list + grid + create/edit/delete dialogs), connection management — all live.
- Clicking Connect with missing credentials shows: *"Connect setup pending. Add provider credentials in backend secrets."*

## What unlocks when you add the two secrets later
- Connect buttons start the real OAuth popup.
- No code changes needed.

---

## Out of scope (confirming)
- Apple Calendar (dropped earlier).
- Recurring-event editing (Google/Microsoft series semantics differ; tackle in a follow-up if needed).
- Calendar sharing / free-busy across workspace members.

Approve and I'll build it.
## Why

Pinned left rail today carries six items: **Today · Briefing · Approvals · Calendar · Meetings · Chat**. Two don't earn their pin:
- **Calendar** and **Meetings** serve one mental model — "what's on my time, and what came out of it." Splitting them forces tab-dancing.
- **Briefing** is workspace operating context: set once, edited rarely, read by agents — a settings artifact wearing a top-level coat.

Goal: fewer pins, each earning its place, no functionality lost.

## 1. Merge `/calendar` + `/meetings` → single `/calendar` surface

One route, one mental model, two modes:

```text
/calendar
├─ List view (DEFAULT) — chronological meetings list
│   = today's /meetings table, with calendar events folded in by date
└─ Grid view (one-click toggle) — time grid (day/week)
    = today's /calendar day grouping
Both modes: click an item → side sheet with transcript,
summary, action items, Extract-to-tasks (existing meeting flow).
```

- **Default = list** (per your call — capture/extract is where the value is).
- View toggle persists per-user in `localStorage` (`cadence.calendar.view`).
- `/meetings` and `/meetings/$id` become **redirects** to `/calendar` and `/calendar?meeting=$id` — bookmarks preserved.
- Reuses existing server fns unchanged: `listCalendarEvents`, `syncCalendar`, `createCalendarEvent`, `proposeSlots`, `listMeetings`, `getMeeting`, `saveTranscript`, `extractMeeting`, `createMeeting`, `deleteMeeting`. **Zero data-layer changes.**
- Meeting detail moves from a dedicated route to a `Sheet` over the calendar.
- Pin label: **Calendar**, icon `Calendar`. Drop the **Meetings** pin.

## 2. Move `/briefing` → inline in workspace settings

- Briefing editor lives at **Settings → Workspace → Strategic brief** (inline section), reusing `getActiveBrief` / `upsertBrief` unchanged.
- `/briefing` route becomes a redirect to `/settings?tab=workspace&section=brief`.
- Removed from pinned rail.
- Discoverability hook: small "Edit brief" link in the Today page header (where agents quote the brief), so first-time users don't hunt.

Matches existing inline-management convention (`docs/conventions/inline-management.md`): workspace-scoped settings live next to the workspace.

## 3. Pinned rail after cleanup

```text
Today
Approvals     (governance shortcut — daily, stays)
Calendar      (merged: schedule + meetings + extraction)
Chat
```

Four pins instead of six. Grouped sections (Discover, Deliver, Agents, Outcome, Run, Govern) unchanged.

## 4. Add the "Pin test" rule (so the rail doesn't bloat again)

Append to `docs/conventions/inline-management.md`:

> **Pin test.** A top-level nav item must be (a) used most days, (b) the entry point for an active workflow, and (c) not derivable from another pinned surface. If it fails any test, it lives inside a group, inside a parent surface, or in settings.

## Implementation steps

1. **New `/calendar`** — rewrite `_authenticated.calendar.tsx` as a two-mode surface:
   - Header: title + view toggle (`List` / `Grid`) + Sync / New event buttons (existing).
   - List mode: merged feed of meetings + calendar events, grouped by day.
   - Grid mode: lift today's calendar day grouping unchanged.
   - Side `Sheet` for meeting detail (lift body of `_authenticated.meetings.$id.tsx`).
   - URL param `?meeting=<id>` opens the sheet on load (deep-link).
2. **Redirects:**
   - `_authenticated.meetings.tsx` → `beforeLoad: redirect({ to: "/calendar" })`.
   - `_authenticated.meetings.$id.tsx` → `beforeLoad: redirect({ to: "/calendar", search: { meeting: id } })`.
   - `_authenticated.briefing.tsx` → `beforeLoad: redirect({ to: "/settings", search: { tab: "workspace", section: "brief" } })`.
3. **Settings page** (`_authenticated.settings.tsx`) — add Workspace tab if missing, add "Strategic brief" section using existing `getActiveBrief`/`upsertBrief` (lift the form body from current briefing page).
4. **AppShell** (`src/components/cadence/AppShell.tsx`) — drop `/briefing` and `/meetings` from `PINNED` array.
5. **Today page** — add small "Edit brief" link near the brief quote.
6. **Command palette** — drop separate "Meetings" / "Briefing" entries (or repoint Briefing → Settings, Meetings → Calendar).
7. **Pin test rule** — append to `docs/conventions/inline-management.md`.

## Out of scope

- No data model or server-fn changes.
- No changes to Discover/Deliver/Agents/Outcome/Run/Govern groups.
- No new design tokens, no icon-chip tone changes.

## Verification

- `/meetings`, `/meetings/$id`, `/briefing` redirect cleanly.
- `/calendar` opens in list mode; toggle switches to grid; choice persists on reload.
- List shows same meetings as old `/meetings` plus calendar events.
- Click a meeting row → side sheet opens with transcript editor, Extract, commit-to-tasks.
- `/calendar?meeting=<id>` deep-links open the sheet.
- Settings → Workspace shows brief editor; save round-trips to `upsertBrief` and the next agent run quotes the new brief.
- Left rail shows 4 pinned items: Today · Approvals · Calendar · Chat.

## Docs closed in the same commit

- `docs/feature-backlog.md` — add `F-IA-CALENDAR-MERGE` + `F-IA-BRIEFING-SETTINGS`, flip status, update Live status board + Recent log + Last updated, add "How to use / verify" blocks.
- `plan.md` §4 — one-liner WHY per change.
- `architecture/frontend.md` — update pinned-rail list + redirect map + note the `Sheet`-over-calendar pattern.
- `docs/conventions/inline-management.md` — add Pin test rule + Briefing-in-settings row to the table.

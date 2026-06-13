# Convention: Inline workspace & product management

**Rule.** Any "manage X" affordance lives next to X (dropdown, popover) or in a sheet over the current page. Never a dedicated route just to rename, switch, or delete.

**Current implementation.**

| Surface                   | Where                                                                   | Actions                                                                               |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Workspace switcher        | `AppShell` top-left popover                                             | Switch · Rename · Workspace settings · Leave · Delete (typed-name) · Create workspace |
| Product rows              | Sidebar, `MoreHorizontal` dropdown per row                              | Set active · Rename · Delete (typed-name)                                             |
| Workspace Strategic brief | `Settings` → inline section (deep-linked via `/settings?section=brief`) | Edit + Save; reused by every agent mission (no separate page)                         |

**Server functions.**

- [`src/lib/workspaces.functions.ts`](../../src/lib/workspaces.functions.ts) — `renameWorkspace`, `deleteWorkspace`, `leaveWorkspace`, `listWorkspaceMembers`, `removeWorkspaceMember`.
- [`src/lib/projects.functions.ts`](../../src/lib/projects.functions.ts) — `updateProject`, `deleteProject`.

All `requireSupabaseAuth`; owner-gated via RLS on `workspaces` / `workspace_members` / `projects`. Owner cannot leave their own workspace (server-side guard, surfaced as a toast).

**Invalidation.** After a mutation, call `queryClient.invalidateQueries({ queryKey: [...] })`. Never `window.location.reload()` or hard navigations — switching workspace must not blank the screen.

**Destructive flows.** Delete workspace + delete product use `typedConfirm: <name>` — see [`./destructive-actions.md`](./destructive-actions.md).

**Why.** Operators were being kicked into `/settings` for every rename. First-impression failure flagged in the v3 audit on 2026-06-06. Inline beats settings-route by default.

## Pin test (applies to the sidebar's pinned workspace rail)

A top-level (pinned) nav item must pass **all three** tests:

1. **Daily use.** The operator opens it most days.
2. **Active workflow entry.** It's where you go to _do_ work, not to set context.
3. **Not derivable from another pinned surface.** It can't be reached one click from something already pinned.

If it fails any test, it lives **inside a group**, **inside a parent surface** (tab / sheet / inline section), or in **Settings**. The pinned rail is for verbs, not for context.

**Reference applications.**

- **Calendar + Meetings → one `Calendar` pin** (`F-IA-CALENDAR-MERGE`, 2026-06-06). One mental model — "what's on my time, and what came out of it" — split across two pins forced tab-dancing. Meetings now open as a side `Sheet` over the calendar surface.
- **Briefing → Settings** (`F-IA-BRIEFING-SETTINGS`, 2026-06-06). The strategic brief is set once, edited rarely, and read by agents — not by you. It lives as an inline section in Settings, deep-linked from a small "Edit brief" affordance near where agents quote it.

## Related

- [`../../architecture/frontend.md`](../../architecture/frontend.md) — "Inline workspace & product management" contract.
- [`../../architecture/security.md`](../../architecture/security.md) — owner gating on workspace/product mutation server fns.
- [`./ui-chrome.md`](./ui-chrome.md) · [`./destructive-actions.md`](./destructive-actions.md) — primitives used.
- [`../strategy/archive/v3-audit-language-voice-2026-06-06.md`](../strategy/archive/v3-audit-language-voice-2026-06-06.md) §5 — the inline-management spec.

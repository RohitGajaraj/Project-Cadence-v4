# Convention: Inline workspace & product management

**Rule.** Any "manage X" affordance lives next to X (dropdown, popover) or in a sheet over the current page. Never a dedicated route just to rename, switch, or delete.

**Current implementation.**

| Surface | Where | Actions |
|---|---|---|
| Workspace switcher | `AppShell` top-left popover | Switch · Rename · Workspace settings · Leave · Delete (typed-name) · Create workspace |
| Product rows | Sidebar, `MoreHorizontal` dropdown per row | Set active · Rename · Delete (typed-name) |

**Server functions.**

- [`src/lib/workspaces.functions.ts`](../../src/lib/workspaces.functions.ts) — `renameWorkspace`, `deleteWorkspace`, `leaveWorkspace`, `listWorkspaceMembers`, `removeWorkspaceMember`.
- [`src/lib/projects.functions.ts`](../../src/lib/projects.functions.ts) — `updateProject`, `deleteProject`.

All `requireSupabaseAuth`; owner-gated via RLS on `workspaces` / `workspace_members` / `projects`. Owner cannot leave their own workspace (server-side guard, surfaced as a toast).

**Invalidation.** After a mutation, call `queryClient.invalidateQueries({ queryKey: [...] })`. Never `window.location.reload()` or hard navigations — switching workspace must not blank the screen.

**Destructive flows.** Delete workspace + delete product use `typedConfirm: <name>` — see [`./destructive-actions.md`](./destructive-actions.md).

**Why.** Operators were being kicked into `/settings` for every rename. First-impression failure flagged in the v3 audit on 2026-06-06. Inline beats settings-route by default.

## Related

- [`../../architecture/frontend.md`](../../architecture/frontend.md) — "Inline workspace & product management" contract.
- [`../../architecture/security.md`](../../architecture/security.md) — owner gating on workspace/product mutation server fns.
- [`./ui-chrome.md`](./ui-chrome.md) · [`./destructive-actions.md`](./destructive-actions.md) — primitives used.
- [`../strategy/v3-audit-language-voice-2026-06-06.md`](../strategy/v3-audit-language-voice-2026-06-06.md) §5 — the inline-management spec.
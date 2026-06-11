# architecture/frontend.md — Frontend patterns contract

> TanStack Start patterns. Rules: [`AGENTS.md`](../AGENTS.md). UI/visual contract: [`design.md`](../design.md). Data: [`data.md`](./data.md).

## Stack

TanStack Start v1 (React 19 + Vite 7) on Cloudflare Workers (`nodejs_compat`), TailwindCSS v4, shadcn/ui (Radix), Framer Motion, Tiptap, Lucide. Canonical runtime: Bun.

## Server boundary

- **App logic = `createServerFn` (RPC).** Type-safe, plain function calls.
- **Cron-poked endpoints = `/api/public/hooks/*`** server routes (anon-key auth), poked by `pg_cron`.
- **SSE endpoints** for streaming (`api/chat.ts`, `api/studio-chat.ts`). SSE over WebSockets because Workers stream SSE natively and we never need client→server mid-stream; reconnect uses `Last-Event-ID`.
- Service-role Supabase client is server-only (see [`data.md`](./data.md)).

## Data fetching — the one pattern

**Loader + Suspense, never `useEffect + fetch`** for initial render.

```
loader: context.queryClient.ensureQueryData(queryOptions)
component: useSuspenseQuery(queryOptions)
```

Mutations are optimistic where it helps (chat send, task toggle, decision approve). Streaming state belongs in the route loader + Suspense, not a hidden `useEffect`.

## Route boundaries — on every route

- `errorComponent` with a retry that calls both `router.invalidate()` and `reset()`.
- `notFoundComponent`.
- Root-level `defaultErrorComponent`.
  Stack traces never leak to the UI. Long operations link to `/traces/$traceId` instead of inlining raw errors.

## State persistence

`localStorage` for UI state only (active workspace/project, sidebar open/closed under `cadence.nav.open`). Never business data.

## Components

shadcn/ui primitives; bespoke in `src/components/cadence/`. The shared AI-message component renders the full [AI message contract](../design.md) — no surface invents its own. Tokens only, never hex (see [`design.md`](../design.md)).

## Realtime & streaming

Supabase Realtime on `agent_runs` (cockpit feed); SSE on chat/studio; trace waterfalls update live. Streaming text uses a CSS cursor, not Framer (high-frequency Framer animation janks).

## Keyboard-first

⌘K command palette (`cmdk`) resolves every destination, create action, and recent artifact. Every interactive surface has a keyboard equivalent.

## Invariants

- No `useEffect+fetch` for initial render.
- No service-role import in client code.
- Every route has error + not-found boundaries.
- App logic is a server fn; cron is a public hook — do not blur the two.

## Observe surface (Run group)

`/observe` is one page with three tabs (Analytics · Traces · Drift). Tab state is a URL search param (`?tab=analytics|traces|drift`) declared by `validateSearch`; Traces and Drift labels carry live count badges. The three legacy routes — `/analytics`, `/traces` (index only), and `/drift` — are reduced to `throw redirect({ to: "/observe", search: { tab: ... } })` so bookmarks survive. `/traces/$traceId` is preserved untouched and is the deep-link target from the Traces tab. Panel JSX lives in `src/components/observe/{Analytics,Traces,Drift}Panel.tsx`; the route file is a thin AppShell + tabs shell. The sidebar group is `Run` (Observe · Evals) — Evals stays separate because authoring ≠ observation.

## Governance surface (Govern group)

`/governance` follows the same tabs pattern as `/observe`. One page, four tabs: Controls (kill switch · mission caps · stuck approvals · reactor) · Approvals (tool-call queue) · Guardrails (content rules) · Budgets (spend caps). Tab state is `?tab=controls|approvals|guardrails|budgets` via `validateSearch`, default `controls`. Panel JSX lives in `src/components/governance/{Approvals,Guardrails,Budgets}Panel.tsx`; the Controls panel stays inline in the route file because it depends on the same `getGovernanceOverview` + reactor server fns. Legacy routes `/inbox`, `/guardrails`, `/budgets` are `beforeLoad`-redirects to the matching tab. Sidebar workspace rail's "Approvals" deep-links to `/governance?tab=approvals` — `NavRow` forwards a per-item `search` prop to `<Link>`, and `AppShell.isItemActive` checks the current `search.tab` so a path can host multiple correctly-highlighted nav entries. Govern group ships with two items only: Governance, Integrations.

## Pinned workspace rail

The pinned (always-visible) rail in `AppShell` holds **two** items only: **Today · Chat** — the surfaces touched every minute. The Pin test (see [`../docs/conventions/inline-management.md`](../docs/conventions/inline-management.md#pin-test-applies-to-the-sidebars-pinned-workspace-rail)) governs what earns a pin. Missions still ships, but inside the **Agents** group (not pinned). Approvals is reached one hop via Govern (`/govern?tab=approvals`). Calendar is the **default tab of `/knowledge`** — see the Knowledge section below — so the swarm has one substrate (events + memory + decisions + docs) to pull threads from. There is **no** floating quick-access dock. Everything else lives inside a collapsible group, inside a parent surface (tab / sheet / inline section), or in Settings.

## Global ambient bar

`src/components/cadence/AmbientChip.tsx` renders once in `_authenticated.tsx`, above the routed page outlet, as a slim sticky strip so content flows below it instead of being covered. It shows local time, location, and current weather on every authenticated screen. Weather loading is progressive: browser geolocation first, network-derived location second, timezone-derived city last, then Open-Meteo weather. The weather pill uses semantic utilities from `src/styles.css` (`.ambient-weather--sunny`, `--rain`, `--snow`, etc.) so the temperature/icon stays visible across themes without hardcoded component colors. Cache is UI-only localStorage (`cadence.ambient.v3`) and stores only the last place/weather payload.

## Knowledge surface (Memory + Decisions + Docs + Calendar)

`/knowledge` is the consolidated knowledge surface. One page, four tabs: **Calendar** (default — events + meeting transcripts in one feed) · **Memory** (what the swarm has learned, stub in Phase 1d) · **Decisions** (workspace decisions log, stub in Phase 1d; capture wiring is `F-DECISIONS-CAPTURE`) · **Docs** (workspace pages, Notion / Google Docs import). Tab state via `validateSearch` (`?tab=calendar|memory|decisions|docs`), default `calendar`. The Calendar panel preserves the meeting deep-link sheet via a sibling `?meeting=<id>` search param that the route forwards as a prop to `CalendarPanel`. Panel JSX lives in `src/components/knowledge/{Calendar,Memory,Decisions,Docs}Panel.tsx`. Calendar reuses `listCalendarEvents`, `listMeetings`, `syncCalendar`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`, `proposeSlots`, and the per-user connect server fns unchanged. Legacy routes `/calendar`, `/docs`, `/meetings`, `/meetings/$id` are `beforeLoad`-redirects into the matching tab.

## Learn surface (Outcomes + Support + Learnings)

`/learn` closes the loop between what shipped, what came back, and what to do next. Three tabs: **Outcomes** (Growth-agent drafts queued behind approval — changelogs, announcements, Slack posts) · **Support** (inbound from connected channels, triaged back into Product → Signals) · **Learnings** (re-scored opportunities and outcome memos). Tab state via `validateSearch` (`?tab=outcomes|support|learnings`), default `outcomes`. Panel JSX lives in `src/components/learn/{Outcomes,Support,Learnings}Panel.tsx`; all three read from the existing `getOutcomeData` server fn — Releases moved to `/product/releases` in Phase 1c, so it is not a Learn tab. Legacy route `/outcome` is a `beforeLoad`-redirect to `/learn?tab=outcomes`.

## Strategic brief (inline in Settings)

The workspace's strategic brief — read by every agent mission — is **not** a top-level route. It lives as an inline section in `/settings`, deep-linked via `/settings?section=brief` (validated via `validateSearch`; the section scrolls into view and ring-highlights when the param is present). Reuses `getActiveBrief` / `upsertBrief` unchanged. Legacy `/briefing` is a `beforeLoad`-redirect to `/settings?section=brief`. This follows the inline-management convention: workspace-scoped settings live next to the workspace.

## Confirmation, toasts & dialogs

Canonical rule: [`../docs/conventions/ui-chrome.md`](../docs/conventions/ui-chrome.md). This section is the contract restatement.

No native browser chrome. `window.alert`, `window.confirm`, `window.prompt`, `window.open`, and `window.onbeforeunload` are banned in `src/**` and fail ESLint (`no-restricted-globals` + `no-restricted-syntax` in `eslint.config.js`). The single allow-listed exception is `src/lib/error-page.ts` (pre-bootstrap fallback only).

Use instead:

- **Confirm / typed-name confirm** — `useConfirm()` from [`src/hooks/use-confirm.tsx`](../src/hooks/use-confirm.tsx). Promise-based, themed shadcn `AlertDialog`, focus-trapped. Pass `destructive: true` for delete flows, `typedConfirm: name` for irreversible ones.
- **One-field prompt** — `usePrompt()` from the same module. For richer inputs build a proper shadcn `Dialog`.
- **Non-blocking feedback** — `toast.success` / `toast.error` from `sonner`. Never use toasts for errors that require attention (use an inline `Alert` instead — see [`design.md`](../design.md) anti-patterns).
- **Unsaved-changes guards** — TanStack Router `useBlocker` wired to `useConfirm`.

`ConfirmProvider` is mounted once in `src/routes/__root.tsx` inside `ThemeProvider`. Voice rules for the strings these primitives render live in [`../design.md`](../design.md) and the audit at [`../docs/strategy/v3-audit-language-voice-2026-06-06.md`](../docs/strategy/v3-audit-language-voice-2026-06-06.md).

## Inline workspace & product management

Canonical rule: [`../docs/conventions/inline-management.md`](../docs/conventions/inline-management.md). This section is the contract restatement.

Operators never leave the current surface to administer a workspace or product. The `AppShell` top-left switcher is a popover, not a route.

- **Switcher actions:** Switch · Rename · Workspace settings · Leave · Delete. All inline.
- **Product row actions:** `MoreHorizontal` dropdown next to each product row — Set active · Rename · Delete. No bare destructive icons.
- **Destructive flows:** typed-name match (`typedConfirm`) for delete workspace + delete product.
- **Server functions:** [`src/lib/workspaces.functions.ts`](../src/lib/workspaces.functions.ts) (`renameWorkspace`, `deleteWorkspace`, `leaveWorkspace`, `listWorkspaceMembers`, `removeWorkspaceMember`) and `updateProject` in [`src/lib/projects.functions.ts`](../src/lib/projects.functions.ts). All `requireSupabaseAuth`; owner-gated via RLS. Owner cannot leave their own workspace (server-side guard, surfaced as a toast).
- **Invalidation:** mutate → `queryClient.invalidateQueries({ queryKey: [...] })`. Never `window.location.reload()` or hard navigations — switching workspace must not blank the screen.

Rule: any "manage X" affordance lives next to X or in a sheet over the current page, never on a separate route.

Frontend pattern change → update this file (see [`AGENTS.md`](../AGENTS.md), section 5).

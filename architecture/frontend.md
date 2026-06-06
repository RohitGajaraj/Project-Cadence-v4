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

## Confirmation, toasts & dialogs
No native browser chrome. `window.alert`, `window.confirm`, `window.prompt`, `window.open`, and `window.onbeforeunload` are banned in `src/**` and fail ESLint (`no-restricted-globals` + `no-restricted-syntax` in `eslint.config.js`). The single allow-listed exception is `src/lib/error-page.ts` (pre-bootstrap fallback only).

Use instead:
- **Confirm / typed-name confirm** — `useConfirm()` from [`src/hooks/use-confirm.tsx`](../src/hooks/use-confirm.tsx). Promise-based, themed shadcn `AlertDialog`, focus-trapped. Pass `destructive: true` for delete flows, `typedConfirm: name` for irreversible ones.
- **One-field prompt** — `usePrompt()` from the same module. For richer inputs build a proper shadcn `Dialog`.
- **Non-blocking feedback** — `toast.success` / `toast.error` from `sonner`. Never use toasts for errors that require attention (use an inline `Alert` instead — see [`design.md`](../design.md) anti-patterns).
- **Unsaved-changes guards** — TanStack Router `useBlocker` wired to `useConfirm`.

`ConfirmProvider` is mounted once in `src/routes/__root.tsx` inside `ThemeProvider`. Voice rules for the strings these primitives render live in [`../design.md`](../design.md) and the audit at [`../docs/strategy/v3-audit-language-voice-2026-06-06.md`](../docs/strategy/v3-audit-language-voice-2026-06-06.md).

## Inline workspace & product management
Operators never leave the current surface to administer a workspace or product. The `AppShell` top-left switcher is a popover, not a route.

- **Switcher actions:** Switch · Rename · Workspace settings · Leave · Delete. All inline.
- **Product row actions:** `MoreHorizontal` dropdown next to each product row — Set active · Rename · Delete. No bare destructive icons.
- **Destructive flows:** typed-name match (`typedConfirm`) for delete workspace + delete product.
- **Server functions:** [`src/lib/workspaces.functions.ts`](../src/lib/workspaces.functions.ts) (`renameWorkspace`, `deleteWorkspace`, `leaveWorkspace`, `listWorkspaceMembers`, `removeWorkspaceMember`) and `updateProject` in [`src/lib/projects.functions.ts`](../src/lib/projects.functions.ts). All `requireSupabaseAuth`; owner-gated via RLS. Owner cannot leave their own workspace (server-side guard, surfaced as a toast).
- **Invalidation:** mutate → `queryClient.invalidateQueries({ queryKey: [...] })`. Never `window.location.reload()` or hard navigations — switching workspace must not blank the screen.

Rule: any "manage X" affordance lives next to X or in a sheet over the current page, never on a separate route.

Frontend pattern change → update this file (see [`AGENTS.md`](../AGENTS.md), section 5).

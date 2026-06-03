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

Frontend pattern change → update this file (see [`AGENTS.md`](../AGENTS.md), section 5).

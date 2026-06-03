---
name: cadence-feature-pair
description: Use when adding or extending a feature surface in Project-Cadence. Enforces the repo's two-files-in-lockstep convention — server logic in src/lib/<domain>.functions.ts, consumed in src/routes/_authenticated.<domain>.tsx via TanStack Query — and the closed documentation loop.
---

# Adding a feature in Project-Cadence (the two-files-in-lockstep pattern)

A feature here is **never** one file. It is a server module + a route that consumes it,
built together. Inventing a new data-flow shape is a smell — mirror an existing pair.

## Checklist

1. **Find the closest existing pair and copy its shape.** e.g. `prds` ↔
   `discovery.functions.ts` / `lineage.functions.ts`. Match its query-key and mutation style.
2. **Server logic → `src/lib/<domain>.functions.ts`** as TanStack server functions.
   AI/RAG code goes under `src/lib/ai` or `src/lib/rag`, not inline.
3. **Consume it → `src/routes/_authenticated.<domain>.tsx`** via TanStack Query
   (`useQuery` / `useMutation` with stable `queryKey`s). `_authenticated.*` = gated app shell.
4. **DB changes → `supabase/migrations/`** as timestamped, RLS-aware SQL. Migration safety
   is hook-enforced (see `hooks.md`). Respect the tenancy keys (see
   `docs/decisions/tenancy-retrofit.md`).
5. **Never hand-edit** `src/routes/routeTree.gen.ts` (generated) or applied migration SQL.
6. **Verify visually.** `bun run dev` and check the surface in the browser —
   type-checking is not feature-checking (AGENTS.md §3, architecture/frontend.md).
7. **Close the documentation loop.** Update the relevant doc + append to the build log in
   `plan.md` §4 in the *same* unit of work (AGENTS.md §5). A change isn't done until its
   docs are true.

## Gotchas

- Ignore the `*" 2"`-suffixed dirs (`src/components 2`, `src/integrations 2`) — empty
  case-insensitive-FS artifacts. Real code is in `src/components` / `src/integrations`.
- nango is an external integrations *service* (Nango Cloud / self-hosted), not in this repo — consume it via `@nangohq/*` SDK + `NANGO_*` env when wiring integrations.
- Bun is the runner (`bun install`, `bun run dev`), not npm. `package-lock.json` is not canonical.

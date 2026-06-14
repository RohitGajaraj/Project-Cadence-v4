# M-B · Compounding-memory view

> Status · Shipped 2026-06-14 · Route `/memory` · Source: the agent loop (no single owner agent)

## What it does

`/memory` is a read-only window onto `agent_memory`, the semantic store the agent loop both writes to and recalls from. It renders the recent rows the loop has learned: each one's kind (outcome, reflection, note), its content (the recall-friendly distillate), its source (the agent that wrote it, or "the loop" for outcomes the loop distilled across a run), its scope (global or a single agent), and when it was last recalled. A real-count summary strip leads with how many memories are stored, the per-kind split, how many agents have contributed, and when the loop last learned something. The point is that a user can watch the product get smarter with use: a memory the loop keeps recalling (a rising `last_used_at`) is the compounding proof.

## Why it exists

The loop already distils every recorded outcome into a global-scope `agent_memory` row (Phase 2 / W1, see [`loop-runs-itself.md`](./loop-runs-itself.md) and `plan.md` §4) and threads recalled memories across hops. The data was wired but had no dedicated surface, so the moat (the Decision-System's compounding memory) was real but invisible. This view makes it visible without claiming more than the data shows.

## Where to find it

Sidebar nav, "Loop" section, the "Memory" row (route `/memory`). It is a separate surface from Knowledge > Memory: that tab renders the `learnings` table (the human-recorded outcome audit, with verdict and ICE move), while `/memory` renders `agent_memory` (what the loop stored for itself to recall). The two are complementary, not duplicates.

## Demo script (≤ 90s)

1. Open the sidebar, "Loop" section, click "Memory".
2. Read the summary strip: "N stored", the per-kind counts, the source-agent count, and "last learned X ago" (every number is a real head count).
3. Scan the cards: point out a card that reads "recalled 2h ago" versus one that reads "not recalled yet". The recalled one is a memory the loop reached for again - the compounding signal.
4. Note the source line: outcomes read "from the loop" (they are distilled across a run, not authored by one agent); reflections read "from Scout" or whichever agent wrote them.
5. On a fresh account, show the honest empty state: "Nothing learned yet", with a plain explanation that memory fills in as the loop records outcomes and agents reflect on runs.

## How it works

- **Table:** `public.agent_memory` (columns: `scope`, `kind`, `content`, `agent_slug`, `importance`, `last_used_at`, `created_at`). Owner-scoped via RLS (`auth.uid() = user_id`); no `workspace_id` column, so the view is the account's whole institutional memory (the same scope as the Gauntlet metrics).
- **Server fn:** `getAgentMemory` in [`src/lib/memory.functions.ts`](../../src/lib/memory.functions.ts) reads the recent window (most recently recalled, then most recently created; default 60 rows) plus an all-time head count, and never ships the `embedding` vector or the `metadata` blob to the client. Missing-relation tolerant (degrades to the empty state if it ever reads ahead of a migration sync).
- **Pure logic:** [`src/lib/memory-view.ts`](../../src/lib/memory-view.ts) holds the DB-free distillation and labeling (`summarizeMemory`, `kindLabel`, `kindBlurb`, `scopeLabel`, `agentLabel`, `relativeTime`), unit-tested in [`src/lib/memory-view.test.ts`](../../src/lib/memory-view.test.ts) (15 cases).
- **Surface:** thin route [`src/routes/_authenticated.memory.tsx`](../../src/routes/_authenticated.memory.tsx) composing the app shell; `src/components/memory/{MemoryList,MemoryCard}.tsx` render the strip and cards via TanStack Query (`queryKey: ["agent-memory"]`).
- **Honesty:** `agent_slug` is null on loop-distilled outcomes (by design in `rememberOutcome`), so the source reads "the loop" rather than a fabricated agent name; never-recalled rows say "not recalled yet"; all counts are real.

## Governance & guardrails

- Read-only. No mutations, no migration (the table and its RLS already exist).
- RLS scopes every read to `auth.uid()`; the explicit `user_id` filter is defense-in-depth and lets Postgres use the `(user_id, agent_slug)` index.
- No AI call on this surface, so no budget or guardrail path is touched.

## Verification checklist

- `bun run build` green; the `/memory` route chunk is emitted and the route registers in `src/routeTree.gen.ts`.
- `bun test` green, including the 15 `memory-view` cases.
- On a seeded account, `/memory` renders real `agent_memory` rows with the summary strip; on a fresh account it shows the "Nothing learned yet" empty state.
- The source line reads "from the loop" for outcome rows and the agent slug for reflections.

## Known limits / out of scope

- Read-only by design: no editing, pinning, or deleting of memories here.
- The window is the most recent 60 rows; the strip shows the true all-time total and notes when it is showing a capped window. No search or per-kind filter yet.
- Measuring the moat (NDR, retention, Critic as a loop step) is the rest of milestone M-B and is tracked separately in [`../planning/v7-build-status.md`](../planning/v7-build-status.md).

## Related

- `plan.md` §4 (the build-log entry for this surface)
- [`loop-runs-itself.md`](./loop-runs-itself.md) and [`f-agent-2-memory-reflection.md`](./f-agent-2-memory-reflection.md) - how memory is written and recalled
- [`../planning/v7-build-status.md`](../planning/v7-build-status.md) - milestone M-B status
- Knowledge > Memory (the `learnings` audit feed) - the complementary human-facing view

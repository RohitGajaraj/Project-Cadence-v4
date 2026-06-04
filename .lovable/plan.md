## Diagnosis

You ran the agent, but the Traces page is empty because the **/agents page is wired to the wrong `runAgent`**.

Two server functions share the name `runAgent`:

1. `src/lib/agents.functions.ts` — **legacy single-shot path**. Calls `callModel` directly with no `traceId`, no tool loop, and **no brief injection**. This is what `_authenticated.agents.tsx` currently uses.
2. `src/lib/agent_loop.functions.ts` → `runAgentLoop` in `src/lib/ai/loop.server.ts` — the real path. Generates a `traceId`, loads `workspace_briefs`, calls `renderBriefBlock`, and stamps `trace_id` on every `ai_events` row.

Confirmed in the DB: your last two `agent_runs` succeeded, but the corresponding `ai_events` rows have `trace_id = NULL`. The Traces list filters `trace_id IS NOT NULL`, so they're invisible — and the brief never reached the system prompt either.

## Fix (one file, surgical)

Update `src/routes/_authenticated.agents.tsx`:

1. Change the import from `@/lib/agents.functions` to `@/lib/agent_loop.functions` for `runAgent` only (keep `listAgents`, `listAgentRuns`, `updateAgentSchedule` from the legacy module).
2. Update the mutation signature from `{ agentId, input, model }` to `{ agentSlug, goal, model }` — that's what `agent_loop.functions.ts` validates.
3. Update the two call sites (form submit + any other dispatch) to pass `agentSlug: selected.slug` and `goal: input.trim()`.
4. Adapt the result handling: the loop returns `{ trace_id, agent_slug, steps, final, run_id, ... }` instead of a single `run` row. Show `final` as the output and (nice-to-have) link to `/traces/$traceId` using `trace_id`.

## Verification

1. Open `/agents`, pick **Discovery Scout**, send a goal like "Top 3 opportunities for our current focus."
2. Open `/traces` — a new row appears with root surface `agent`.
3. Open the trace → first step's system prompt contains the `--- Workspace Strategic Brief ---` block from your brief.
4. Edit the brief on `/briefing`, re-run — the new trace's system prompt reflects the edit.

## Doc loop

- `docs/feature-backlog.md`: log "Wired /agents page to loop-based runAgent so brief + traces fire" under the Bundle 2 / C5 entry, bump Last updated.
- `plan.md` §4: one-liner with the WHY.
- `architecture/orchestration.md`: note that `/agents` UI now consumes `agent_loop.functions.ts` (legacy `agents.functions.ts → runAgent` left for back-compat but no longer the active path).

No DB migration, no new files. Single-route edit.

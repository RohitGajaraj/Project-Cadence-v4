# Decision — Durable runtime for long / parallel agent missions (FND-RUNTIME 0.9)

> _Created: 2026-06-03 · Last updated: 2026-06-11_

**Date:** 2026-06-03
**Status:** Accepted
**Scope:** Step 1 of the Agentic Proof Platform foundation. Enables Bundle #4 (A2A handoff) and #5 (Mission Graph) to survive Cloudflare Worker eviction mid-step.

## Context

Agent missions run inside `runAgentLoop` (`src/lib/ai/loop.server.ts`) on Cloudflare Workers. A Worker can be evicted between requests; today, if a mission spans multiple ticks (cron-driven progression, A2A handoff, long tool calls), in-memory loop state is lost and the mission silently stalls. The chokepoint already creates an `agent_runs` row, but there is no per-step persistence and no idempotency on cron-driven ticks.

Two approaches were considered:

1. **Cloudflare Queues + Durable Objects** — native Worker primitive. Adds a new runtime, new bindings, new auth model, new log surface, and ties us harder to the Cloudflare platform.
2. **DB-backed durable job table (Postgres)** — extend the existing `agent_runs` + `/api/public/hooks/*` + `pg_cron` pattern with checkpoint rows and idempotency keys.

## Decision

**Adopt approach (2): DB-backed durable job table in Postgres.**

Rationale:

- Matches existing patterns already in production (`/api/public/hooks/*` ticked by `pg_cron`, tenancy keys on every row, RLS as the backstop).
- Zero new infra, zero new runtime, zero new auth model — purely additive schema.
- Portable: the same checkpoint + idempotency design works on any Postgres host if we ever leave Cloudflare. No platform lock-in.
- Visible to the human governor — every checkpoint is a row that can be inspected, replayed, or rewound from the Traces / Mission Graph surfaces.
- The cost of a per-step `INSERT` is well below the cost of an AI call; we are already round-tripping to Postgres for tool_calls and ai_events on every step.

## Design

### Schema (added in the accompanying migration)

- `agent_runs.step_index INT NOT NULL DEFAULT 0` — last completed step.
- `agent_runs.last_checkpoint_at TIMESTAMPTZ` — heartbeat for stale-run detection.
- `agent_run_checkpoints` — append-only, one row per loop iteration:
  - `(run_id, step_index)` UNIQUE
  - `state JSONB` — full resume payload: `conv` messages, `approvals_queued`, `halted`, `tools_snapshot`, plus a `version` field so we can evolve the shape.
  - tenancy keys (`user_id`, `workspace_id`) on every row.
- `idempotency_keys` — `(scope, key)` UNIQUE, with `result JSONB` and `created_at`. Used by:
  - `/api/public/hooks/*` ticks (key = `tick:{hook}:{run_id}:{step_index}`)
  - Tool execution (key = `tool:{run_id}:{step_index}:{tool_name}`) so a resumed step never re-executes a side-effecting tool.

### Loop changes (next sub-step, separate commit)

1. At the **top** of each iteration in `runAgentLoop`, before the `callModel` call, write a checkpoint row with the current `conv` + counters. This is the resume point — if the Worker dies between this write and the next, we re-enter at the same step with the same context.
2. Add `resumeAgentLoop(runId)` — loads the latest checkpoint, rehydrates `conv`/`steps`/counters, and continues the loop. Called by `/api/public/hooks/resume-runs` (a cron-driven sweeper) and by the new approval-resume path.
3. Tool execution writes the idempotency key in the same transaction as the `tool_calls` insert; a repeated `(run_id, step_index, tool_name)` short-circuits to the cached result instead of re-calling the tool.
4. Backpressure: cap concurrent `running` runs per workspace (default 5). New mission requests over the cap are inserted with `status='queued'`; the sweeper promotes them.

### Why checkpoint _before_ the provider call (not after)

`runtime.server.ts` can throw `GovernanceHaltError` mid-stream (budget cap, kill switch). Checkpointing _after_ the call means a halt mid-stream loses the bill we already paid for; checkpointing _before_ lets us resume cleanly without double-charging. The chokepoint already tracks tokens/spend on the `agent_runs` row, so re-attempt cost accounting stays correct.

## Out of scope (deferred)

- Cloudflare Queues — revisit only if DB-backed throughput becomes the bottleneck.
- Cross-region replication of checkpoint state — single-region Postgres is fine for v1.
- Distributed tracing across resume boundaries — `trace_id` is already preserved on the run row; a deeper OpenTelemetry hook is a separate decision.

## Acceptance (mirrors `docs/foundation-audit.md` §0.9)

1. A mission killed mid-step resumes from the last checkpoint and completes with no duplicate tool calls.
2. A repeated cron tick for the same `(hook, run, step)` is a no-op at the DB layer.
3. Concurrent runs per workspace are bounded; over-cap missions queue instead of failing.
4. `agent_runs.status` lifecycle: `queued → running → (halted | completed | failed)`, with `step_index` and `last_checkpoint_at` advancing monotonically.

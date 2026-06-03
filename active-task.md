# Active task — FND-RUNTIME (0.9) · Durable runtime for long / parallel missions

> **Why this is next.** It's step 1 of the YC demo cut (foundation gap). Bundle #4 (A2A handoff E1–E5) and bundle #5 (Mission Graph E6) depend on missions surviving Cloudflare Worker eviction mid-step — without durable runtime, a multi-agent handoff that crosses a worker restart silently drops the mission. See `docs/feature-backlog.md` → §0.9 and the YC demo cut overlay.

**Tool currently driving:** _(unset — next session, set this when work starts; also flip the Live status board "Now building")_
**Branch:** `main`
**Owning bundle:** YC-cut #1 (Governed foundation)

## Goal

A mission that crosses a forced worker restart resumes from its last checkpoint and completes successfully, with no duplicate side effects on the resumed step.

## Sub-steps

- [ ] **Scope doc** — open `docs/foundation-audit.md` §0.9 and confirm/update the acceptance criteria; pick the queue/durable-job approach (Cloudflare Queues vs DB-backed job table) and record the decision in `docs/decisions/`.
- [ ] **Schema** — design `agent_run_checkpoints` (run_id, step_index, state JSONB, created_at) + tenancy keys; migration with GRANTs + RLS scoped by `user_id` + `workspace_id`.
- [ ] **Idempotency keys** — every tick (`/api/public/hooks/*` and orchestrator step) gets a deterministic key; duplicate ticks must be no-ops at the DB layer.
- [ ] **Checkpoint at each loop step** — extend `src/lib/ai/loop.server.ts` to persist state at the top of each iteration; on entry, resume from the last checkpoint if one exists.
- [ ] **Backpressure** — cap concurrent runs per workspace; queue rather than reject when over the cap.
- [ ] **Forced-restart test** — script that starts a mission, kills the worker mid-step, and asserts the mission completes via resume without duplicate tool calls.
- [ ] **Close the doc loop in the same commit** — flip 0.9 status in `docs/feature-backlog.md`, append to `plan.md` §4, add a "How to use / verify" block under §0.9, update `architecture/orchestration.md`, refresh Live status board "Last updated · Recent log".

## Gotchas

- The chokepoint (`src/lib/ai/runtime.server.ts`) already enforces governance halts via `GovernanceHaltError` — checkpoint **before** the provider call, not after, so a halt mid-stream doesn't get re-billed on resume.
- `pg_cron` ticks must remain idempotent; use the new keys, don't rely on `if exists` queries.
- Don't introduce a separate runtime — extend the existing TanStack server-function + `/api/public/hooks` pattern. No Edge Functions.
- Respect three-key tenancy (`user_id` + `workspace_id` + `product_id`) on every new row.

## Done criteria

1. Integration test: kill worker mid-mission → mission resumes and completes with no duplicate side effects.
2. `agent_runs` shows `status='completed'` with a coherent checkpoint history.
3. `docs/foundation-audit.md` §0.9 flipped 🟡 → ✅; backlog status board updated; `plan.md` §4 appended.
4. `active-task.md` deleted from repo root in the final commit.

## Handoff notes

_(Add a line when pausing: what's complete, what's mid-flight, where to resume.)_
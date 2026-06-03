# Active task — FND-RUNTIME (0.9) · Durable runtime for long / parallel missions

> **Why this is next.** It's step 1 of the YC demo cut (foundation gap). Bundle #4 (A2A handoff E1–E5) and bundle #5 (Mission Graph E6) depend on missions surviving Cloudflare Worker eviction mid-step — without durable runtime, a multi-agent handoff that crosses a worker restart silently drops the mission. See `docs/feature-backlog.md` → §0.9 and the YC demo cut overlay.

**Tool currently driving:** Lovable · branch `main`
**Branch:** `main`
**Owning bundle:** YC-cut #1 (Governed foundation)

## Goal

A mission that crosses a forced worker restart resumes from its last checkpoint and completes successfully, with no duplicate side effects on the resumed step.

## Sub-steps

- [x] **Decision doc** — DB-backed job table chosen over Cloudflare Queues. Written to `docs/decisions/durable-runtime.md` (rationale: matches existing `/api/public/hooks/*` + `pg_cron` + tenancy patterns; zero new infra; portable off Cloudflare).
- [x] **Schema** — `agent_run_checkpoints` (run_id, step_index, state JSONB, tenancy keys, UNIQUE on (run_id, step_index)) + `idempotency_keys` (scope, key, run_id, result JSONB, UNIQUE on (scope, key)) + extended `agent_runs` with `step_index` + `last_checkpoint_at`. Migration applied 2026-06-03 with GRANTs + RLS scoped by `user_id`.
- [x] **Request `GITHUB_TOKEN` + `GITHUB_REPO` secrets** — needed for Bundle 9 (Build) so the lifecycle work below can begin without a hard blocker. User saved both 2026-06-03.
- [ ] **Idempotency helper** — add `src/lib/runtime/idempotency.server.ts` with `withIdempotency(scope, key, fn)` that does `INSERT ... ON CONFLICT DO NOTHING RETURNING ...` then short-circuits to cached `result` on conflict. Used by `/api/public/hooks/*` ticks (key = `tick:{hook}:{run_id}:{step_index}`) and by tool execution (key = `tool:{run_id}:{step_index}:{tool_name}`).
- [ ] **Checkpoint at each loop step** — extend `src/lib/ai/loop.server.ts` to persist state at the top of each iteration; on entry, resume from the last checkpoint if one exists.
- [ ] **Resume entrypoint** — `resumeAgentLoop(runId)` server function that loads the latest checkpoint, rehydrates `conv`/`steps`/counters, and continues. Called by a new `/api/public/hooks/resume-runs` swept by `pg_cron` every minute.
- [ ] **Backpressure** — cap concurrent `running` runs per workspace (default 5). Over-cap missions insert as `status='queued'`; sweeper promotes them.
- [ ] **Forced-restart test** — script that starts a mission, kills the worker mid-step, and asserts the mission completes via resume without duplicate tool calls.
- [ ] **Close the doc loop in the same commit** — flip 0.9 status in `docs/feature-backlog.md`, append to `plan.md` §4, add a "How to use / verify" block under §0.9, update `architecture/orchestration.md`, refresh Live status board "Last updated · Recent log".

## Then immediately — first lifecycle stage end-to-end (Discover → Define → Plan with real GitHub Issue write)

Bundle 6 (Discover→Define→Plan) + the **N1 / "real repo write" half of Bundle 9** form the smallest slice that proves the end-to-end lifecycle on real data, on this repo. Sequencing on top of FND-RUNTIME 0.9:

- [ ] **N1 — `github.issue.create` agentic tool** — new entry in `src/lib/ai/tools/registry.server.ts`, category `write`, default mode `confirm`. Uses `GITHUB_TOKEN` + `GITHUB_REPO`; payload is `{title, body, labels[]}`; rate-limited; idempotency key = `github_issue:{prd_id}` so re-execution does not double-create.
- [ ] **Bundle 6 mission script** — Discovery scout ingests a Cadence-on-Cadence signal → Customer Insights clusters into theme → PRD Writer drafts a PRD into `prds` table → Strategist plans → Builder calls `github.issue.create` and writes the issue URL back onto the PRD. All steps via the loop, all approvals gated.
- [ ] **Verification** — operator runs the mission from `/_authenticated/agents` against a real Cadence backlog signal; approves the GitHub write; sees the real issue appear on the repo; PRD shows the issue URL; trace shows the full handoff.

## Gotchas

- The chokepoint (`src/lib/ai/runtime.server.ts`) already enforces governance halts via `GovernanceHaltError` — checkpoint **before** the provider call, not after, so a halt mid-stream doesn't get re-billed on resume.
- `pg_cron` ticks must remain idempotent; use the new keys, don't rely on `if exists` queries.
- Don't introduce a separate runtime — extend the existing TanStack server-function + `/api/public/hooks` pattern. No Edge Functions.
- Respect three-key tenancy (`user_id` + `workspace_id` + `product_id`) on every new row.
- `github.issue.create` must validate `GITHUB_REPO` matches an allow-list pattern (default: the Cadence repo only) so a prompt-injected agent cannot post issues onto a random repo. Service-role read of the secrets only inside the tool's `.handler()` — never client-side.

## Done criteria

1. Integration test: kill worker mid-mission → mission resumes and completes with no duplicate side effects.
2. `agent_runs` shows `status='completed'` with a coherent checkpoint history.
3. `docs/foundation-audit.md` §0.9 flipped 🟡 → ✅; backlog status board updated; `plan.md` §4 appended.
4. Discover→Define→Plan mission completes end-to-end against the Cadence repo: real signal in, real GitHub issue out, PRD links back to the issue.
5. `active-task.md` deleted from repo root in the final commit (only after both 0.9 + the lifecycle slice ship).

## Handoff notes

- **2026-06-03 · Lovable** — Foundation laid: decision doc written, schema migration applied (`agent_run_checkpoints`, `idempotency_keys`, `agent_runs.step_index`/`last_checkpoint_at`), `GITHUB_TOKEN` + `GITHUB_REPO` secrets requested and saved by user. Next concrete step: implement `withIdempotency` helper + checkpoint-on-iteration in `loop.server.ts`, then `resumeAgentLoop` + `/api/public/hooks/resume-runs`. Do **not** touch `loop.server.ts` without re-reading it first — it's 273 lines, governance-halt-aware, and the checkpoint write must go above the `callModel` call inside the `for (i...)` loop.
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
- [x] **Idempotency helper** — `src/lib/runtime/idempotency.server.ts` shipped; used by tool execution + available for `/api/public/hooks/*`.
- [x] **Checkpoint at each loop step** — `executeLoop()` upserts `agent_run_checkpoints` before every `callModel` and updates `agent_runs.step_index` / `last_checkpoint_at`.
- [x] **Resume entrypoint** — `resumeAgentLoop(runId)` exported; `/api/public/hooks/resume-runs` route created; `pg_cron` scheduled every minute.
- [x] **Backpressure** — over-cap missions insert as `status='queued'`; sweeper promotes them via `resumeAgentLoop`.
- [x] **N1 — `github.issue.create` tool** — registered, write+confirm, allow-listed to `GITHUB_REPO`, idempotent via caller-supplied key.
- [ ] **Forced-restart test** — script that starts a mission, kills the worker mid-step, and asserts the mission completes via resume without duplicate tool calls.
- [x] **Close the doc loop** — backlog Live status board + `plan.md` §4 updated 2026-06-03. "How to use / verify" block + `architecture/orchestration.md` refresh deferred until the lifecycle slice verifies end-to-end.

## Then immediately — first lifecycle stage end-to-end (Discover → Define → Plan with real GitHub Issue write)

Bundle 6 (Discover→Define→Plan) + the **N1 / "real repo write" half of Bundle 9** form the smallest slice that proves the end-to-end lifecycle on real data, on this repo. Sequencing on top of FND-RUNTIME 0.9:

- [x] **N1 — `github.issue.create` agentic tool** — shipped (see above).
- [x] **`prd.link_issue` tool** — write/confirm tool that sets `prds.github_issue_url`. Migration added the column; tool seeded into `agent_tools` for every existing user. Now Builder can chain `github.issue.create` → `prd.link_issue(prd_id, returned_url)`.
- [ ] **Bundle 6 mission run** — operator runs the existing Discovery → PRD Writer → Strategist → Builder mission against a real Cadence signal. The Builder agent must have `github.issue.create` + `prd.link_issue` enabled in its `agent_tools` (set via the Agents page). Builder's PRD should land in `prds`; Builder then calls `github.issue.create` with `idempotency_key = <prd_id>`, then `prd.link_issue` with the returned URL.
- [ ] **Verification** — operator runs the mission from `/_authenticated/agents`, approves the GitHub-write queued in `/_authenticated/governance`, confirms a real issue appears on the repo, and the trace at `/_authenticated/traces/{trace_id}` shows the full handoff.

## Gotchas

- The chokepoint (`src/lib/ai/runtime.server.ts`) already enforces governance halts via `GovernanceHaltError` — checkpoint **before** the provider call, not after, so a halt mid-stream doesn't get re-billed on resume.
- `pg_cron` ticks must remain idempotent; use the new keys, don't rely on `if exists` queries.
- Don't introduce a separate runtime — extend the existing TanStack server-function + `/api/public/hooks` pattern. No Edge Functions.
- Respect three-key tenancy (`user_id` + `workspace_id` + `product_id`) on every new row.
- `github.issue.create` must validate `GITHUB_REPO` matches an allow-list pattern (default: the Cadence repo only) so a prompt-injected agent cannot post issues onto a random repo. Service-role read of the secrets only inside the tool's `.handler()` — never client-side.
- The agent loop runs inside a request-scoped supabase client (RLS as the user); the resume sweeper uses `supabaseAdmin` (service role, RLS bypassed). Both paths share `executeLoop`, so any new write must still pass tenancy keys explicitly instead of relying on RLS to scope them.

## Done criteria

1. Integration test: kill worker mid-mission → mission resumes and completes with no duplicate side effects.
2. `agent_runs` shows `status='completed'` with a coherent checkpoint history.
3. `docs/foundation-audit.md` §0.9 flipped 🟡 → ✅; backlog status board updated; `plan.md` §4 appended.
4. Discover→Define→Plan mission completes end-to-end against the Cadence repo: real signal in, real GitHub issue out, PRD links back to the issue.
5. `active-task.md` deleted from repo root in the final commit (only after both 0.9 + the lifecycle slice ship).

## Handoff notes

- **2026-06-04 · Lovable (briefing fix)** — Fixed the repeated `/briefing` Save-disabled bug permanently. Root cause was not the textarea dirty state alone: the page could render while browser workspace context was still null, and the database did not guarantee a default workspace for every account. Migration now guarantees default workspace + owner membership for existing/future profiles; `upsertBrief` resolves missing workspace server-side; the Save button no longer depends on `effectiveWorkspaceId` to become clickable. Verified in preview: editing Current focus enables Save, clicking Save returns 200, and the button returns to Saved with no briefing console errors. Remaining active-task items are unchanged: operator-run lifecycle verification + forced-restart test.
- **2026-06-04 · Lovable** — **Bundle 2 Strategic Briefing (C5) shipped** in parallel with the leftover Bundle 6 close-out items. New `/briefing` route lets the workspace owner set Mission / Target user / Current focus / Anti-goals / Notes; the agent loop now injects that brief into every mission's system prompt (between persona and tools). `prd.link_issue` tool added + backfilled. **Operator's next action:** open `/briefing`, fill in at least Current focus + Anti-goals, then run the Discover→Define→Plan mission from `/agents` and verify (a) a real GitHub issue is created on `GITHUB_REPO` and (b) the trace shows the brief in the first model call's system prompt. After that, the remaining engineering on this active task is just the forced-restart integration test (Done criterion 1). Next bundle to start (separate task) = **Bundle 3 — Agent Roster + Trust Score + Autonomy Dial (C6)**.
- **2026-06-03 · Lovable (later)** — Runtime instrumentation + `github.issue.create` shipped: `withIdempotency`, `executeLoop` (shared by `runAgentLoop` + `resumeAgentLoop`), per-iteration checkpoint *before* `callModel`, idempotent tool execution, per-workspace backpressure (cap 5 running), `/api/public/hooks/resume-runs` sweeper wired to `pg_cron` every minute, `N1` tool registered. **Operator's turn next:** in the app, open `/_authenticated/agents`, ensure the Builder agent has `github.issue.create` enabled in tools, run the Discover→Define→Plan mission against a real Cadence signal, approve the GitHub write in `/_authenticated/governance`, and confirm a real issue appears on the configured `GITHUB_REPO`. Remaining engineering after that: forced-restart integration test (Done criterion 1), the small "PRD link-back to issue URL" tool if the mission needs it, and the "How to use / verify" block + `architecture/orchestration.md` refresh once the slice is green.
- **2026-06-03 · Lovable (PM tools)** — Added 3 PM-centric agent tools wired into the lifecycle and seeded for every user (existing + new): `research.synthesize` (Discover — clusters recent signals → themes, links signals via `theme_id`), `prd.draft` (Define — reads opportunity + theme + supporting signals, drafts a structured PRD into `prds`), `backlog.prioritize` (Plan — re-scores ICE on backlog opportunities grounded in supporting-signal counts/recency). All three go through the AI chokepoint (`callModel` with surfaces `discovery` / `prd`), default to `confirm` approval mode, and are immediately available to existing agents (Discovery Scout, PRD Writer, Strategist) via the user-scoped `agent_tools` registry — no per-agent assignment needed because the loop filters `TOOL_REGISTRY` by what the user has enabled. Lifecycle is now: `research.synthesize` → operator promotes a theme to an opportunity → `prd.draft(opportunity_id)` → `backlog.prioritize` → `github.issue.create(idempotency_key=prd_id)`.
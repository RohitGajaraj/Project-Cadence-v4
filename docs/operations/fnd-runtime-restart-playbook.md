# FND-RUNTIME 0.9 — Forced-restart verification playbook

> _Created: 2026-06-06 · Last updated: 2026-06-11_

> **Purpose.** Prove, with an operator's own hands, that a long Cadence mission survives a Cloudflare Worker restart mid-loop: the run resumes from its last checkpoint, every idempotent external write (GitHub PR, follow-up commit, CI read, issue create) returns its cached result instead of double-acting, and the operator sees one continuous mission timeline. This is the test that flips foundation-audit row **0.9 Durable runtime** from 🟡 → ✅.

## What's already in place (substrate)

- **Checkpoints** — `agent_run_checkpoints` upserted on every loop iteration _before_ the provider call (`src/lib/ai/loop.server.ts`).
- **Resume entry point** — `resumeAgentLoop(runId)` rehydrates state from the latest checkpoint and continues through the shared `executeLoop()`.
- **Idempotency keys** — every external write goes through `withIdempotency(scope, key, …)` (`src/lib/runtime/idempotency.server.ts`). Active scopes: `github_pr`, `github_commit`, `github_ci`, `github_issue`, `tool` (per loop step), `event_queue` dispatch.
- **Sweeper** — `/api/public/hooks/resume-runs` is poked once per minute by `pg_cron`; picks up any `agent_runs` row in `running` whose `last_checkpoint_at` is stale, and re-enters `resumeAgentLoop()`.

The proof has been waiting on one thing: nobody has deliberately killed a worker mid-loop and watched the mission resume cleanly. This playbook closes that gap.

## Setup

- Sign in as `demo@redcadence.app` (or your own account with a GitHub-linked PRD). Credentials: [`./demo-credentials.md`](./demo-credentials.md).
- Confirm `GITHUB_REPO` + `GITHUB_TOKEN` are configured (Builder needs them). The default demo repo is `RohitGajaraj/Test-Project-Cadence`.
- Have two browser tabs open: tab A on `/missions/$id` (or `/build`), tab B on **Lovable Cloud → Project status** (or wherever you trigger the worker restart). The Cloud "Restart preview" / "Restart backend" control is what we'll use as the kill switch.

## The test (≤ 5 minutes, end to end)

1. **Start a multi-step Builder mission.** From `/prds/$id` (PRD with a linked GitHub issue) click **Send to Builder**. You land on `/missions/$id`. The orchestrator hands off to the Builder.
2. **Wait for the first heavy step to checkpoint.** The Builder reads the issue (a couple of `workspace.search` / `web.fetch` calls), then queues `github.pr.open` at the **Decision Queue**. Approve it. A PR opens on the connected repo; the `tool_calls` row for `github.pr.open` records `{number, url, branch, path}`.
3. **Trigger the restart NOW.** While the run is still `running` (Builder is mid-CI-poll — `github.ci.read` returns `pending`), restart the preview/backend worker from Cloud. The browser tab will briefly drop the SSE; the database is untouched.
4. **Wait ≤ 60 seconds.** The pg_cron sweeper at `/api/public/hooks/resume-runs` picks up the stalled run, hydrates from `agent_run_checkpoints`, and re-enters the loop.
5. **Observe convergence.** On `/missions/$id`:
   - The mission timeline gains no duplicate steps — same trace_id, same step indices.
   - `github.pr.open` does **not** fire a second time (Builder's loop continues past the cached result via `withIdempotency`).
   - On the connected repo: exactly **one** branch (`builder/issue-<n>-…`), **one** PR, **one** initial commit. Body says `Closes #N` exactly once.
6. **Repeat for the follow-up commit (Slice 2 path).** If CI is red, the Builder queues `github.commit.append`. Approve, then immediately restart the worker before the PUT returns. After the sweeper re-enters, exactly **one** extra commit on the branch.
7. **Re-approve a cached approval.** Open the PR-open or commit-append approval card from `/inbox` and click Approve again after the run is terminal — the cached `withIdempotency` result is returned; no third branch, no third PR, no third commit.

## Pass criteria

- Mission status flips to `completed` (or `completed_with_failures` only if CI legitimately failed) without operator intervention.
- No duplicate `tool_calls` rows for any idempotency-keyed scope (`github_pr`, `github_commit`, `github_ci`, `github_issue`). Verify with a quick read in the backend if needed.
- GitHub repo state matches the single-mission contract: one branch, one PR, one initial commit, optionally one fix commit.
- The `agent_run_checkpoints` table has ≥ 2 rows for the run with monotonically increasing `step_index`, the last one inside the post-restart window.
- No `agent_runs.status = 'failed'` for the run; `halted_reason` is null.

## Fail modes & what they mean

| Symptom                                                          | Likely cause                                                                       | Where to look                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Two PRs on the branch                                            | `withIdempotency` not wrapping `github.pr.open`                                    | `src/lib/ai/tools/registry.server.ts` — the PR-open tool should be inside `withIdempotency(supabase, "github_pr", a.idempotency_key, …)` |
| Mission stays stuck `running` after restart                      | Sweeper isn't running, or run's `last_checkpoint_at` is fresh enough to be skipped | `/api/public/hooks/resume-runs` logs; the pg_cron job `resume-runs-tick`                                                                 |
| Mission flips `failed` after restart                             | Loop tried to call an external tool whose result wasn't yet checkpointed           | Confirm checkpoint happens _before_ the provider call (`loop.server.ts`)                                                                 |
| Duplicate `tool_calls` for `github.ci.read` with same `head_sha` | CI-read idempotency cache key not hit                                              | Confirm Slice 2 wraps `github.ci.read` in `withIdempotency('github_ci', '<pr>-<head_sha>', …)`                                           |

## Doc-loop closure on pass

On a clean pass, in one commit:

- Flip foundation-audit row **0.9** to ✅ with the run date and a one-line note.
- Flip the Live status board's "Step 1 forced-restart test still ◑" → ✅.
- Append a one-liner to [`../../plan.md`](../../plan.md) §4 with the run date and WHY.

## Out of scope

- This playbook does not test Workers CPU-time limits (`MAX_STEPS` cap is the safety net for runaway loops).
- This playbook does not test partial-write recovery inside the GitHub Contents API — those calls are atomic per request from the API's side.
- This playbook does not exercise the orchestrator's mission-DAG (`mission_steps`) explicitly — the Builder lane is the most expensive single-agent path and is the right place to prove durability.

## Related

- Foundation audit: [`../planning/archive/foundation-audit.md`](../planning/archive/foundation-audit.md) row 0.9.
- Bundle 9 (the mission this playbook runs against): [`../features/bundle-9-builder.md`](../features/archive/bundle-9-builder.md).
- Runtime architecture: [`../../architecture/runtime.md`](../../architecture/runtime.md).

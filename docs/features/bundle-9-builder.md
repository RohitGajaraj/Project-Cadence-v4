# Bundle 9 — Builder agent: PR, CI, conflict guard

> **Status:** ✅ Shipped (Slice 1 2026-06-04 · Slice 2 + 3 2026-06-06) · **Route:** `/build` · **Owner agent:** `builder`

## What it does

The Builder agent picks up a GitHub issue on the connected product repo and ships a **single-file, scoped pull request** — gated by an operator approval. After opening the PR it reads CI on its own commit, and if CI goes red it proposes ONE follow-up commit on the same branch (also approval-gated). Two Builder missions can never silently race on the same file: the second mission to target a path is blocked with a typed conflict error until the first finishes or the operator releases the claim.

The contract Builder ships under, in one breath: **one file per PR · approval-gated · never auto-merges · never touches `.github/` / migrations / lockfiles · idempotent on every external write.**

## Why it exists

Bundle 9 is the build leg of the Proof Platform — claim C2 ("one governed loop") becomes literally true only when the Plan stage exits the platform into the engineering system of record under operator control. Slice 1 (PR-open) proved the loop end-to-end against a real repo; Slice 2 added the feedback half (read CI, react to red) so the Builder closes its own loop instead of leaving the operator to chase test failures; Slice 3 made the loop safe to run in parallel by adding per-(repo, path) claims so two missions can never accidentally collide on the same file. Full rationale: [`../../plan.md`](../../plan.md) §4 (entries dated 2026-06-04 and 2026-06-06).

## Where to find it

- **Nav:** sidebar → **Deliver** → **Build Console**.
- **Route:** `/build` (gated by the `_authenticated` layout).
- **Panels (top to bottom):**
  1. **Header + live indicator** — "2s refresh" dot, mission count.
  2. **Start a build composer** — free-form Goal (required), optional Reference PRD, optional reference links, three ways to resolve the GitHub issue (use the linked PRD's issue · explicit number · auto-create from goal). Dispatches a Builder mission and jumps you to its Mission Graph.
  3. **Active file claims panel** (Slice 3) — every `held` claim across the workspace with the holding mission's title, claimed-at, an "Open mission" jump, and a **Release** button (only enabled for the claim owner). Auto-refreshes every 5s. Hidden when there are no active claims.
  4. **Kanban** — 5 columns over `agent_runs WHERE agent_slug='builder'`:
     - **In flight** · planner is mid-loop.
     - **Awaiting you** · ≥1 pending `agent_approvals` row on this run's trace.
     - **PR open** · `github.pr.open` returned a PR; run not yet terminal.
     - **Done** · run reached `complete`/`completed`.
     - **Failed** · run `failed` or `halted`.
  5. **Builder card** — mission title + goal excerpt, status pill with pending-approval count, **PR chip** (`Github · PR #N · path/to/file` → opens the PR), **CI chip** (Slice 2 — `CI · green` / `CI · red · <check>` / `CI · pending` / `CI · n/a`, links to the failing check). Click the card to open the Mission Graph.

The same CI chip and PR chip render inline in `/missions/$id` for each step in the mission timeline.

## Demo script (≤ 120 seconds)

1. Sign in as `demo@redcadence.app` (see [`../demo-credentials.md`](../demo-credentials.md)).
2. Open any PRD on `/prds` that has a linked GitHub issue (the `#linked` chip in the dropdown). Click **Send to Builder**.
3. You land on `/missions/$id` and the orchestrator hands off to the Builder. The Builder reads the issue, drafts a one-file diff, and queues `github.pr.open` at the **Decision Queue** — approve it.
4. A real PR opens on the connected repo from a `builder/issue-<n>-…` branch with **one file changed** and `Closes #N` in the body. No auto-merge.
5. Open `/build` in a second tab. The mission card sits in the **PR open** column with a `Github · PR #N` chip and a `CI · pending` chip. Refresh in a minute — the CI chip flips to `CI · green` or `CI · red · <name>`.
6. **(Optional, Slice 2)** If CI went red, the Builder queues a `github.commit.append` approval with a one-file fix. Approve it; a single extra commit appears on the same branch, CI re-runs, and the chip updates.
7. **(Optional, Slice 3)** From the composer, dispatch a second Builder mission whose Goal targets the same path. Approve its `github.pr.open` — it lands a `BuilderFileConflict` error instead of opening a second PR. The **Active file claims** panel shows which mission holds the path. Open the first mission, let it finish (or click **Release**) — the second mission can now proceed.

## How it works

- **Tools** (in `src/lib/ai/tools/registry.server.ts`, picked up by the Builder agent through `seed_pm_lifecycle_tools`):
  - `github.pr.open` (`write` / `confirm`) — REST-only flow: get default branch → create `builder/issue-<n>-<slug>-<rand>` ref → PUT file via Contents API → POST PR with `Closes #N`. Wrapped in `withIdempotency('github_pr', a.idempotency_key, …)`.
  - `github.ci.read` (`read` / `auto`) — Slice 2. `GET /pulls/{n}` → head sha → `GET /commits/{sha}/check-runs` + `/status`. Returns `{ overall, checks, head_sha, … }`. Cached via `withIdempotency('github_ci', '<pr>-<head_sha>', …)` so re-polls within a step don't burn quota; cache invalidates when `head_sha` changes.
  - `github.commit.append` (`write` / `confirm`) — Slice 2. PUT a single new file (or update) on the PR's head branch. Same `.github/` / migrations / lockfile deny-list as `github.pr.open`. Wrapped in `withIdempotency('github_commit', a.idempotency_key, …)` keyed by `issue-<n>-fix-<k>` so re-approval after a worker restart returns the cached commit.
- **Agent prompt** (in `seed_default_agents`, slug `builder`): enforces the contract — one file per PR, read the issue first, single `github.pr.open` per mission with `idempotency_key = "issue-{n}"`, then read CI a couple of times, on red propose ONE follow-up commit with `idempotency_key = "issue-{n}-fix-1"`, never auto-merge.
- **Claims ledger (Slice 3):** new `builder_file_claims` table — `(user_id, workspace_id, run_id, mission_id, mission_title, repo, path, status, claimed_at, released_at, released_reason)` with a partial unique index `(repo, path) WHERE status='held'`. `github.pr.open` INSERTs the row before the Contents-API PUT; conflict on the unique index becomes a typed `BuilderFileConflict` error. RLS: workspace members can read; owner can write.
- **Auto-release trigger:** `release_claims_for_terminal_run` runs `AFTER UPDATE OF status ON agent_runs` and flips every `held` claim for that run to `released` whenever the run enters `completed` / `completed_with_failures` / `halted` / `failed`. The operator's **Release** button writes the same flip directly (server fn `releaseBuilderClaim`).
- **Server fns** (`src/lib/build.functions.ts`):
  - `listBuilderRuns()` — joins `agent_runs` → `agent_run_checkpoints` (to get the trace) → `tool_calls` (for `github.pr.open` and `github.ci.read` results) → `agent_approvals` (pending count). One server fn, refreshed every 2s by the Kanban.
  - `listBuilderClaims()` — every `status='held'` row across the workspace, capped 50, refreshed every 5s by the claims panel. Marks `is_mine` so the UI can gate the Release button.
  - `releaseBuilderClaim({ claim_id })` — operator force-release; updates `status='released'` with `released_reason='operator_release'`.
  - `dispatchBuilderMission(...)` — the composer entry point; resolves the issue (linked PRD / explicit number / auto-create), creates the mission, runs the loop.
- **No new cron.** The existing `resume-runs` sweeper re-enters any Builder run that finalized in `awaiting_ci`; the auto-release trigger handles claim cleanup without extra polling.

## Governance & guardrails

- **Approval modes:** `github.pr.open` and `github.commit.append` ship as `write` / `confirm` — Builder cannot side-step into `auto` until the operator dials the agent's trust arc past Proving, and even then `confirm` is the documented contract for this lane. `github.ci.read` is `read` / `auto` (read-only).
- **Allow-list:** both PR-open and commit-append refuse paths that match `.github/`, `supabase/migrations/`, `.env`, `bun.lock`, `package-lock.json`.
- **Idempotency:** every external write (issue create, PR open, commit append, CI read) goes through `withIdempotency()` so a worker restart, sweeper resume, or operator re-approval returns the cached result instead of double-acting on GitHub.
- **RLS:** `builder_file_claims` rows are visible to workspace members and writable by the row's `user_id`. The auto-release trigger runs SECURITY DEFINER so terminal-status transitions on any `agent_run` reliably release claims regardless of who triggered them.
- **No auto-merge, ever.** No tool in the registry merges or closes PRs.

## Verification checklist

- **Slice 1 — PR open**
  1. From `/prds/$id` (PRD with a linked GitHub issue) → **Send to Builder** → approve `github.pr.open` on the Mission Graph → exactly one PR opens on `${GITHUB_REPO}` from a `builder/issue-<n>-…` branch with one file changed, body says `Closes #N`, **not** merged.
  2. Re-approve the same gate after a worker restart → cached PR returned, no second branch.
- **Slice 2 — CI loop**
  1. After PR opens, `/build` card shows a `CI · pending` chip; within ≤2 minutes it flips to `CI · green` or `CI · red · <check>`.
  2. Force-fail CI (push a broken expectation) → Builder queues one `github.commit.append` approval; approve → exactly one extra commit on the same branch; CI re-runs.
  3. Re-approve the same commit gate → cached commit returned, no second commit.
  4. Cap respected: never more than 3 `github.ci.read` calls per loop step (visible in the Mission Graph timeline).
- **Slice 3 — Conflict guard**
  1. Dispatch two Builder missions whose Goals resolve to the same path → first mission's `github.pr.open` succeeds; second's lands `BuilderFileConflict` and **does not** open a PR or create a branch.
  2. **Active file claims** panel on `/build` shows the held claim with the first mission's title.
  3. Finalize the first mission → trigger releases the claim → second mission can be re-run and opens cleanly.
  4. Click **Release** on the panel as the claim's owner → claim flips to `released`; non-owners see the button disabled with an explanatory tooltip.

## Known limits / out of scope

- **Builder writes one file per PR.** Multi-file diffs are intentionally out of scope; a real multi-file change ships as a sequence of single-file PRs.
- **No `github.ci.logs` tool yet.** Builder sees the failing check's `name` + `summary` but not the raw job log; we keep the GitHub-API surface tight on purpose. Add it only if a real demo proves the summary is too thin.
- **Conflict scope is `(repo, path)`.** Two missions that _will_ edit the same path eventually but don't claim it at the same moment can still race; the conflict guard fires when the second `github.pr.open` runs, not at planning time. Adequate for the single-file contract.
- **No PR-merge, no PR-close, no PR-update.** Operator owns merge.
- **Custom-repo per workspace is not yet supported** — `GITHUB_REPO` is a single global secret. Per-workspace connectors land with the integrations rework.

## Related

- Build log: [`../../plan.md`](../../plan.md) §4 — entries `2026-06-04 Bundle 9 Slice 1` and `2026-06-06 Bundle 9 Slices 2 + 3`.
- Architecture: [`../../architecture/orchestration.md`](../../architecture/orchestration.md) (Bundle 9 paragraph) · [`../../architecture/runtime.md`](../../architecture/runtime.md) (idempotency, durable runtime).
- GitHub approval flow: [`../github-issue-approval-flow.md`](../github-issue-approval-flow.md).
- Foundation: [`../foundation-audit.md`](../foundation-audit.md) row 0.9 (durable runtime) — proven against this Bundle.
- Backlog row: [`../feature-backlog.md`](../feature-backlog.md) Bundle 9.
- Sibling features: [`./f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md) (dispatches Builder), [`./f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md) (can trigger Builder on `prd.approved`).

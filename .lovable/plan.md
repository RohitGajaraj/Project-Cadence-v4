
# What we'll work on (and what we're explicitly skipping)

**Skipping for now** (per your call): Restructure Phases 3–4 — all UI/UX theme polish. Routes will get the Cohere editorial restyle at the very end, after the feature tweaks settle.

**Picking up** (the non-theme pending queue, in build order):

1. **Bundle 9 Slice 2** — Builder CI-read + auto-fix-on-red. (next)
2. **Bundle 9 Slice 3** — Shared-file conflict detection for parallel Builder runs.
3. **FND-RUNTIME 0.9 — forced-restart verification.** Last remaining foundation gap, naturally testable while Slice 2/3 keep Builder busy.

After that, the next non-theme thread is **Proof-platform v1.1 bundles 10–12** (Ship · Launch · Support→Learn). Out of scope for this plan; flagged for the next session.

---

# Slice 2 — Builder reads CI and reacts to red

## Goal
After Builder opens a PR via `github.pr.open` (Slice 1), it must (a) **read GitHub Actions status** on that PR, (b) **surface failures** in the Mission Graph + `/build` Kanban, and (c) **propose a one-file follow-up commit** that targets the failure — gated behind the same `confirm` approval as Slice 1. No autonomous merge, ever.

## What to build

### Backend
- **New built-in tool `github.ci.read`** in `src/lib/ai/tools/registry.server.ts` (`read/auto`, no approval needed):
  - Input: `{ pr_number: number }` (defaults to "the PR opened by this run" via `tool_calls.result` lookup on `github.pr.open`).
  - Calls GitHub REST: `GET /repos/{repo}/pulls/{n}` → head sha → `GET /repos/{repo}/commits/{sha}/check-runs` + `/status` → returns `{ overall: "pending"|"success"|"failure"|"neutral", checks: [{name, conclusion, html_url, log_url?}], head_sha, updated_at }`.
  - Cached via `withIdempotency('github_ci', '<pr>-<head_sha>', …)` per `(pr, head_sha)` so re-polls within a run don't burn quota; cache invalidates when `head_sha` changes.
- **New built-in tool `github.commit.append`** (`write/confirm`):
  - Input: `{ pr_number, path, contents_base64, message, idempotency_key }`.
  - Same allow-list / deny-list as `github.pr.open` (no `.github/`, no migrations, no lockfiles, single file).
  - Reads PR's head ref, PUTs file via Contents API onto that branch (sha-aware update), returns `{ sha, commit_url, html_url }`.
  - Wrapped in `withIdempotency('github_commit', idempotency_key, …)` keyed by `pr#-path-attempt#` so re-approval after worker restart returns the cached commit, never double-appends.
- **Builder system prompt updates** (`seed_pm_lifecycle_tools` migration): after `github.pr.open` resolves, the loop is instructed to call `github.ci.read` on a short backoff (15s → 30s → 60s, cap 3 polls per loop step), then either finalize on green, or — on red — read the failing job's logs (via tool, see below) and propose a single `github.commit.append` patch. If CI is still `pending` after the polls, finalize with status `awaiting_ci` and let the existing `resume-runs` sweeper re-enter via Slice 3's reactor wire-up.
- **Optional `github.ci.logs` tool** (`read/auto`): `GET /repos/{repo}/actions/jobs/{id}/logs` — returns the tail (last ~8KB) of the failing job's log. Gated by the same single-PR scope. Without this, Slice 2 still ships but Builder is blind to *why* CI failed.
- **`build.functions.ts` extension**: `listBuilderRuns()` already joins `tool_calls.result`; extend it to surface the latest `github.ci.read` result per run → adds `ci: { overall, updated_at } | null` to each `BuilderRun`.

### UI (presentational only — no theme changes)
- **`/build` Kanban**: add a sixth column (or repurpose "PR open"): **CI status chip** on each PR card — `pending` / `green` / `red` dot + name of the failing check. Click → opens the check's `html_url` in a new tab.
- **`/missions/$id`**: render `github.ci.read` step results inline in the existing timeline (no new layout work), with the same check chip.

### Cron
- The existing `resume-runs` sweeper already picks up stalled `agent_runs`. **No new cron**. Builder runs that finalized in `awaiting_ci` get re-woken on the next tick if the PR's head_sha is unchanged and CI moved to terminal.

## Out of scope (defer to Slice 3)
- Parallel Builder runs touching the same file. Slice 2 trusts the single-file allow-list; conflict detection lands in Slice 3.

## Verification checklist
- Open a PRD with a linked issue → Send to Builder → approve PR → CI runs on the real repo (`RohitGajaraj/Test-Project-Cadence`).
- On green: `/build` card shows green CI chip, mission finalizes `completed`, no follow-up commit.
- Force-fail CI (push a broken expectation in the issue): Builder lands an approval gate `github.commit.append` with a one-file patch quoting the failing check; approve → commit appears on the PR branch, CI re-runs.
- Re-approve the same gate after a worker restart → cached commit returns; PR branch has exactly one extra commit.
- Cap respected: never more than 3 CI polls per loop step.

---

# Slice 3 — Shared-file conflict detection for parallel Builder runs

## Goal
Two parallel Builder missions must not silently race on the same file. Today, `github.pr.open` is happy to open two PRs writing `src/foo.ts` on different branches; the second one wins on merge and the operator finds out at review. Slice 3 makes the conflict visible **before** the PR is opened.

## What to build

### Backend
- **New `builder_file_claims` table** (migration):
  - `(id uuid pk, user_id uuid, workspace_id uuid, run_id uuid, mission_id uuid, repo text, path text, status text check in ('held','released'), claimed_at timestamptz, released_at timestamptz)`.
  - Partial unique index `(repo, path) WHERE status='held'` — only one held claim per `(repo, path)` at a time.
  - RLS: workspace-scoped read; `auth.uid()=user_id` for write. `GRANT SELECT,INSERT,UPDATE TO authenticated; GRANT ALL TO service_role;`.
- **`github.pr.open` wrapper change**:
  - Before the Contents-API PUT, attempt to INSERT a `builder_file_claims` row for `(repo, path)`. On unique-violation, **abort the tool call** with a typed error `BuilderFileConflict: path "<p>" is already claimed by run <id> (mission "<title>"). Wait or operator to release.`
  - On PR-open success: claim stays `held` until terminal.
  - On mission terminal (`completed` / `completed_with_failures` / `halted`): release all claims for that `run_id` (handled by `maybeCompleteMission` + a small helper, or a trigger on `agent_runs.status` transitioning to terminal).
- **Stale-claim sweeper**: extend `resume-runs` to also release `held` claims whose `run_id` is in a terminal state (defensive — covers crashes where the trigger missed).

### UI
- `/build` Kanban: a card whose latest tool call is the conflict error shows a coral "Conflict · path X (held by mission Y)" chip with a "Release" action (operator-only, calls a new server fn `releaseBuilderClaim({ claim_id })` that flips status to `released`).
- `/missions/$id`: conflict step renders the same chip inline.

### Server fn
- `releaseBuilderClaim({ claim_id })` in `src/lib/build.functions.ts` — auth-scoped, sets `status='released', released_at=now()`. No tool call; pure operator control.

## Verification checklist
- Dispatch two Builder missions whose Goal-resolved paths collide → second mission's `github.pr.open` step lands a `BuilderFileConflict` approval/error → no second PR opens, no second branch created.
- Finalize the first mission → claim auto-releases → re-running the second mission's loop step opens the PR cleanly.
- Operator-release works: hit "Release" on `/build` → second mission can proceed without waiting on the first.
- No regression: a single Builder run still opens exactly one PR and the claim is gone after terminal.

---

# FND-RUNTIME 0.9 — forced-restart verification (test, not new code)

Substrate already exists (`agent_run_checkpoints`, `resumeAgentLoop()`, idempotency keys, `resume-runs` sweeper). The remaining `◑` is the **proof** — we never deliberately killed a worker mid-loop and watched it resume.

## What to do
- Add a test entry in `docs/foundation-audit.md` row 0.9 + a one-page playbook in `docs/`:
  1. Start a multi-step Builder mission (Slice 2 makes this realistic — PR open + CI poll).
  2. Trigger a worker restart mid-loop via the existing Lovable Cloud restart path (operator action; document the click).
  3. Observe `resume-runs` picks the run up within ≤60s; loop resumes from the last checkpoint; idempotency-wrapped tool calls (`github_pr`, `github_commit`, `github_ci`) return cached results, not duplicates.
  4. PR has exactly one branch, one initial commit (per Slice 2), no duplicates on the issue.
- Flip row 0.9 in `docs/foundation-audit.md` to ✅ with date + checklist outcomes.

No code change expected unless the test surfaces a real gap.

---

# Doc loop (closed inside the same commit as each slice)

For each of Slice 2, Slice 3, and the FND-RUNTIME verification:
- Update **Live status board** in `docs/feature-backlog.md` (`Now building` → done; flip Bundle 9 progress mark when Slice 3 lands; flip Step 1 mark when 0.9 verifies).
- Append a dated WHY entry to `plan.md` §4.
- Update `architecture/orchestration.md` Bundle 9 paragraph with the new tools + conflict table.
- Update `docs/features/` — extend the implied Builder feature doc (or add `docs/features/bundle-9-builder.md`) with the demo script + verification checklist for the operator.
- Add a `docs/features/builder-ci-and-conflicts.md` operator doc when Slice 3 closes (per the per-feature pattern we just established).

---

# Order, risks, and what I need from you

**Order:** Slice 2 → Slice 3 → FND-RUNTIME 0.9 verification. Each is shippable on its own; we do not bundle them.

**Risks:**
- GitHub REST rate-limits if CI polling is sloppy. Mitigation: idempotency-keyed by `head_sha`, hard cap 3 polls/step, exponential backoff.
- `builder_file_claims` deadlock between two missions writing each other's paths in sequence. Mitigation: claims are per-(repo,path) not per-mission; first-writer-wins with operator override.
- Conflict UX needs to be unambiguous so the operator doesn't think Builder is broken. Mitigation: coral chip on `/build` + named blocker (mission title), explicit Release button.

**Approve this plan, or redirect** — e.g.:
- Want Slice 2 only this turn and queue Slice 3 next?
- Want `github.ci.logs` (log-tail tool) included, or kept out to minimize surface area?
- Want FND-RUNTIME 0.9 verification done *before* Slice 2 instead of after (so Slice 2 ships on a proven-durable substrate)?

# K2 - Rollback + one-action revert - Design Spec

> _Created: 2026-06-19 · Last updated: 2026-06-19_

> **Status:** design (awaiting review) · **Date:** 2026-06-18 · **Lane:** G3 Build → QA → Ship · **Depends on:** F-STUDIO, I1b (revisions), J2 (CI gate) - all ✅
>
> The brainstorm artifact for feature **K2**. The canonical record once built lives in [`docs/features/studio.md`](../../features/studio.md) (gains a "Rollback" section) + the dashboards; this file is the design rationale.

---

## 1. Problem

Cadence's Build engine (F-STUDIO) ships real code: a mission stages a multi-file changeset, commits it to a `studio/*` branch via the GitHub Git Data API, opens a PR, passes the J2 CI gate, and squash-merges to the default branch. **There is no way to undo a shipped change.** K2 is the "undo the ship" path: from the Build UI, roll back a merged release in one action, with a documented rollback record, and stop an in-flight change before it lands.

## 2. Constraints discovered by recon (these define what K2 can honestly be)

1. **Revision content is not stored.** `studio_changeset_revisions` holds only `revision_no, commit_sha, commit_url, message, files[{path,op}]` - no file content, no per-revision `base_sha`. The durable record of what a revision actually contained is **the commit object on GitHub**. (This is exactly why I1b deferred "revert-to-revision … needs per-revision content or git ops.")
2. **All git mutation is the GitHub Git Data API - no local checkout.** Branch `studio/<mission8>-<changeset12>`; commit = blobs → tree → commit → ref; merge = `PUT /pulls/{n}/merge` (squash) after the J2 CI re-read in `src/lib/ai/studio-ci.ts`.
3. **No feature-flag system exists.** The only runtime kill is FND-0.6 (`kill_switches`, gating *AI calls* at the chokepoint) plus per-agent/tool `enabled` booleans. Nothing toggles a shipped feature inside the user's deployed product.
4. **Deploy is external** (K1-deploy deferred under the founder honesty ruling). Cadence ships code *to the repo*; the user's own CD redeploys it. K2 therefore operates on **git/PR-level artifacts**, never on a production deploy it does not own.

## 3. Scope

**In scope (the honest trio):**

- **R1 · Roll back a merged release.** One action in `ChangesPanel` turns a merged changeset into a **revert changeset** that restores the touched paths to their pre-merge state, then flows through the *existing* commit → PR → J2-gated merge rails. The operator gets a real revert PR; CI + human review gate the re-merge.
- **R2 · Documented rollback record.** A `studio_rollbacks` row links the original changeset → revert changeset/PR + reason + status, plus a humanized rollback note (mirrors K1 `generateReleaseNotes`). This is the "documented rollback per release."
- **R3 · Kill an in-flight change.** For a not-yet-merged changeset (`staged | committed | pr_open`): close the PR if open, release `builder_file_claims`, set `status='abandoned'`. Cadence fully owns pre-merge state, so this is honest and immediate.

**Explicitly out of scope (documented as deferred in `studio.md`, K1-deploy-style):**

- **Production feature-flag kill.** No flag infra exists and deploy is external; a flag would toggle nothing real in the user's product. Building it would violate the repo's "claim never outruns wiring" rule. **Cut.** (Founder decision, 2026-06-18.)
- **Per-revision revert on an open branch.** Lower value (the operator can re-stage); K2 reverts at the *release* (merged changeset) granularity.
- **Surgical 3-way revert** that reverses only the changeset's hunks when later changesets touched the same paths. Without local git this needs a 3-way merge; deferred. K2 does a **hard restore** of the touched paths to their pre-merge state and surfaces the caveat in the revert PR body (CI + review catch breakage).
- **Auto-rollback triggers** (e.g. revert automatically when post-merge CI goes red). Speculative; deferred.

## 4. Architecture - "revert = synthesize an inverse changeset, run it through the existing ship rails"

Rather than build bespoke git-revert plumbing, K2 **constructs an inverse changeset and pushes it through the proven studio rails.** Near-zero new git code; full reuse of the CI gate, gated merge, Changes UI, and release-notes pattern.

### 4.1 The revert flow (R1), git-truth source

Given a merged changeset `CS` (`status='merged'`, has `pr_number`):

1. **Find the merge commit's parent.** `GET /pulls/{pr_number}` → `merge_commit_sha = M`. `GET /commits/{M}` → `P = parents[0].sha` (the default-branch head *before* CS merged).
2. **Reconstruct the inverse content per touched path.** The touched-path set comes from `CS`'s `studio_changes` rows (authoritative path+op list). For each path, read its blob **at `P`** (`GET /contents/{path}?ref=P`). Present at `P`: revert sets that path's content back to the `P` blob (`op=update`/`create`). Absent at `P` (CS created it): `op=delete`.
3. **Create a revert changeset** `RCS`: `status='staged'`, `title="Revert: <CS.title>"`, on a new branch `studio/revert-<changeset12>-<n>`, hosted by a **new minimal "rollback" mission** that does **not** enter the agent loop (no orchestrator dispatch, no reactor fan-out) - it exists only to host `RCS` and drive the existing session UI/merge tool. Its `studio_changes` rows carry `new_content = P-state` and `base_content = current default-branch state` (for the diff).
4. **Ship it through the existing rails.** `studio.commit` (blobs→tree→commit→ref) → `studio.pr.open` → **J2 CI gate** → human-gated `studio.pr.merge`. No new git code.
5. **Record the rollback.** Write/Update the `studio_rollbacks` row (`status` `initiated` → `reverted` on merge) + a humanized note.

> **Why a new mission, not the original?** `getStudioSession` is keyed off a mission. Reusing CS's mission risks confusing the in-app session view and re-triggering CS's lifecycle. A dedicated, loop-suppressed rollback mission keeps the revert isolated and lets the existing PR/merge UI + `studio.pr.merge` work unchanged. **Implementation must verify the mission-insert path does not auto-dispatch the orchestrator/reactor**; if it does, suppress via the mission `status`/`kind` the reactor already ignores.

### 4.2 Kill-in-flight (R3)

`abandonChangeset(changesetId, reason)`: if `pr_number` set and PR open → `PATCH /pulls/{n}` state=closed; delete the branch ref (best-effort); release every `builder_file_claims` row for the changeset (`status='released'`, `released_reason='rollback_abandon'`); set `studio_changesets.status='abandoned'`. Idempotent (no-op if already abandoned/merged).

## 5. Data model

**New table** `studio_rollbacks` (new timestamped migration `…_k2_rollbacks.sql` under `supabase/migrations/`, RLS workspace-scoped, mirroring `studio_changesets`):

| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | RLS owner |
| `workspace_id` | uuid | RLS scope |
| `product_id` | uuid null | |
| `original_changeset_id` | uuid fk studio_changesets | the release being rolled back |
| `revert_changeset_id` | uuid fk studio_changesets null | the inverse changeset (null until created) |
| `reason` | text | operator-supplied |
| `status` | text check(`initiated`\|`reverted`\|`failed`) | `initiated` on revert-changeset creation, `reverted` when the revert PR merges |
| `note` | text null | humanized rollback note (K1 chokepoint) |
| `created_at` / `updated_at` | timestamptz | |

No change to existing tables. The revert reuses `studio_changesets` / `studio_changes` as-is.

**Pre-migration tolerance (house pattern).** Reads tolerate the table being absent (panel renders "rollback history · after sync"); the revert *write* is gated on the migration applying. Mirror the F-SHARE / B5 / H2 tolerance pattern.

## 6. Server functions (`src/lib/studio.functions.ts`)

- `rollbackRelease({ changesetId, reason })` → orchestrates §4.1 steps 1-3 + 5 (creates the rollback mission, the inverse changeset, the `studio_rollbacks` row). Returns `{ rollbackId, revertChangesetId, revertMissionId }`. The commit/PR/merge then proceed through the existing tools/UI. `requireSupabaseAuth`, zod-validated, RLS-scoped via `.select()` so a blocked write fails loudly.
- `abandonChangeset({ changesetId, reason })` → R3.
- `getRollbacks({ productId })` → rollback history for the panel (tolerant of missing table).
- `generateRollbackNote({ rollbackId })` → drafts the note via `callModel` reusing the **same `CallSurface` as K1's `generateReleaseNotes`** (auto-humanized at the chokepoint), persisted on the row. Owner-scoped, mirrors `generateReleaseNotes` exactly. If a distinct surface is preferred, add one valid `CallSurface` literal to the union - do not call the gateway directly.

## 7. Agent-loop tool (`src/lib/ai/tools/registry.server.ts`)

`studio.revert` registered via `def({...})`, seeded into `agent_tools` (new + backfilled users) at **`review`** approval mode (never `auto` - a revert is a governed, human-cleared action). It wraps `rollbackRelease` + drives commit/PR through the same `withIdempotency` discipline as `studio.commit`. This lets the orchestrator/operator say "roll back the last release" in-loop, gated.

## 8. UI (`src/components/studio/ChangesPanel.tsx` + build route)

- **"Roll back this release"** on the changeset header - visible only when `changeset.status === 'merged'`. Opens a `useConfirm` dialog (reason field) → `useMutation(rollbackRelease)` → toast + `invalidate(['studio-session', missionId])` → navigate to the revert session. Reuses the existing confirm/toast/mutation patterns already in this panel.
- **"Kill this change"** on the header - visible for `staged | committed | pr_open` → `abandonChangeset`.
- **Rollback history** - a small bento card listing `studio_rollbacks` (original → revert PR link + status + note), pre-migration tolerant.
- Visual language matches `CiPanel` bento cards + external GitHub links. No new design system work.

## 9. Error handling & edge cases

- **Not merged** → `rollbackRelease` rejects unless `status='merged'` (loud error, no phantom-ok).
- **Already rolled back** → if a non-failed `studio_rollbacks` row exists for the changeset, surface it instead of creating a duplicate.
- **Intervening changes to the same paths** → hard-restore to `P`-state; the revert PR body states this explicitly; CI + human review are the backstop. (Surgical 3-way deferred per §3.)
- **PR/merge already gone, branch deleted** → `P` is still resolvable from `merge_commit_sha`; the revert opens a fresh branch off current head. If `merge_commit_sha` is null (PR not actually merged), reject.
- **GitHub API failure mid-flow** → `studio_rollbacks.status='failed'`, claims released, no partial changeset left dispatchable; `withIdempotency` prevents double-commit on retry.
- **RLS** → every read/write user/workspace-scoped; blocked update fails via empty `.select()` (the B5/H2 discipline).
- **Humanize** → the rollback note goes through the chokepoint; no raw em-dashes / AI fingerprints.

## 10. Testing

- Pure unit tests for the **inverse-changeset synthesizer** (`buildInverseChanges(touched, parentBlobs)`): create→delete, update→restore-parent, delete→recreate, path-absent-at-parent→delete. Mirror the `studio-hunks.ts` / `studio-branch.ts` test style (no network).
- Unit test `mergeReadiness` re-entry isn't regressed (revert PR uses the same J2 gate).
- Manual/live verify on the deployed app (local dev has no AI key / GitHub app): merge a small changeset → Roll back → confirm a revert PR opens, CI runs, gated merge restores the file; confirm `studio_rollbacks` row + note.

## 11. Closed-doc loop (update in the same unit of work)

- `docs/features/studio.md` → new **"Rollback"** section (the R1/R2/R3 contract + the explicit flag-kill/3-way/auto-trigger deferrals).
- `docs/planning/feature-dashboard.md` (G3 K2 row → ✅) + `docs/planning/feature-backlog.md` (K2 ledger) + `plan.md` §4 build log.
- `docs/strategy/session-decisions.md` → the "cut production flag-kill; git-truth revert" decision.

## 12. Build order (for writing-plans)

1. Migration `studio_rollbacks` (+ RLS) - read-tolerant.
2. `buildInverseChanges` pure module + tests.
3. `rollbackRelease` / `abandonChangeset` / `getRollbacks` / `generateRollbackNote` server fns (verify the rollback-mission insert is loop-suppressed first).
4. `studio.revert` tool (review mode) + `agent_tools` seed.
5. `ChangesPanel` controls + rollback-history card.
6. Docs + dashboards + decision log.

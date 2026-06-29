# Build to Ship Lifecycle: Gap Map

> _Created: 2026-06-19 · Last updated: 2026-06-19_

> **Status: AUDIT ONLY (2026-06-18).** No code changed. This is the capture map the founder asked for: in the loop's Build -> Deploy -> Review -> Ship arc, what data points we capture today, what we miss, and how to capture the rest. Founder reviews this, then we build the high-value pieces in order.
>
> **BUILD UPDATE (2026-06-29, BYO-P3 ✅, lane 1).** The founder greenlit BYO-P3 and all 6 WIs landed, closing the gaps this audit named: **Stage 3 Deploy (the big hole) → captured** (a `deployments` table + `captureDeployments`/`listDeployments` via the provider-agnostic `RepoProvider.readDeployments`: environment + status + URL + commit_sha per deploy); **Stage 4 Ship (draft-only) → publish path exists** (a `changelog_entries` table fed at merge by the `studio_changeset_to_changelog` trigger + the `/changelog` route, so release notes become a real in-app changelog); **the disjoint Build-merge ↔ PRD-outcome seam → joined** (`studio_changesets.prd_id` self-healed from `artifact_lineage`, `getChangesetByPrd`, and `recordOutcome` now folds the merged release notes into the learning); **the single trust-graduated ship decision + self-correct → built** (WI3: `studio.pr.merge` follows the trust arc behind the default-off `STUDIO_AUTO_SHIP` flag, CI-green + eval gates still enforced; WI5: self-correct-on-red-CI is emergent via the merge tool's actionable error + the loop's error-feedback). **Still uncaptured (out of P3 scope):** the human GitHub-review thread (Stage 2) — the connector still cannot read PR reviews/comments. Tracked: board G11 / BYO-P3 (✅); plan [`byo-build-implementation-plan.md`](./byo-build-implementation-plan.md) Phase 3.

Owner lane: a NEW initiative (Build-to-Ship lifecycle), separate from the agent-experience work. Engine-Room: this names the outcome ("everything that happens after the agent writes code, captured so the loop can act on it"); the machinery stays behind the Engine Room door.

---

## TL;DR

1. **Build-to-merge is captured with high fidelity.** The Engineer (`builder`) + Review (`qa`) agents stage a multi-file changeset, commit to a `studio/*` branch, open a PR, read CI, self-correct, and merge behind a CI-green gate and operator approval. All of it persists.
2. **Deploy is a complete blind spot.** After merge the product goes dark. There is NO in-product notion of a deployment, an environment (preview / staging / production), a preview URL, a post-deploy health check, or a deploy-level rollback. Grep across the repo confirms "none found." Your "redeploy for testing" and "much beyond git" instinct is correct: we capture nothing there.
3. **The human review thread is not captured.** The merge gate is CI status + a Cadence-native operator approval. GitHub PR review comments, requested-changes, and approvals are never read or stored (the GitHub connector cannot even read reviews).
4. **Ship is draft-only.** The Announce (`release`) agent generates release notes and stores them, but there is no publish path: no changelog page, no release email, no social/PR distribution. The tool names exist (`publish_changelog`, `send_email`, `post_announcement`) with no implementation behind them.
5. **Ship -> Learn is genuinely strong** (do not rebuild it): a shipped PRD records an outcome (validated/missed/mixed + metric), which writes a learning, re-scores the opportunity's ICE, and persists to agent memory. BUT it keys off a **PRD's GitHub issue closing**, which is **disjoint** from the Build-merge / release-notes path. Those two "shipped" notions are not joined. That seam is itself a gap.

The single sentence: **we capture the writing of code and the learning from outcomes, but we capture almost nothing in between (deploy, human review, publish), and the two halves are not linked.**

---

## How this was audited

Four parallel read-only passes over the canonical code (file-referenced, not from memory): Build/Studio capture; Rollback (K2) + Review gate (BLD-05); Ship/launch (release notes, Releases tab); Deploy/connectors + Ship-to-Learn closure. Sources cited inline below.

---

## The lifecycle, stage by stage

Plain agent names are used (slug in parens). Engineer = `builder`, Review = `qa`, Announce = `release`, Measure = `data-analyst`.

### Stage 1 - Build (code) : WELL CAPTURED

| Data point | Captured? | Where | Reference |
|---|---|---|---|
| Multi-file staged changeset | Yes | `studio_changesets` + `studio_changes` (op create/update/delete, base/new content) | `migrations/20260612100000_f_studio_engine.sql` |
| Branch + base SHA | Yes | `studio_changesets.branch`, `.base_sha` | same |
| Commit hash + revision history | Yes | `studio_changeset_revisions` (commit_sha, revision_num) | `migrations/20260616230000_i1b_studio_revisions.sql` |
| PR number + URL + status | Yes | `studio_changesets.pr_number`, `.pr_url`, `.status` (staged/committed/pr_open/merged/abandoned) | `f_studio_engine.sql` |
| Run status / duration / tokens / cost | Yes | `agent_runs` (+ `ai_events` for cost) | `migrations/20260602204826_*.sql` |
| Loop checkpoints (resumable state) | Yes | `agent_run_checkpoints.state` (jsonb) | `migrations/20260603214017_*.sql` |
| HITL approval gates | Yes | `agent_approvals` (tool, args, status, decided_by/at, rationale) | `migrations/20260602205139_*.sql` |
| Per-file exclusive locks | Yes | `builder_file_claims` (unique held claim per repo/path) | `migrations/20260606164458_*.sql` |
| Mission DAG lineage | Yes | `mission_steps` (depends_on, status, result) | `migrations/20260606120924_*.sql` |

Flow + tools: `src/lib/studio.functions.ts`, `src/lib/ai/tools/registry.server.ts` (studioStage / studioCommit / studioPrOpen / githubCiRead / studioPrMerge / studioRevert).

### Stage 2 - Review + merge gate : PARTIAL

| Data point | Captured? | Where | Reference |
|---|---|---|---|
| CI verdict (success/failure/pending/neutral) | Read live, NOT persisted | in-memory at merge time only | `src/lib/ai/studio-ci.ts` (`mergeReadinessFromCi`) |
| Hard merge gate (block on red/pending CI) | Yes | `studioPrMerge` re-fetches CI live | `registry.server.ts` ~1620-1710 |
| Inspector summary (file count, test presence, ci_ran/passed) | Yes (warn-only, never blocks) | `summarizeInspection` -> CiPanel card | `src/lib/ai/studio-inspection.ts`, `src/components/studio/CiPanel.tsx` |
| Operator approval (Cadence-native) | Yes | `agent_approvals` (status, decided_by/at, decision_reason) | `migrations/20260602205139_*.sql` |
| Eval-regression gate | NO (does not exist) | grep for eval/regression/P4 in build path: none | - |
| **Human PR review (comments, approvals, requested-changes, reviewer)** | **NO** | not read, not stored; connector has no reviews API | `src/lib/connectors/providers/github.server.ts` |

Note: the merge gate is **CI-green + Cadence approval**, NOT GitHub-review-gated. J1 "test discipline" is a prompt instruction, not a hard gate; the CI result is the only correctness signal.

### Stage 3 - Deploy : NOT CAPTURED (the big hole)

| Data point | Captured? | Notes |
|---|---|---|
| Deployment event (a release went live) | NO | grep "deploy/deployment": none found in product code |
| Environment model (preview / staging / production) | NO | grep "environment/staging/production": only infra env-vars, no product concept |
| Preview / test deploy URL ("redeploy for testing") | NO | grep "preview": only `input_preview`/`output_preview` UI fields, not deploy previews |
| Deploy status / logs | NO | merge closes the in-product loop; deploy is external (Lovable -> Cloudflare) |
| Post-deploy health / smoke check | NO | grep "health/monitor/alert" in build path: none |
| Deploy-level rollback (roll back a live release) | NO | K2 reverts the COMMIT, not a deployment (see Stage 2b) |

The product itself deploys via Lovable publish -> Cloudflare Workers (`wrangler.jsonc`), but that pipeline is invisible to the product. There is no way for the loop to know a change deployed, to which environment, at what URL, or whether it stayed healthy.

### Stage 2b - Rollback (K2) : CAPTURED, but git-level only

K2 builds a git-truth inverse changeset (create->delete, update->restore parent content, delete->create; capped at 100 files), records it in `studio_rollbacks` (original_changeset_id, revert_changeset_id, reason, status), and dispatches an Engineer run to drive the revert PR through the normal gate. Source: `src/lib/studio-rollbacks.ts`, `migrations/20260618160000_k2_rollbacks.sql`.

Limits: operator-initiated only (no auto-rollback on a failed deploy, because we do not track deploys); reverts the commit, not a live deployment.

### Stage 4 - Ship (announce) : DRAFT-ONLY

| Data point | Captured? | Where | Reference |
|---|---|---|---|
| Release notes (generated) | Yes | `studio_changesets.release_notes`, `.release_notes_at` (Gemini summary of files + commits, regenerable) | `migrations/20260616240000_k1_release_notes.sql`, `generateReleaseNotes()` in `studio.functions.ts` |
| Release notes shown in-app | Partial | collapsible card in the Build surface only (`ChangesPanel`); NOT in the Releases roll-up | `src/components/studio/ChangesPanel.tsx` |
| "Releases" roll-up | Yes (but thin) | completed missions + completed `agent_runs` (duration/cost/tokens); does NOT show release_notes text | `src/components/product/ReleasesPanel.tsx`, `outcome.functions.ts` getOutcomeData |
| **Publish to changelog page** | **NO** | no `/changelog` route; tool name `publish_changelog` has no implementation | - |
| **Release email** | **NO** | no template, no trigger on merge, no recipients (`send_email` is an approval tool name only) | `outcome.functions.ts` LAUNCH_TOOLS |
| **Social / PR / marketing** | **NO** | build-in-public lives in a separate private repo (Buffer); no hook from Ship; only manual `docs/brand-feed.md` | - |

Verdict: Ship drafts and stores, then stops. The "launch" half (notes -> the world) is unimplemented.

### Stage 5 - Learn closure : STRONG (do not rebuild)

A shipped PRD records an outcome and feeds the moat. Fully wired:

- `prds.shipped_at` stamped by the hourly `outcome-tick` when the PRD's GitHub issue closes (`src/routes/api/public/hooks/outcome-tick.ts`).
- `recordOutcome()` writes `prds.outcome` (verdict validated/missed/mixed + metric) and inserts a `learnings` row (`outcome.functions.ts`).
- The linked opportunity is re-scored (ICE confidence +/-2, `prior_ice`/`new_ice` tracked), and the outcome is distilled into agent memory (`rememberOutcome`).
- `suggestOutcomeVerdict()` (Measure / Historian) drafts the verdict by comparing predicted vs actual.

This is the memory-as-moat loop working as designed. **Leave it alone; instead, connect the Build/Deploy/Ship arc into it (see the seam below).**

---

## The seam: two "shipped" that are not joined

There are two independent notions of "shipped," and nothing links them:

1. **Build-merge shipped:** a `studio_changeset` reaches `status = merged` and gets `release_notes`. (Build station.)
2. **PRD-outcome shipped:** a PRD's GitHub issue closes, `prds.shipped_at` is stamped, and an outcome/learning is recorded. (Learn station.)

A Studio merge does not stamp a PRD; the outcome tick watches issues opened from PRDs via `github.issue.create`. So the agent that *wrote and merged the code* and the record that *learns whether it worked* live in different schema paths with no foreign key between them. Joining them is the highest-leverage, lowest-cost fix here, because both ends already exist.

---

## Proposed capture model

Each item marked **[now]** (buildable in-product, no new credentials) or **[gated]** (needs founder: a provider secret, or outbound sending on the founder's accounts).

1. **`deployments` table + a Deploy event.** [gated for the live signal] Columns: id, workspace_id, product_id, changeset_id (FK to the merge), environment (preview/staging/production), status (queued/running/succeeded/failed/rolled_back), commit_sha, deploy_url, provider, started_at, finished_at, triggered_by. The schema + UI are **[now]**; populating it from real deploys needs a Cloudflare/Lovable publish webhook or the GitHub Deployments API (**[gated]** on creds).
2. **Preview deploy URL on the changeset/PR.** [gated] Capture the per-PR preview URL so "redeploy for testing" is a tracked artifact the Review agent and the operator can open before merge. Source: GitHub Deployments API or the Cloudflare preview hook.
3. **Persist the CI verdict.** [now] Today the CI verdict is read live and thrown away. Store the verdict + per-check list on the changeset/revision so the timeline and Learn have it without re-querying GitHub.
4. **Post-deploy smoke check + deploy-level rollback.** [now for the check shape; gated for the provider rollback call] A small health step (hit the deploy URL or a `/health` endpoint), record pass/fail on the deployment, and on fail offer a deploy-level rollback (distinct from K2's commit revert).
5. **Human review-thread capture.** [now] Extend the GitHub connector with a read of PR reviews (comments, requested-changes, approvals, reviewer) and surface them on the Review step. This makes the Review agent and the merge gate aware of human review, not just CI.
6. **Ship publish path.** Implement the three drafted-but-dead tools:
   - In-app changelog page (`/changelog` + a `changelog_entries` table fed from `release_notes`). [now]
   - Release email (template + trigger + recipient list). [gated] (outbound)
   - Social / PR via the build-in-public Buffer bridge. [gated] (founder accounts; never auto-post)
7. **Join Build-merge -> release -> PRD outcome.** [now] Add the missing link (e.g. `studio_changesets.prd_id` or a release record that references both the merged changeset and the PRD), so a merged build flows into the existing, strong Learn loop automatically. Highest leverage.

---

## Sequenced build plan (proposed, after founder review)

- **Phase 1 (all [now], no creds, high leverage):** (7) join Build-merge to PRD outcome; (3) persist CI verdict; (5) human review-thread capture; (6a) in-app changelog page. Closes the seam and the review blind spot with zero external dependencies.
- **Phase 2 ([gated] on deploy provider):** (1) `deployments` table + Deploy event from a Cloudflare/Lovable webhook or GitHub Deployments API; (2) preview deploy URL; (4) post-deploy smoke + deploy-level rollback.
- **Phase 3 ([gated] on outbound):** (6b) release email; (6c) social/PR via the Buffer bridge, always founder-approved, never auto-sent.

---

## Explicitly NOT a gap (do not rebuild)

- Changeset / commit / revision / PR / CI-gate / approval capture (Stage 1) - solid.
- K2 git-level rollback (Stage 2b) - solid for what it is; only deploy-level rollback is missing.
- File-claim concurrency locks - solid.
- Ship -> Learn outcome loop (Stage 5) - strong; the work is to feed it, not rebuild it.

---

## Founder decisions needed before Phase 2/3

1. **Deploy signal source:** wire a Cloudflare/Lovable publish webhook, or read the GitHub Deployments API? (Affects which credential you provide.)
2. **Outbound on Ship:** do you want release email + social/PR wired at all, or keep Ship as draft-only with a human always pressing publish? (Founder accounts + sending are involved.)
3. **Scope of "deploy":** track only the product's own deploys, or eventually the user's product deploys too (multi-tenant deploy tracking)?

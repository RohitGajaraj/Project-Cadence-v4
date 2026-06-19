# Studio → **Build**: the in-platform development engine (F-STUDIO)

> _Created: 2026-06-12 · Last updated: 2026-06-18_

> **NAMING (2026-06-12 night):** the user-facing surface is now **Build** (`/build`, `/build/$missionId`; `/studio/*` redirects), screen 9 of the Ember Editorial migration, founder ruling. Everything internal in this doc (`studio.*` tools, functions, tables, the F-STUDIO feature id) keeps its name per the CLAUDE.md rename disclaimer. Read "Studio" below as the engine, "Build" as what users see.

> **Status:** ✅ code landed + verified lint/tsc/build (2026-06-12) · **runtime gate:** migration `20260612100000_f_studio_engine` applies via Lovable sync (KI-08 pattern), golden-path QA + demo inclusion follow the apply · **Decision log:** see `docs/strategy/session-decisions.md` 2026-06-12 entries
> **Supersedes:** the "Builder" handoff UX (Bundle 9, `docs/features/bundle-9-builder.md`). The Builder *agent* and its tables remain as legacy internals. See "Naming & legacy equivalence" below.

## What it is

Studio is where validated work becomes shipped code, **inside the platform**. Signals → PRDs used to end at "Send to Builder" (a human). Studio replaces that seam with a headless development engine plus a first-class human surface: it reads the bound GitHub repo, plans, stages multi-file changes, opens PRs, reads CI, self-corrects, and merges behind a review gate, model-agnostic, governed by the existing approval/trust stack.

**Two doors, both first-class.** Usage is forecast ~80% agents / ~20% humans, but that is a usage expectation, not a design hierarchy:

- **Agent door**: structured work order in (`dispatchStudioSession`: PRD/opportunity/raw prompt + constraints), structured outcome out (changeset, PR URL, CI verdict, cost) consumed by the mesh, lineage, and Brain. Sessions run unattended; gates queue asynchronously.
- **Human door**: `/studio`: live session timeline, natural-language steering mid-session (the Claude Code/Cursor interaction), Monaco diff review, inline approvals, model switcher.

Anything reachable by prompt is reachable by contract, and vice versa.

## Naming & legacy equivalence (ruling 2026-06-12)

User-facing name is **Studio** everywhere: nav, "Send to Studio", agent display name, docs. Internal legacy identifiers are **not** migrated (zero-risk, same pattern as legacy-rename): `agent_slug='builder'`, `builder_file_claims`, `build.functions.ts` remain and are to be read as ≡ Studio. New code uses `studio.*` naming natively. The Prompt Studio cost bucket (`CallSurface 'studio'`) is unrelated and unchanged.

## Architecture

Studio is built ON the existing runtime: no new orchestrator, no new chokepoint, no direct LLM calls.

```
work order (PRD / opportunity / NL prompt / A2A handoff)
   └─ dispatchStudioSession  →  mission + agent_run (slug 'builder', display Studio)
        └─ agent loop (loop.server.ts: checkpoints, approvals, memory, ticks)
             ├─ repo.tree / repo.read / repo.search        (auto)    ← reads repo via GitHub API
             ├─ studio.stage                               (auto)    ← edits land in DB changeset, NOT GitHub
             ├─ studio.commit                              (confirm) ← Git Data API → isolated studio/* branch
             ├─ studio.pr.open                             (confirm) ← multi-file PR from changeset branch
             ├─ github.ci.read (existing)                  (auto)    ← checks; self-correct loop on red
             └─ studio.pr.merge                            (review)  ← closes the loop in-platform
        └─ outcome: mission output JSON + lineage edge (prd→mission) + auto-reflect learning
```

- **All model calls** go through `callModel` (chokepoint) inside the loop under surface `'agent'`: governance, budgets, BYOK, cost tracking inherited. No new `CallSurface` literal.
- **Workers 10s budget** is honored by the existing checkpoint-before-every-step + tick-resume machinery (`agent-tick`, `resume-runs`, `approvals-tick`). Tick pickup hardening is in scope (see §Tick hardening).
- **Auth**: every GitHub call resolves through `resolveProviderAuth` (workspace binding → user connection → env fallback). Never read `GITHUB_TOKEN` directly.
- **Gates** match the v4 HITL canon: GitHub writes = `confirm`, merge = `review`; composes with the per-user autonomy dial. High-risk override forces at least `confirm` for `studio.commit`/`studio.pr.open` and `review` for `studio.pr.merge`.

## Data model (migration `f_studio_engine`)

```sql
studio_changesets (
  id uuid pk, user_id uuid, workspace_id uuid, product_id uuid null,
  mission_id uuid references missions, repo text,
  branch text null, base_sha text null,
  status text check in ('staged','committed','pr_open','merged','abandoned') default 'staged',
  title text, summary text null, pr_url text null, pr_number int null,
  created_at, updated_at
)
studio_changes (
  id uuid pk, changeset_id uuid references studio_changesets on delete cascade,
  user_id uuid, path text, op text check in ('create','update','delete'),
  base_content text null, new_content text null, base_sha text null,
  created_at, updated_at, unique (changeset_id, path)
)
```

RLS on both: workspace-member scoped (follow `is_workspace_member` pattern used by sibling tables) + user-scoped writes. One **active** changeset per mission (the latest non-abandoned row; tools upsert into it).

Same migration: `UPDATE agents SET name='Studio', system_prompt=<dev-engine prompt> WHERE slug='builder'`, update the seed functions that create the builder agent (default seed + `seed_demo_workspace`) to use display name "Studio" + the new prompt, and enable default tool modes for the new tools (`repo.*`, `studio.stage` = auto; `studio.commit`, `studio.pr.open` = confirm; `studio.pr.merge` = review).

## Tools (added to `TOOL_REGISTRY`, standard ToolDef shape: zod args, category, plain-language `preview`, idempotent `run`)

| name | args | behavior |
|---|---|---|
| `repo.tree` | `{ path?, ref? }` | Git Trees API (recursive); returns paths+types+sizes, cap ~400 entries with truncation notice |
| `repo.read` | `{ paths: string[] (max 8), ref? }` | Contents API per path; returns decoded contents, flags binaries/too-large |
| `repo.search` | `{ query }` | GitHub code search scoped to the bound repo; path + fragment per hit |
| `studio.stage` | `{ changes: [{path, op, content?}], title?, summary? }` | Upserts into the mission's active changeset (creates it lazily). Snapshots `base_content`/`base_sha` from the repo on first stage of a path. **No GitHub write.** Forbidden paths rejected here (`.github/`, `supabase/migrations/`, lockfiles, `.env*`) |
| `studio.commit` | `{ message }` | Creates branch `studio/<mission-short-id>` from default-branch head if absent; Git Data API blobs→tree→commit→ref for ALL staged changes; claims every path in `builder_file_claims`; sets changeset `committed` + `branch`/`base_sha` |
| `studio.pr.open` | `{ title, body }` | Opens PR from the changeset branch; sets `pr_open` + `pr_url`/`pr_number`. Distinct from legacy single-file `github.pr.open` (untouched) |
| `studio.pr.merge` | `{ method? = 'squash' }` | `PUT /pulls/{n}/merge`; sets `merged`; releases file claims |

All tool outputs XML-wrapped as untrusted (existing convention). All GitHub mutations wrapped in `withIdempotency`.

## Server functions (`src/lib/studio.functions.ts`, new file)

- `dispatchStudioSession({ prdId?, opportunityId?, prompt?, model? })` → `{ missionId }`. Builds the work order (PRD body + acceptance criteria + linked issue via the 3-way resolution pattern from `dispatchBuilderMission`), creates mission + run for slug `builder`, records lineage edge `prd → mission` (extend `ArtifactKind` with `'mission'`). Both legacy dispatch paths (SpecsPanel, PRD detail) re-point here.
- `listStudioSessions()` → sessions: mission, status, title, linked PRD, changeset status, `pr_url`, cost, updated_at. Includes legacy builder missions (history continuity).
- `getStudioSession({ missionId })` → mission + runs + steps (from run checkpoints/steps), active changeset + changes (paths/ops/stats), pending approvals, latest CI snapshot.
- `steerStudioSession({ missionId, message })` → inserts an `agent_messages` row (steer payload); the loop injects unconsumed steers into the system context at the next step and marks them consumed. This is the mid-session NL steering.
- `getChangesetDiff({ changesetId })` → changes with `base_content`/`new_content` for the Monaco DiffEditor.
- `refreshStudioCi({ missionId })` → runs the CI read against the changeset PR, returns checks.

Approvals reuse the existing `agent_approvals` resolve/execute functions. Studio renders them inline.

## Loop changes (`loop.server.ts`, surgical)

1. `maxStepsFor`: slug `builder` (Studio) → 24 steps.
2. Steer injection: at each step, read unconsumed steer `agent_messages` for the mission; append as operator guidance; mark consumed.

## Surface (`/studio`)

- `src/routes/_authenticated.studio.index.tsx`: session list (status tone, PRD chip, PR link, cost) + composer: NL prompt textarea, optional PRD picker (approved PRDs), `ModelSwitcher`, dispatch button. Empty state explains the two doors.
- `src/routes/_authenticated.studio.$missionId.tsx`: session detail:
  - **Left:** conversation/timeline, steps with thought + tool preview lines (live via existing query polling/refetch pattern used by mission cockpit), steering composer at the bottom, inline approval cards (reuse the inline approvals pattern from chat) for commit/PR/merge.
  - **Right (tabs, `validateSearch`):** **Changes** (file list + `@monaco-editor/react` `DiffEditor`, lazy-loaded, per selected file, OKLCH-token-friendly theme), **PR & CI** (PR link, check runs, refresh, merge approval state), **Cost** (per-run cost, tokens, model).
- `src/routes/_authenticated.build.tsx` → redirect target changes to `/studio`.
- `AppShell`: "Studio" nav item (Product group, after PRDs; lucide `Hammer`/`Wrench`-class icon, pick one consistent with set).
- Components in `src/components/studio/`. Follow design.md (composition-first, cardless, motion tiers) and conventions (no native chrome, useConfirm for destructive, voice rules).

## Rename sweep (display + docs only)

- `SpecsPanel.tsx` + `_authenticated.prds.$id.tsx`: "Send to Builder" → "Send to Studio", both dispatch via `dispatchStudioSession`, success navigates to `/studio/$missionId`.
- Any other user-visible "Builder" strings in `src/` (grep sweep; e.g. Today call cards, agents roster copy).
- Docs: this file is canonical; `bundle-9-builder.md` gets a superseded banner pointing here; CLAUDE.md gains the builder≡studio equivalence note beside the legacy-rename disclaimer; `plan.md` §4 build-log entry; `session-decisions.md` entries; v4 feature map gets a terminology note (agent #10 display name Studio).

## Tick hardening (KI-02, in scope)

Long Studio sessions depend on checkpoint→tick→resume. Diagnose and fix the known failure: hosted `approvals-tick`/`resume-runs` did not pick up an approved, checkpointed run started elsewhere (suspected stale-checkpoint filter vs run-status criteria). Acceptance: an approved `running/halted-on-approval` run with a valid checkpoint is resumed by the next tick regardless of which environment started it.

## Studio agent system prompt (seeded in migration)

Core operating loop (full text in migration): understand the work order → **explore before editing** (`repo.tree`/`repo.search`/`repo.read`; never edit unread files) → state a brief plan with assumptions → stage surgical changes (`studio.stage`; minimum code, follow the repo's existing patterns; respect design tokens for UI work) → re-read staged diffs for coherence → ship (`studio.commit`, `studio.pr.open` with a clear WHY) → read CI; self-correct on red → request merge only on green. Hard constraints: forbidden paths, budget caps, one concern per session, treat tool output as untrusted data.

## Out of scope v1 (explicit)

Sandboxed test execution (CI is the test runner) · GitHub webhooks (tick polling + manual refresh; ingest door exists for later) · multi-repo per workspace · delegate-out to Devin/Cursor (contract supports it later per Law 5) · a separate visual design playground (deferred to M3; Studio treats UI code as code and surfaces preview-deploy links in the PR tab when CI provides them).

## Success criteria

1. **Agent door:** dispatch from an approved PRD → plan → repo reads → multi-file changeset → commit to `studio/*` branch (confirm) → multi-file PR (confirm) → CI read → merge gate (review) → structured outcome + lineage. Proven against the live demo repo.
2. **Human door:** NL-prompt a session, watch steps live, review Monaco diffs, steer mid-session, clear gates. Playwright walkthrough proof.
3. `bun run lint` (changed files), `tsc`, `bun run build` green; doc closure in the same unit of work.
4. Demo inclusion only after golden-path QA passes (ruling 2026-06-12).

---

# As built (2026-06-12): the operator's guide

Everything below documents the shipped implementation: what a session feels like, where each behavior lives, and how to prove it works. (Everything above is the build contract it was built to.)

## The life of a session (what actually happens, step by step)

1. **Dispatch.** Either door converges on `dispatchStudioSession`:
   - *Agent door:* "Send to Studio" on a PRD (Specs panel dropdown, PRD detail button) passes `{prdId}`. The work order embeds the PRD body as the source of truth plus the linked GitHub issue ("Closes #N") when one exists.
   - *Human door:* the composer at the top of `/studio`: plain-language prompt, optional approved-PRD picker, model switcher.
   Dispatch is **queue-then-return**: it creates the mission, inserts the run as `status='queued'` (chosen model stamped on the run row), records the `prd → mission` lineage edge, and immediately returns `{missionId}`. Nothing blocks.
2. **Start.** The `resume-runs` sweeper (pg_cron, every minute) promotes the queued run and the agent loop begins under the Studio system prompt: seeded in the migration, slug still `builder`, 24-step budget.
3. **Explore → plan → stage.** The agent maps the repo (`repo.tree`), finds relevant code (`repo.search`), reads every file it will touch (`repo.read`, the prompt forbids editing unread files), states a plan, then `studio.stage`s full file contents into the mission's changeset. **Staging is a DB write only**: `studio_changesets` + `studio_changes` rows, base contents snapshotted from the repo on first stage of each path, forbidden paths (`.github/`, `supabase/migrations/`, `.env*`, lockfiles) rejected at the tool boundary. GitHub is untouched.
4. **The commit gate.** `studio.commit` is confirm-gated, and it is a **pausing gate**: the loop checkpoints the conversation, flips the run to `waiting_approval`, and stops. The approval appears inline on `/studio/$missionId` *and* in Today's "Needs you" calls queue. Approving executes the tool: branch `studio/<mission-short-id>` created off the default-branch head, all staged changes shipped as one commit via the Git Data API (blobs → tree → commit → ref), every path claimed in `builder_file_claims` so parallel sessions can't collide.
5. **Resume.** The next sweeper tick (≤1 min) sees the gate is decided *and executed*, re-enters the loop from the checkpoint, and injects the tool's actual result into the conversation (tracked by approval id in checkpoint state, so re-resumes never double-inject). Rejection injects too. The agent is told nothing ran and adjusts or finalizes.
6. **PR → CI → merge.** Same pause/resume dance: `studio.pr.open` (confirm) opens the multi-file PR from the changeset branch; `github.ci.read` (auto) checks the verdict; on red the agent stages a fix and commits again to the same branch; on green it requests `studio.pr.merge`, **always review-gated, the autonomy dial cannot soften it**. Merging releases the file claims and stamps the changeset `merged`. **`studio.pr.merge` is hard-gated twice (P4-GATE):** the J2 CI gate (`studio-ci.ts`, refuses while CI is red or pending) AND an eval-regression gate (`eval-gate.ts`, refuses when the latest completed eval run for any suite is ≥10 points below the prior one, on the 0-100 scale). Both are read-only readiness checks the agent cannot override; the eval gate reads the scheduled eval trend (it never triggers a run) and is a no-op until a suite has two completed runs. The operator can always merge from GitHub directly.
7. **Finalize.** The agent ends with a structured summary (what shipped, PR URL, CI verdict, deferred items); the mission completes; auto-reflection writes the lesson to agent memory.

**Steering at any point:** the composer at the bottom of the session timeline inserts an `agent_messages` row with `kind='steer'`; the loop drains unconsumed steers into the conversation at the top of its next step. That is the Claude Code / Cursor mid-session interaction.

## Where to find it

- **`/studio`**: session list (5s live poll; `waiting_approval` renders as "waiting on you" in amber) + composer. Command palette: "Studio" · shortcut **G B**. `/build` redirects here.
- **`/studio/$missionId`**: left: live timeline (thoughts, tool calls with status chips, finals, steers interleaved) + inline approve/reject gate cards + steering composer. Right tabs (`?tab=`): **Changes** (file list + per-file Monaco diff, lazy-loaded; the revision history carries a confirm-gated **Revert** button per prior revision, K2 below), **PR & CI** (link, checks, refresh, merge-gate pointer), **Cost** (per-run model/tokens/$ + total).

### K2: one-action rollback (revert to a revision)

The revision history (one row per `studio.commit`) carries a **Revert** button on every revision except the latest, shown only while the branch is live (`committed` / `pr_open`). It is **non-destructive**: `revertToRevision` (in `studio.functions.ts`) resolves GitHub auth for the changeset's workspace (`resolveGitHub`) and calls the shared `revertChangesetToRevision` helper (`src/lib/ai/studio-revert.server.ts`), which creates a NEW commit whose tree is the target revision's tree, parented on the current branch head, then fast-forwards the ref (`force:false`). History only ever moves forward, so the revert is itself a normal, revertible commit, and a stale-parent race is refused by GitHub rather than clobbering work. The revert is recorded as the next revision row. The operator initiating it is the authorization (same human-in-the-loop posture as the agent's gates). **Deferred (K2b):** a `studio.revert` agent engine-tool (needs an `agent_tools` migration to gate it) and a feature-flag kill (no flag system is tied to changesets yet).
- **Today → "Needs you"**: Studio gates surface in the existing calls queue automatically (they are ordinary `agent_approvals`).
- **PRD detail / Specs panel**: "Send to Studio".

### BLD-05: Inspector gate (test + preview before merge)

Before the operator clears the merge gate, the PR/Checks tab shows an **Inspector card**: total files, test files, an "includes tests" / "no tests" badge, and the CI verdict (ran / passed). It answers "is this change tested, and what is about to merge?" at the moment the human decides. The logic is the pure, unit-tested `summarizeInspection` (`src/lib/ai/studio-inspection.ts`); `getStudioSession` computes the summary from the changeset's touched paths + the CI verdict and returns it as `inspection`; `CiPanel` renders the card. "Preview" here is the pre-merge inspection summary, not a deploy preview (deploy is external). **Warn-only:** a change with no test files is flagged prominently but never hard-blocked (founder ruling 2026-06-18) since docs/config changes legitimately ship no tests. It complements, and does not duplicate, the J2 CI gate and the P4 eval-regression gate.

## Trust & governance (operator terms)

| Action | Gate | Who can change it |
|---|---|---|
| Read repo (tree/read/search), stage changes | auto | per-tool mode in Agents settings |
| `studio.commit`, `studio.pr.open` | confirm | floor: dial can tighten, never below confirm |
| `studio.pr.merge` | review | hard floor: not overridable |

Every model call rides the existing chokepoint (`callModel`, surface `'agent'`): guardrails, budgets, BYOK, cost logging all inherited. Every GitHub mutation is idempotent (`withIdempotency`): a worker eviction or re-approval never double-commits, double-opens, or double-merges. All tool output re-enters the loop XML-wrapped as untrusted.

## Graceful degradation & known windows

- **No GitHub connection** → `repo.*`/`studio.*` tools fail with the `resolveProviderAuth` actionable error (bind a repo on `/sync` or connect GitHub in Settings); dispatch itself still works and the session reports the blocker.
- **Pre-migration window (KI-08 pattern):** until `20260612100000_f_studio_engine` applies via Lovable sync, hosted `/studio` queries and approval inserts error on missing tables/columns. Expected; gates in `active-task.md`.
- **Sweeper cadence is the heartbeat:** queued start and gate-resume each cost ≤1 sweeper tick (1 min hosted). Local dev without the cron: `curl -X POST <app>/api/public/hooks/resume-runs` with the hook secret drives it manually.
- **CI never blocks the platform:** `github.ci.read` snapshots persist as `tool_calls`; the PR tab's Refresh re-reads on demand.
- **Accepted behaviors (audited 2026-06-12, kept by design):** (1) `withIdempotency` caches successes only: a failed GitHub mutation is retryable, and `studio.commit` tolerates partial state (existing branch) on retry; (2) the CI snapshot is owner-scoped by `tool_calls` RLS: a workspace member viewing someone else's session sees no snapshot until they hit Refresh (which reads under their own account); (3) an unattended gate expires after 7 days and the session resumes with a "not executed (expired)" outcome: the agent finalizes with what the operator should know.

## Verify checklist (golden-path QA, gates demo inclusion)

1. Approve a PRD with a linked issue → Send to Studio → lands on `/studio/$missionId` with the work order visible.
2. Watch: repo reads appear as timeline steps; a changeset accumulates files in the Changes tab; diffs render in Monaco.
3. Commit gate appears inline (and on Today) → approve → branch + commit visible on GitHub → session resumes by itself within a minute.
4. PR gate → approve → multi-file PR opens with "Closes #N" → CI verdict appears in the PR tab.
5. Steer mid-session ("also update the README") → the next step acknowledges the guidance.
6. Merge gate (review) → approve → PR merges, claims release, mission completes, `prd → mission` edge visible in lineage.
7. Cost tab shows per-run model/tokens/$; the run honored the model picked at dispatch.

## Implementation map

| Piece | Where |
|---|---|
| Migration (tables, RLS, approval ctx columns, `agent_runs.model`, Studio prompt + tool seeds) | `supabase/migrations/20260612100000_f_studio_engine.sql` |
| Engine tools (`repo.*`, `studio.*`) | `src/lib/ai/tools/registry.server.ts` (§ "Studio engine tools") |
| Loop: 24 steps, steer injection, pause-on-gate, resume outcome injection, gate floors, `executeApproval` mission ctx | `src/lib/ai/loop.server.ts` |
| Steer-vs-handoff separation (`kind='handoff'` filter) | `src/lib/ai/handoff.server.ts` (`consumeInboundHandoff`) |
| Server functions (dispatch/list/get/steer/diff/CI) | `src/lib/studio.functions.ts` |
| `mission` artifact kind (lineage) | `src/lib/lineage.functions.ts` · `src/components/cadence/LineageDrawer.tsx` |
| KI-02 sweeper fixes (NULL checkpoint, `waiting_approval` pickup) | `src/routes/api/public/hooks/resume-runs.ts` |
| Surface routes | `src/routes/_authenticated.studio.{index,$missionId}.tsx` |
| Surface components (timeline, gate cards, changes/CI/cost panels) | `src/components/studio/` |
| Redirect + palette | `src/routes/_authenticated.build.tsx` · `src/components/cadence/CommandPalette.tsx` |
| Legacy internals (kept, ≡ Studio) | `src/lib/build.functions.ts`, `builder_file_claims`, single-file `github.pr.open`/`github.commit.append` |

## Notable history

- **2026-06-12 morning:** spec + decisions logged; 5-agent build launched; session crashed mid-build leaving only the rename sweep (and a stale git rebase + index.lock, cleared at resume).
- **2026-06-12 (this unit):** engine + loop + functions + surface + tick hardening completed in one unit; the pause-on-gate (`waiting_approval`) run state was introduced here. Before this, the loop "continued planning" past queued approvals, which made sequential shipping gates (commit → PR → merge) impossible to run unattended.
- **2026-06-12 (audit):** a 17-agent adversarial workflow (6 finder lenses, per-finding refutation) confirmed 11 findings; 8 fixed in the same unit: pause-checkpoint off-by-one at the step cap, message-only commit idempotency key (swallowed CI-fix commits), `resolveApproval` approving without executing (stranded paused runs from the Today queue), new-signup `handle_new_user` missing the studio tool seeds, steer-consumed-before-checkpoint ordering, double-resume CAS guard, and error states on both `/studio` routes; 3 accepted as design (listed under Graceful degradation). Studio also became a first-class sidebar entry (Product group) per founder ruling, and the local smoke walkthrough passed (nav, surface, redirect, rename, legacy-session list, clean console).
- Supersedes Bundle 9's handoff UX (`bundle-9-builder.md` carries the banner); the Builder agent internals live on underneath.

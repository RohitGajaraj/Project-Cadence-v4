# Autonomous Build Loop (standing playbook)

> _Created: 2026-06-17 · Last updated: 2026-06-18_

> Reusable operating procedure for an unattended or semi-attended build run. It is the canonical source of the contract, the per-item loop, the gates, the doc-loop, collision safety, context continuity, and the retry/resilience rules. The live status of any active run lives in [`../planning/archive/overnight-build-report.md`](../planning/archive/overnight-build-report.md).
>
> **Invoke it** with `/overnight-build` (see section 11), any night, going forward. This file is the rules; the report is the run.

---

## 1. When to use

When the founder wants the backlog worked autonomously across a long unattended window (overnight, away-from-keyboard), with work landing safely and a status report they can check on return. It is also the reference for any session that wants to run the same disciplined build cadence by hand.

## 2. The contract (defaults; a run may override)

- **Autonomy:** build, commit, push. Requires hands-off permission mode (Shift+Tab to "bypass permissions on"; the denylist in `.claude/settings.local.json` still blocks destructive commands even under bypass).
- **Scope:** the whole backlog minus founder-gated items.
- **Blocked or founder-gated item:** skip it and queue it in the report. Never let one item block the loop.
- **Isolation:** work in an isolated git worktree branched off `origin/main`; fast-forward push to `main` when clean. Work still lands on main; collisions with parallel sessions cannot happen.
- **Decisions (autonomous mode):** when a step would normally surface options for the founder to choose, pick the best option on the available data and proceed; record the choice and the rationale in `session-decisions.md` and the report. Defer (skip and queue) only founder-gated calls: taste/positioning, spend, accounts/credentials, or anything irreversible or outward-facing. In manual mode, surfacing options to the founder is the default.

## 3. Scope and priority order

Resolve the next item from, in order:

1. **v10** master blueprint + v10 implementation plan + the feature dashboard (P0 to P2 lanes, file-disjoint).
2. When v10-derived buildable items are exhausted, mine **v9**, then **v8**, then earlier strategy docs for anything still relevant and buildable. Add each newly surfaced item as a row in the feature dashboard before building it, so the master view stays the single source of truth.

**Founder standing rulings (2026-06-18), durable, do not re-ask. The full live version lives in the single source of truth: [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md).**

1. **Build everything buildable WITHOUT founder input FIRST, migrations included.** Close every autonomous loop before anything that needs the founder. A migration that needs no taste/secret/spend/account decision is fair game (gate offline, flag for publish-verify). Do not park autonomous work as "gated" just because it is risky or involves a migration; only true founder dependencies are gated.
2. **Order the autonomous queue by STRATEGIC IMPACT against the CURRENT positioning, not by buildability.** Pick the single highest-impact item that advances the North Star (genuine autonomous end-to-end execution), the launch wedge, or the memory/decision moat. Never spend effort on a low-impact, easy item (e.g. a health endpoint) ahead of a strategy-advancing one. Point out the #1 and why before building.
3. **Cross-reference the canon before claiming scope.** Never call the backlog "thin" or "done" from a narrow scan. Read v10 blueprint → v10 implementation plan → the SSOT → the dashboard → v9 → v8 → v7 → v6 → `../planning/considerations.md` (cross-cutting gaps the dashboard omits) → the code, weighting recent positioning over superseded, and verify built-vs-pending against `src/`.
4. **The design / UX-polish pass is LAST, and done ONCE**, only on the finalized product, never as a repeated activity (do not redo design and burn tokens). Do not run it until the foundation is built and the founder says the product is final. `F-IA-*` IA consolidation is bundled with it.
5. **Founder-gated work comes AFTER the autonomous foundation:** taste / positioning / product-tasting, secrets, OAuth registration, infra/sandbox picks, recurring AI spend, the founder's accounts, outbound sending, anything irreversible/outward-facing. Keep a clean pickup list in the SSOT; never do these unilaterally.
6. **Context authority:** the loop may compact / clear / roll its own context whenever heavy, on its own judgement, noting the roll in the handoff, only at clean boundaries between items, never mid-build.
7. **The SSOT ([`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md)) is the front-door tracker.** Reconcile status / queue / deferrals / findings / progress there every cycle; the dashboard and this report are detail/machine views.

**Founder-gated (always skip):** Stripe secrets, OAuth client registration, infra picks (sandbox provider), analytics OAuth, and anything needing the founder's accounts or a taste/scope/positioning decision.

Prefer file-disjoint lanes so a cycle never touches another in-flight lane.

## 4. The per-item loop

For each item:

1. **Sync:** `git fetch`, rebase the worktree on `origin/main`. This runs before every cycle, so each cycle automatically picks up any founder or Lovable pushes, including security fixes, and never works on stale data. (Per-cycle sync is enough; no mid-cycle re-pull rule.)
2. **Plan:** read the item spec + linked detail. State the approach, the assumptions, and the success criteria. Take the necessary decisions; do not wait on the founder for anything that is not founder-gated.
3. **Claim:** add the item to the report as in-progress.
4. **Build:** surgical changes only; every line traces to the item. Follow the two-files-in-lockstep convention (server function + route) and the existing patterns.
5. **Gate:** `bunx tsc --noEmit` (the real typecheck; `bun build` skips it), then `bun run build`, then `bun run lint`. All must pass before commit.
6. **Adversarial review:** run a skeptical self-review (or parallel reviewer agents) against the diff. Fold every real fix. This is the "plan and take necessary edits" step, done before the work is trusted.
7. **Doc-loop:** update every doc the change touches (section 6).
8. **Commit + push:** stage explicit paths only, never `git add -A`. One clear WHY line. Fast-forward push to main; if the push is rejected because origin advanced, rebase the worktree and retry. If the rebase conflicts on source code, keep the commit local and flag it in the report rather than forcing anything.
9. **Report + handoff:** update the report (done / notes / completion %), and the handoff if rolling over.

## 5. Gates (non-negotiable)

**Per-cycle correctness gate (always, the K2-incident floor):** `tsc --noEmit` + `bun run build` + the feature's tests + the adversarial RUNTIME-FATAL review + (for migrations) a prod dry-run. A green correctness gate is the definition of "verified". If it fails, route to section 8 (resilience), never to a silent commit.

**Velocity ruling (founder, 2026-06-19): deferrable quality passes are batched to a founder-prompted end-stage, NOT run per cycle.** Do not spend per-cycle effort/tokens on: authored-content humanization scanning (em/en dashes, AI-template phrasing) in docs/comments/build-log prose (write clean by habit, Tier 2 in [`../conventions/humanized-output.md`](../conventions/humanized-output.md)); repo-wide lint / prettier / style cleanup and style-only lint findings (do not introduce NEW correctness lint errors, but do not chase the pre-existing backlog); AI-trace / observability polish; deep doc prose-polish; the §14 design pass. The runtime humanization sanitizer stays ON (it guards user-facing generated output). As launch nears, **prompt the founder** to kick off the deferred batch; do not auto-run it. Canonical: [`../../AGENTS.md`](../../AGENTS.md) §3 "Velocity ruling".

## 6. Doc-loop checklist (a build is not done until these are true)

- [ ] **Feature dashboard** (`docs/planning/feature-dashboard.md`): row flipped to the new status; Active-claims cleaned; At-a-glance counts recomputed.
- [ ] **`plan.md` section 4:** build-log entry appended (the append-only history).
- [ ] **v10 master blueprint + v10 implementation plan:** status updated if the item maps to a tracked lane or milestone gate.
- [ ] **The feature's own detail doc** under `docs/features/`.
- [ ] **`docs/strategy/session-decisions.md`:** an entry if the cycle made a strategic decision or a real tradeoff.
- [ ] **`docs/brand-feed.md`:** append ONLY if a genuinely postable build insight surfaced (high bar, high signal, would make a real social post, not a build log). Include the capture cue.
- [ ] **The overnight report** (always, every cycle).

## 7. Context continuity and handoff

- Roll the context window over at **clean boundaries (between items), never mid-build.**
- Before starting a new item, check headroom. If it is low, finalize the current commit, write the full handoff, then roll to a fresh leg, then start the next item. This is how a "new session with proper instructions" happens before a new build, not during one.
- Handoff = the live report (`docs/planning/overnight-build-report.md`), committed every cycle; it is the single resume-from-here doc. A separate `.remember` handoff is not maintained (founder ruling, 2026-06-18): we stay in one session and the report, dashboard, and `plan.md` already carry the full state, so a handoff file would be redundant. If the session ever dies, a fresh session reads the report first. After a rollover, disk is the source of truth, not the in-memory summary.
- A forced mid-build compaction is the safety net, not the plan: work is already committed and handed off, so nothing is lost.
- **One continuous session (founder decision, 2026-06-18).** The loop runs in a single session: each cycle is a scheduled wakeup (`ScheduleWakeup`) that fires a new turn in the SAME session, and the harness auto-compacts when the context fills. This keeps one session log and one cumulative metrics view (input / output / cost). Outcome drift from lossy compaction is prevented by design: every cycle re-grounds from disk (the report, dashboard, plan.md, and the handoff), so decisions never depend on the in-context summary. Because the cycles are part-by-part with minimal carry-forward, compaction loses nothing that matters. A genuinely fresh session is only a fallback if this session dies; it resumes from the same disk artifacts.
- **Compaction: rely on the harness, never self-schedule `/compact` (corrected 2026-06-18).** A scheduled or manual `/compact` does compact the session, but it does NOT hand a turn back to the loop, so the loop silently pauses until someone types `/overnight-build` again. This was proven on 2026-06-18: a `ScheduleWakeup(prompt="/compact")` test compacted cleanly but the loop only resumed because the founder typed `/overnight-build` by hand. So do NOT schedule `/compact` as a cadence step (the earlier "proactively /compact every 2 cycles" rule is retired for this reason). Instead: let the harness auto-compact transparently when context fills (it continues the loop in the same session, no pause), and bridge each cycle with `ScheduleWakeup(prompt="/overnight-build")`, which fires a fresh turn that continues building. This keeps one session and one cumulative metrics view, with no pause risk. Token cost stays bounded because each cycle re-grounds from disk and carries little forward, so the harness compaction at the natural limit loses nothing that matters.

## 8. Resilience and retry

- **Rebase recovery: never manually `git commit` during a paused rebase (learned 2026-06-19).** If `git rebase origin/main` stops on a conflict, resolve + `git add` + `git rebase --continue` and let the rebase FINISH, or `git rebase --abort` and redo cleanly. Do NOT run a plain `git commit` while the rebase is paused: that commits onto the detached HEAD outside the rebase's tracking, so the rebase state lingers (a permanent "rebase in progress" / detached HEAD) and the branch ref is left stranded at its pre-rebase commit even though the work pushes fine. Also: a worktree's rebase state lives in `<repo>/.git/worktrees/<name>/rebase-merge/`, NOT `<worktree>/.git/rebase-merge/` (the worktree's `.git` is a file) - check it with `ls "$(git rev-parse --git-dir)/rebase-merge"`. To recover when the branch is stranded but `origin/main` is already correct: `git rebase --quit` (clears the orphaned state, keeps HEAD), then `git checkout -B <branch> origin/main` to re-attach the branch. If `git rebase --continue` errors with "you must edit all merge conflicts" while `git status` shows no `UU` files, prefer `git rebase --abort` + redo over a manual commit.
- **Usage limit / quota / session-window expiry (not a code problem):** do not halt, do not fail the item. If the limit message states a reset time, schedule the wake to just after it (reset plus about a minute) and resume exactly where you left off (`ScheduleWakeup`). **If the reset time is not known, re-check on a sub-five-minute cadence (`ScheduleWakeup`, ~270s), NOT every 30 minutes** (founder ruling, 2026-06-18). The only wait that may exceed five minutes is one timed precisely to a KNOWN reset stamp; an unknown-reset poll is always sub-five-minutes so the loop resumes the instant the window reopens.
- **Cadence (while the session window is open):** build fast. Roll straight from one item to the next; if a break is genuinely needed (for example a clean context-boundary roll), keep it under five minutes. Never slow to a long idle cadence because the backlog looks thin. A thin backlog means pick the next most important item or start the design pass, not wait.
- **Real build-gate failure (code broke tsc/build/lint):** attempt a bounded fix (2 to 3 tries). If still red, revert the item's changes, skip the item, queue it in the report with the error text, and move to the next buildable item. The item is parked; the loop never dies.
- **Thin or exhausted backlog:** do NOT slow down or idle. Pick the next most important item, including ones that need a migration (build them pre-migration-tolerant; the founder syncs later) or are otherwise harder, in priority order (v10, then v9, then v8). Only when genuinely nothing buildable remains, run the design-quality pass (section 14). The full-product humanization sweep (HUMAN-SWEEP) is deferred to the very end, done as one complete scan once everything is built, never mid-build.

## 9. Stop and pause conditions (narrow by design)

> **⛔ STANDING INSTRUCTION (founder, 2026-06-18, non-negotiable, repeated): the loop NEVER pauses, halts, idles, or "schedules a wakeup and stops" on its own. Only the founder ends the run, manually.** A thin or seemingly-exhausted backlog is NOT a stop condition: skip founder-gated items and build the next non-gated one down the v10 → v9 → v8 priority list (migrations, visual work, and loop-coupled items all count, build them, gate offline, flag for publish-verify). The ONLY wait is a real usage-limit/session reset, and even then the re-check is sub-five-minutes (section 8), never a 30-minute or hourly sleep. Do not invent reasons to wait ("better with the founder watching", "needs visual verification", "nothing clean left"); those are reasons to flag-and-continue, not to pause. _(History: the loop wrongly scheduled 30 then 60 minute waits on 2026-06-18 after wrongly concluding the backlog was exhausted; the founder corrected it. Do not repeat.)_

- **Pause and auto-resume** for: usage limits only (sub-five-minute retry per section 8).
- **Stop and wait for the founder** only for: a destructive or outward-facing action that needs them, or an explicit founder stop. (Backlog "exhausted" does NOT stop the loop; keep building down the priority list, then the design-quality pass, section 14.)
- Everything else (a failing item, an ambiguous item, a gated item) routes to skip-and-continue. The loop does not halt over a single item, and it does not halt because items look hard.

## 10. Status reporting

- Live report: [`../planning/archive/overnight-build-report.md`](../planning/archive/overnight-build-report.md), rewritten every cycle: completion %, items done with notes, in-progress, skipped with reason, comments.
- Check it: `git pull`, then open the report. The commit trail (`git log --oneline`) is the second view.
- **Date AND time every entry (contract, project-wide).** Every row in the report (done, skipped, pending-verification), every `plan.md` build-log entry, and every dashboard status flip carries its date and time (`YYYY-MM-DD HH:MM`, 24h, read from `date "+%Y-%m-%d %H:%M"`) and the cycle, so the record is a timestamped audit trail of what was done and exactly when (the git commit also carries its own timestamp). Capture the build-start or commit time. Accumulate across runs; never erase a prior night's entries. **This date-plus-time rule applies project-wide, not only to the overnight loop (founder ruling, 2026-06-18); the mirror lives in `docs/operations/git-discipline.md` under "Timestamp Discipline".** Forward-only: apply it to entries written from 2026-06-18 onward; do NOT retro-stamp the day-one history (founder ruling, 2026-06-18), spend no tokens backfilling old rows; a date-only past is fine.
- **UI breadcrumb per item (contract).** Every shipped item in the report (and in its feature doc) carries a one-line "where to see it" navigation path so the founder can verify it from the UI at a glance: just the path, no explanation. For example `Settings > Data > Download workspace export`, or `Engine Room > Attention`, or `Missions > Agents > Agent inspector`.

## 11. How to run and re-invoke

There are two ways to operate, and they differ only in who makes the choices.

**Autonomous mode (overnight or away).** Hands-off, self-paced, takes its own option-calls.
1. **Shift+Tab** to **"accept edits on"** (it auto-accepts file edits within the workspace). **The loop must NEVER stall on a permission prompt** (it runs while the founder is away). Two settings in `.claude/settings.local.json` guarantee this: (a) a broad command allowlist (git, bun, bunx, npx, perl, bash, and the read utilities) plus a destructive denylist (force-push, reset --hard, rm -rf); and (b) `additionalDirectories` set to the repo root, so writes anywhere in the repo are trusted, including the parent repo's `.remember/`. That second one is the gotcha that bit once: a worktree's cwd is the worktree, so a write to the parent repo (outside the workspace) prompts unless the repo root is a trusted directory. **Standing rule:** if any command or path ever prompts, add it to the allowlist or `additionalDirectories` immediately and continue (founder pre-authorized); never wait on the founder for a permission. A "bypass permissions" mode removes prompts entirely; the worktree's `.claude/settings.local.json` now sets `"defaultMode": "bypassPermissions"` (the destructive denylist still applies), which is the bulletproof default for unattended runs.

   **Two corrections (2026-06-18) that had been silently causing prompts mid-run:**
   - **The session reads the WORKTREE's own `.claude/settings.local.json`, not the parent repo's.** A git worktree carries its own gitignored local settings; tuning the parent repo's copy does nothing for the worktree session. Configure the worktree's copy directly: broad command allow + destructive deny + `additionalDirectories` for BOTH the parent root AND the worktree root + `defaultMode: bypassPermissions`.
   - **Worktree-paths-only.** Operate entirely under the worktree path; never edit through parent-repo absolute paths. A compaction summary may hand you parent paths (`…/Project-Cadence-v4/docs/…` instead of `…/overnight-build/docs/…`), ignore them and use the worktree copy. Reaching into the parent tree (a) can trigger a permission prompt (it sits above the worktree root) and (b) contaminates the founder's live WIP on `main` while leaving your edit out of your own worktree commits. After any rollover, re-anchor on the worktree absolute path before the first Read/Edit/Write.
   - **Which settings file the session reads = the directory it was LAUNCHED from (root vs worktree), not where the work lands.** A loop driven from a session started at the repo root reads the ROOT's `.claude/settings.local.json`, so the bypass + allow/deny must be set there too (it was missing there on 2026-06-18 and prompted on every call). **Set `defaultMode: bypassPermissions` + the allow/deny in BOTH the repo root and the worktree.** The shared allow/deny also lives in the committed `.claude/settings.json`, so a **regular daytime build** is covered as well. Full model, the deny-list floor, and setup: [`permissions.md`](./permissions.md).
2. Type **`/overnight-build`**.

That one command tells the loop: read this playbook, pick the top buildable item in priority order, plan and decide, build, gate, adversarially review, run the doc-loop, commit with a why, push, retry through usage limits, roll context at clean boundaries, and keep the report current. Nothing else is needed.

**Manual mode (daytime, founder in the chair).** Stay in normal or "accept edits on" mode.
- Say **`pick <ID>`** (for example "pick K2") or describe the task.
- The same per-item discipline runs once (plan, build, gate, review, doc-loop, commit, push), but options are surfaced for the founder to choose rather than auto-decided.
- No loop, no self-pacing: one item at a time, founder-driven.

**Stop or pause.** Interrupt the session or say stop. Pausing leaves the report and the handoff current, so the next run resumes cold from disk.

## 12. Model and effort

- **Model:** Claude Opus 4.8 with the 1M-token context window (`claude-opus-4-8[1m]`). The large window is what lets a long unattended run hold the playbook, the dashboard, and the working set across many cycles.
- **Effort:** run at high effort by default; escalate to the top tier for the hard steps (planning, architecture and design decisions, adversarial review, debugging a red gate); dial down for mechanical steps (doc-loop edits, formatting, routine moves) to conserve budget. When the loop spawns subagents, pass effort per step the same way: top effort for the skeptical reviewer, lower for mechanical scans.
- The founder has authorized full autonomy over this model and effort modulation for autonomous runs. Correctness first, budget-aware second.

## 13. Published-app verification (what may be tested live, and what must wait)

The live app does not reflect a change until the founder publishes it. During an unattended run the founder is away, so this run's own changes are not live yet. The rule has two cases:

1. **This run's unpublished changes:** do NOT test them against the live app. They are not deployed, so a "failing" live test is meaningless and only burns tokens. Never juggle or debug a not-yet-published feature. Verify them offline only: `tsc --noEmit`, `bun run build`, `bun run lint`, and the adversarial review. That green gate is the definition of done for an unattended cycle.
2. **Behavior that is already on the published app:** you MAY test it. If a check is about a feature or behavior already deployed (not introduced by this run), go ahead and run it against the live app and report the result. Already-live behavior is fair game.

**For every item that needs the founder's build, record it in the report's "Pending published-app verification" table, dated, and classify it:**

- **Quick-check now (already live):** if the relevant behavior is already on the published app, give a short numbered go-through so the founder can make a quick call and verify it themselves, no new publish needed.
- **Needs publish first:** the change is this run's own work and must be published before it can be verified. Note it and move on; verify it once the founder publishes and says so.

When uncertain whether something is already live, do NOT juggle or burn tokens guessing: halt that test, make a clear dated note in the report, and notify the founder. This is a standing contract rule, not a one-night exception.

## 14. Design-quality pass (the last step, when the backlog is dry)

When no buildable backlog item is left (v10 through v8 mined, founder-gated items skipped) and nothing else is pending, do NOT idle. Switch to a design-quality pass and hold the product to a launch-ready, consumer-grade bar: could this ship to a paying customer tomorrow?

- **Run the design-craft skills against the brand canon.** Use the available design skills (impeccable, emil-design-eng, design-taste-frontend, high-end-visual-design, gpt-taste, stitch-design-taste, make-interfaces-feel-better, redesign-existing-projects) and judge against the brand guidelines: the Ember system + [`../conventions/design-context.md`](../conventions/design-context.md), [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md) (calm front, deep engine; name the outcome), [`../conventions/home-and-today-ia.md`](../conventions/home-and-today-ia.md), [`../conventions/ui-voice.md`](../conventions/ui-voice.md), and [`../conventions/humanized-output.md`](../conventions/humanized-output.md).
- **Audit, surface by surface:** structure and information hierarchy, category and section placement, typography (font, size, weight), spacing and positioning, color combinations and contrast, motion (craft, not absence), and responsive behavior.
- **Customer-experience lens:** is it easy, friendly, and obvious? Does it overcomplicate what it is trying to say? Run all copy through the voice + humanized-output gate (no AI fingerprints, no em or en dashes, plain outcome-named language). Read it as a first-time customer would.
- **Same discipline.** Treat each design finding as a buildable item: surgical change, gate (`tsc --noEmit` + build + lint), adversarial review, doc-loop, commit + push, and a dated report entry. Work findings top-down by impact.
- This is also the fallback whenever nothing else is pending: pick up the design pass rather than stop.

## 15. Lane-scoped parallel mode (multi-worktree, file-disjoint)

Several worktrees can build in parallel off `origin/main` at once (the WM/overnight lane plus a few feature lanes). A worktree is a **scoped lane** when `.remember/LANE.md` exists at its root (that path is git-ignored, so it never commits). The overnight WM worktree has no such file, so this section is a no-op for it. In lane mode the whole playbook still governs (per-cycle `git fetch` + rebase on `origin/main`, the section 5 correctness gate, the section 6 doc-loop, adversarial review, the section 8 rebase-recovery rule, bypass permissions, the section 8 sub-five-minute usage-limit retry), with these overrides:

1. **Read `.remember/LANE.md` first, every cycle.** It declares the lane name, the ordered build queue (item IDs, built top-down), the OWNED paths (create or modify only these), the FORBIDDEN paths, and the lane's own report file. Build only the queued items, in order.
2. **Never leave your lane.** Touch only OWNED paths. NEVER touch a FORBIDDEN path. Forbidden always includes the AI chokepoint and agent core (`src/lib/ai/runtime.server.ts`, `loop.server.ts`, `tools/registry.server.ts`, `cache.server.ts`, `memory.server.ts`), the WM tenancy/billing/credit files, and the other lanes' owned files. If an item would require a forbidden file, SKIP it, note why in the lane report, and take the next queued item.
3. **Write to the lane's own report file** named in `LANE.md` (`docs/planning/archive/parallel-report-<lane>.md`), NEVER `overnight-build-report.md` (that is the WM lane's and is rewritten every cycle; sharing it is the number-one collision source).
4. **Shared-doc discipline (this is what keeps the rebase clean).** `plan.md` section 4 and `session-decisions.md` are APPEND-ONLY. In `feature-dashboard.md`, on ship, flip ONLY your own item's register row (a single-line edit); do NOT recompute the global At-a-glance counts (one owner reconciles those later, since two sessions recomputing the same line is a guaranteed conflict). Your claim already sits in the Active-claims table.
5. **Stop-and-report when the lane queue is DRY. This overrides section 9's never-stop rule for lane mode.** A scoped lane must NOT roam into another lane's category or into the chokepoint to find work; roaming is exactly how parallel sessions collide. When no buildable, non-forbidden, non-founder-gated item remains in the queue, write a final report entry ("lane dry, awaiting reassignment") and stop. The founder extends the queue or reassigns. The section 14 design pass is also off-limits in lane mode (it is a whole-product, single-owner activity).
6. **One command.** Launch is identical to the WM lane: from inside the lane's worktree, `/overnight-build`. This section is what makes that single command self-scope to the lane.

## 16. Worktree selection at launch (never auto-build outside a known lane)

A bare `/overnight-build` first detects WHICH context it is in, with git, and routes by a POSITIVE ALLOWLIST: it BUILDS only in a known lane, and ASKS everywhere else. This is purely additive (the WM/overnight lane and the daytime manual `pick <ID>` mode are unchanged) and it composes with section 15.

Resolve the worktree root first, so a call from a subdirectory still classifies correctly:
`WT_ROOT="$(git rev-parse --show-toplevel)"` and `BR="$(git rev-parse --abbrev-ref HEAD)"` (note: a detached HEAD returns the literal string `HEAD`, not a branch name).

Then, in order:

1. **Manual override (highest precedence).** If THIS invocation carries an explicit `pick <ID>` (an operator-supplied item on this run), honor it: manual mode, build that item, skip the rest of this section. Ambient mentions of an ID in memory/context do NOT count; only an explicit `pick` argument on this run.
2. **Scoped lane.** Else if `[ -f "$WT_ROOT/.remember/LANE.md" ]`, this is a scoped parallel lane: proceed per section 15 (read `LANE.md`, build its queue, stay in lane), silently, no prompt.
3. **WM / overnight lane.** Else if `BR` is `overnight/wm`, this is the original overnight lane (no `LANE.md` by design): proceed with the full whole-product loop (sections 3 through 14).
4. **Everything else: ASK, never auto-build.** Else (the primary `main` checkout, a detached `HEAD`, a `parallel/*` branch whose `LANE.md` is missing, or any ad-hoc branch): do NOT build here. Building on the shared primary, or on an unscoped branch, is the exact collision the lane model prevents. Instead:
   - List the lanes + worktrees: `wm` (overnight-build), `cockpit` (cadence-cockpit), `knowledge` (cadence-knowledge), `safety` (cadence-safety), `build` (cadence-build).
   - ASK the founder which lane to launch (one line; do not assume).
   - On their pick, run `bash scripts/parallel-build.sh <lane>`, which opens that worktree's terminal and AUTO-STARTS its loop via a bootstrap prompt (a slash command cannot be passed at launch, so the script passes a natural-language instruction that invokes this skill). Then stop here.
   - Never build directly on `main` or on an unscoped branch from this context.

Why a positive allowlist (build only in cases 2 and 3): absence of `LANE.md` does NOT mean "not a lane" (the WM worktree is a real lane that lacks it), and the unhandled contexts (detached HEAD, a `parallel/*` branch whose `LANE.md` is missing) must fail safe to ASK, never to an implicit whole-product build on the wrong branch. Every lane worktree should carry its own `.remember/LANE.md` so case 2 catches it; case 4 is the safety net.

---

_Related: [`../../AGENTS.md`](../../AGENTS.md) (operating rules, doc-update protocol), [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (the master status board), [`git-discipline.md`](./commits.md), [`commits.md`](./commits.md), [`memory.md`](./memory.md)._

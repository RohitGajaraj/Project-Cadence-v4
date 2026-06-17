# Autonomous Build Loop (standing playbook)

> Reusable operating procedure for an unattended or semi-attended build run. It is the canonical source of the contract, the per-item loop, the gates, the doc-loop, collision safety, context continuity, and the retry/resilience rules. The live status of any active run lives in [`../planning/overnight-build-report.md`](../planning/overnight-build-report.md).
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

`tsc --noEmit` + `bun run build` + `bun run lint` + adversarial review. A green gate is the definition of "verified". If the gate fails, route to section 8 (resilience), never to a silent commit.

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
- **Proactive compaction every 2 cycles (founder ruling, 2026-06-18).** After every two successfully shipped cycles (each fully committed and pushed), initiate a compaction at that clean boundary before starting the next cycle, rather than letting context balloon until the harness auto-compacts near the limit. This bounds token cost while keeping one session. Only ever compact between cycles, never mid-build. Everything needed to resume is already on disk (the report), so compaction loses nothing.

## 8. Resilience and retry

- **Usage limit / quota / session-window expiry (not a code problem):** do not halt, do not fail the item. Read the reset time from the limit message and schedule the wake to just after it (the reset time plus about a minute), then resume exactly where you left off (`ScheduleWakeup`). If the reset time is not known, poll: re-check roughly every 30 minutes until the window reopens, then continue. This timed-to-the-reset wait is the ONLY case where a wait approaches 30 minutes.
- **Cadence (while the session window is open):** build fast. Roll straight from one item to the next; if a break is genuinely needed (for example a clean context-boundary roll), keep it under five minutes. Never slow to a long idle cadence because the backlog looks thin. A thin backlog means pick the next most important item or start the design pass, not wait.
- **Real build-gate failure (code broke tsc/build/lint):** attempt a bounded fix (2 to 3 tries). If still red, revert the item's changes, skip the item, queue it in the report with the error text, and move to the next buildable item. The item is parked; the loop never dies.
- **Thin or exhausted backlog:** do NOT slow down or idle. Pick the next most important item, including ones that need a migration (build them pre-migration-tolerant; the founder syncs later) or are otherwise harder, in priority order (v10, then v9, then v8). Only when genuinely nothing buildable remains, run the design-quality pass (section 14). The full-product humanization sweep (HUMAN-SWEEP) is deferred to the very end, done as one complete scan once everything is built, never mid-build.

## 9. Stop and pause conditions (narrow by design)

- **Pause and auto-resume** for: usage limits (retry per section 8).
- **Stop and wait for the founder** only for: a destructive or outward-facing action that needs them, or an explicit founder stop. (Backlog exhausted does NOT stop the loop; it routes to the design-quality pass, section 14.)
- Everything else (a failing item, an ambiguous item, a gated item) routes to skip-and-continue. The loop does not halt over a single item.

## 10. Status reporting

- Live report: [`../planning/overnight-build-report.md`](../planning/overnight-build-report.md), rewritten every cycle: completion %, items done with notes, in-progress, skipped with reason, comments.
- Check it: `git pull`, then open the report. The commit trail (`git log --oneline`) is the second view.
- **Date AND time every entry (contract, project-wide).** Every row in the report (done, skipped, pending-verification), every `plan.md` build-log entry, and every dashboard status flip carries its date and time (`YYYY-MM-DD HH:MM`, 24h, read from `date "+%Y-%m-%d %H:%M"`) and the cycle, so the record is a timestamped audit trail of what was done and exactly when (the git commit also carries its own timestamp). Capture the build-start or commit time. Accumulate across runs; never erase a prior night's entries. **This date-plus-time rule applies project-wide, not only to the overnight loop (founder ruling, 2026-06-18); mirror it into `docs/operations/git-discipline.md` so every tool follows it.**
- **UI breadcrumb per item (contract).** Every shipped item in the report (and in its feature doc) carries a one-line "where to see it" navigation path so the founder can verify it from the UI at a glance: just the path, no explanation. For example `Settings > Data > Download workspace export`, or `Engine Room > Attention`, or `Missions > Agents > Agent inspector`.

## 11. How to run and re-invoke

There are two ways to operate, and they differ only in who makes the choices.

**Autonomous mode (overnight or away).** Hands-off, self-paced, takes its own option-calls.
1. **Shift+Tab** to **"accept edits on"** (it auto-accepts file edits within the workspace). **The loop must NEVER stall on a permission prompt** (it runs while the founder is away). Two settings in `.claude/settings.local.json` guarantee this: (a) a broad command allowlist (git, bun, bunx, npx, perl, bash, and the read utilities) plus a destructive denylist (force-push, reset --hard, rm -rf); and (b) `additionalDirectories` set to the repo root, so writes anywhere in the repo are trusted, including the parent repo's `.remember/`. That second one is the gotcha that bit once: a worktree's cwd is the worktree, so a write to the parent repo (outside the workspace) prompts unless the repo root is a trusted directory. **Standing rule:** if any command or path ever prompts, add it to the allowlist or `additionalDirectories` immediately and continue (founder pre-authorized); never wait on the founder for a permission. A "bypass permissions" mode, if available, removes prompts entirely and is also fine.
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

---

_Related: [`../../AGENTS.md`](../../AGENTS.md) (operating rules, doc-update protocol), [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (the master status board), [`git-discipline.md`](./git-discipline.md), [`commits.md`](./commits.md), [`memory.md`](./memory.md)._

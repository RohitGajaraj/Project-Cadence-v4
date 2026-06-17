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

## 3. Scope and priority order

Resolve the next item from, in order:

1. **v10** master blueprint + v10 implementation plan + the feature dashboard (P0 to P2 lanes, file-disjoint).
2. When v10-derived buildable items are exhausted, mine **v9**, then **v8**, then earlier strategy docs for anything still relevant and buildable. Add each newly surfaced item as a row in the feature dashboard before building it, so the master view stays the single source of truth.

**Founder-gated (always skip):** Stripe secrets, OAuth client registration, infra picks (sandbox provider), analytics OAuth, and anything needing the founder's accounts or a taste/scope/positioning decision.

Prefer file-disjoint lanes so a cycle never touches another in-flight lane.

## 4. The per-item loop

For each item:

1. **Sync:** `git fetch`, rebase the worktree on `origin/main`.
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
- Handoff target: `.remember/remember.md` (overwrite at every milestone and before any rollover) plus the live report. After a rollover, disk is the source of truth, not the in-memory summary.
- A forced mid-build compaction is the safety net, not the plan: work is already committed and handed off, so nothing is lost.

## 8. Resilience and retry

- **Usage limit / quota / session expiry (not a code problem):** do not halt, do not fail the item. Schedule a retry on a roughly 30 minute cadence (`ScheduleWakeup`, 1800s). The loop auto-resumes the moment the limit clears, and continues on its own.
- **Real build-gate failure (code broke tsc/build/lint):** attempt a bounded fix (2 to 3 tries). If still red, revert the item's changes, skip the item, queue it in the report with the error text, and move to the next buildable item. The item is parked; the loop never dies.
- **Out of buildable items:** mine the next strategy doc (section 3). Only when all are exhausted, write a final handoff and idle with a periodic re-check.

## 9. Stop and pause conditions (narrow by design)

- **Pause and auto-resume** for: usage limits (retry per section 8).
- **Stop and wait for the founder** only for: a destructive or outward-facing action that needs them, an explicit founder stop, or the entire backlog exhausted.
- Everything else (a failing item, an ambiguous item, a gated item) routes to skip-and-continue. The loop does not halt over a single item.

## 10. Status reporting

- Live report: [`../planning/overnight-build-report.md`](../planning/overnight-build-report.md), rewritten every cycle: completion %, items done with notes, in-progress, skipped with reason, comments.
- Check it: `git pull`, then open the report. The commit trail (`git log --oneline`) is the second view.

## 11. How to run and re-invoke

1. Enable hands-off mode: **Shift+Tab** until the footer reads **"bypass permissions on"**.
2. Start the run: **`/overnight-build`** (or a self-paced `/loop` with the build prompt). The loop reads this playbook, then begins cycle 1.
3. Stop: interrupt the session, or say stop. Pausing leaves the report and handoff current so the next run resumes cold.

---

_Related: [`../../AGENTS.md`](../../AGENTS.md) (operating rules, doc-update protocol), [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (the master status board), [`git-discipline.md`](./git-discipline.md), [`commits.md`](./commits.md), [`memory.md`](./memory.md)._

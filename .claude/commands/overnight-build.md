---
description: Start the autonomous overnight build loop (reads the playbook, builds the backlog unattended, self-paced)
---

Read `docs/operations/autonomous-build-loop.md` in full and run it as a self-paced loop.

**Contract:** build + commit + push; whole backlog minus founder-gated; skip-and-queue blocked items; work in an isolated worktree off `origin/main` with fast-forward push to `main`.

> **HARD GATES (non-negotiable, no exceptions).** A 2026-06-18 incident: a session built K2 straight on `main`, committed it with 5 `tsc` + 6 `lint` errors (red build) AND 5 runtime-fatal defects, and still marked the dashboard row `✅ verified`. Every clause below exists to make that impossible.
> 1. **Never commit a red tree.** Before ANY commit: run `bunx tsc --noEmit` AND `bun run lint` AND the feature's tests. If ANY is not clean, you MUST NOT commit. Fix (bounded: 2 to 3 tries) or revert and skip-and-queue the item with the error. A green build is a precondition for commit, not a nice-to-have.
> 2. **Never commit on `main` directly.** Build only in the isolated worktree off `origin/main`; the only thing that touches `main` is a fast-forward push. If you are about to commit on `main`, stop.
> 3. **Honesty: never over-claim status.** The dashboard `✅` legend means *built, on main, AND verified*. Mark a row `✅` ONLY when the gates are green AND the behavior was actually verified. If a feature cannot be run/verified locally (no AI key, no GitHub App, no live data), mark it `◐` "wiring built, live-verify pending on next publish", NEVER `✅`, and NEVER write "verified" / "shipped working" / "all passing" for code you did not run. A "Verification:" line in `plan.md` §4 states only what you actually executed (e.g. "tsc 0, lint clean, N tests"), never a code-read dressed up as a behavioral test.
> 4. **Adversarial self-review must hunt for runtime-fatal bugs `tsc` cannot see**, Supabase column/table mismatches (the client is untyped), missing `NOT NULL` columns on inserts, RLS policies referencing non-existent columns, and "staged but never driven" gaps where the claim outruns the wiring. Quote file:line evidence; fold every real fix before commit.

**Each cycle:**
1. Sync: `git fetch`, rebase the worktree on `origin/main`. (If `main` has diverged from `origin/main`, ahead AND behind, do NOT force-push; stop and surface it.)
2. Pick the top buildable, file-disjoint item: v10 first, then v9, then v8, then earlier strategy docs. Add any newly surfaced item to the feature dashboard before building it. **Before building, check `origin/main` is not already shipping the same item** (another tool may have built it), if so, skip-and-queue and flag the overlap.
3. Plan and take the necessary decisions (do not wait on the founder unless the item is founder-gated).
4. Build in the worktree (surgical, every line traces to the item).
5. **Gate (HARD, see above): `bunx tsc --noEmit` + `bun run lint` + the feature's tests must ALL pass before you may commit.** `bun run build` too when the change is build-affecting. Red = do not commit.
6. Adversarial self-review against the diff (per HARD GATE 4); fold every real fix.
7. Doc-loop, honestly (per HARD GATE 3): feature dashboard (`◐` not `✅` for anything not behaviorally verified), `plan.md` §4 (Verification line = what you actually ran), v10 master blueprint + implementation plan, the feature's detail doc, `session-decisions.md`, and `brand-feed.md` (only if a genuinely postable insight surfaced).
8. Commit + push from the worktree (explicit paths only, one WHY line; rebase-and-retry if origin advanced; never `--force`).
9. Rewrite `docs/planning/overnight-build-report.md` (done / in-progress / skipped / completion %).

**Resilience:** on a usage-limit / quota / session-expiry failure, do NOT halt; `ScheduleWakeup` ~1800s (30 min) and resume when the limit clears. On a real build failure, bounded fix (2 to 3 tries), else revert + skip + queue the item with the error. Roll the context window only at clean boundaries between items, never mid-build; write the handoff to `.remember/remember.md` before any rollover.

**Continue** via `ScheduleWakeup` until the backlog is exhausted or the founder stops the run. Keep the report current every cycle so it can be checked at any time with `git pull`.

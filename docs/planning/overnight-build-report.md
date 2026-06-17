# Overnight Build Report (live)

> Live status of the autonomous overnight build run. Rewritten every cycle by the loop. The rules behind it: [`../operations/autonomous-build-loop.md`](../operations/autonomous-build-loop.md).
>
> **How to check:** `git pull`, then read this file. Second view: `git log --oneline` for the commit trail.

**Last updated:** 2026-06-17 (run start) · **Maintainer:** the autonomous loop, every cycle.

---

## Run header

| Field | Value |
| --- | --- |
| Status | STARTING |
| Mode | build + commit + push |
| Scope | whole backlog minus founder-gated |
| Blocked-item policy | skip and queue (below) |
| Isolation | worktree branch `worktree-overnight-build`, fast-forward push to `main` |
| Started | 2026-06-17, late session |

## How this works (the contract)

This run operates under the [autonomous build loop playbook](../operations/autonomous-build-loop.md). The short version:

- **Two modes.** Manual (daytime): the founder says `pick <ID>`, one item builds, options are surfaced for the founder. Autonomous (overnight): one command, `/overnight-build`, runs the loop hands-off and self-paced.
- **Each cycle.** Pick the top buildable item (v10, then v9, then v8), plan and decide, build, gate on `tsc --noEmit` + `bun run build` + lint, adversarially self-review, run the full doc-loop, commit with a why, fast-forward push to `main`.
- **Decisions.** In autonomous mode the loop picks the best option on the data and logs the rationale; it defers only founder-gated calls (taste, spend, accounts, anything irreversible) and queues them below.
- **Safety.** Bypass permission mode plus a denylist that blocks destructive commands even hands-off; an isolated worktree so it never collides with parallel sessions.
- **Resilience.** A usage limit pauses the run, it does not stop it: retry on a ~30 minute cadence, auto-resume when the limit clears.
- **Continuity.** Context rolls over only at clean boundaries between builds, with a written handoff first, never mid-build.
- **Model and effort.** Opus 4.8 1M context, top effort on the hard steps, dialed down for mechanical ones.

**How to operate.** Autonomous: Shift+Tab to "bypass permissions on", then `/overnight-build`. Manual: `pick <ID>`. Full detail: playbook sections 11 to 12.

## Completion snapshot (baseline at run start)

Per the feature dashboard At-a-glance (groups G0 to G9), approximate:

| Bucket | Count |
| --- | --- |
| Done | ~52 |
| Partial | ~8 |
| Paused / deferred / blocked | ~5 |
| Pending | ~36 |
| **Approx completion** | **~52 of ~101 tracked rows (~51%)** |

Focus this run: close P1/P2 buildable, file-disjoint items first (v10), then mine v9 and v8 for relevant work.

## Done this run

_(none yet)_

| Item | Lane | Commit | Notes |
| --- | --- | --- | --- |

## In progress

_(none yet)_

## Skipped / queued for the founder

_(none yet)_

| Item | Why skipped | What it needs from you |
| --- | --- | --- |

## Notes and comments

- Run scaffolding created: this report, the [playbook](../operations/autonomous-build-loop.md), the unattended permission allow/deny set, and the isolated worktree. Loop launching.
- The parallel session is active on `main` (it pushed MOAT-METRIC during setup). Isolation via worktree means no collision; work lands on main by fast-forward push.

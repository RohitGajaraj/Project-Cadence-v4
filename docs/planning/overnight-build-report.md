# Overnight Build Report (live)

> Live status of the autonomous overnight build run. Rewritten every cycle by the loop. The rules behind it: [`../operations/autonomous-build-loop.md`](../operations/autonomous-build-loop.md).
>
> **How to check:** `git pull`, then read this file. Second view: `git log --oneline` for the commit trail.

**Last updated:** 2026-06-18 (cycle 4 complete) · **Maintainer:** the autonomous loop, every cycle. Entries are dated so multiple nights stay legible.

---

## Run header

| Field | Value |
| --- | --- |
| Status | ACTIVE (cycle 4 complete; cycle 5 next) |
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
- **Safety.** "Accept edits" mode plus a command allowlist and a denylist that blocks destructive commands; an isolated worktree so it never collides with parallel sessions.
- **Resilience.** A usage limit pauses the run, it does not stop it: retry on a ~30 minute cadence, auto-resume when the limit clears.
- **Continuity.** Context rolls over only at clean boundaries between builds, with a written handoff first, never mid-build.
- **Model and effort.** Opus 4.8 1M context, top effort on the hard steps, dialed down for mechanical ones.

**How to operate.** Autonomous: Shift+Tab to "accept edits on" (the command allowlist covers the rest), then `/overnight-build`. Manual: `pick <ID>`. Full detail: playbook sections 11 to 13.

## Completion snapshot (live)

Per the feature dashboard At-a-glance (groups G0 to G9), approximate:

| Bucket | Count |
| --- | --- |
| Done | ~52 |
| Partial | ~12 |
| Paused / deferred / blocked | ~5 |
| Pending | ~32 |
| **Approx completion** | **~52 of ~101 tracked rows (~51%)** |

Focus this run: close P1/P2 buildable, file-disjoint items first (v10), then mine v9 and v8 for relevant work.

## Done this run

| Date | Item | Lane | Commit | Notes |
| --- | --- | --- | --- | --- |
| 2026-06-18 | U6 (core) | G6 Interop | `99563e7db6` | Workspace data export: Settings > Data downloads the whole workspace as one RLS-scoped JSON (signals, opportunities/decisions, specs, tasks, outcomes, agent memory). tsc + eslint + build all green; adversarial review folded 2 fixes (empty-projects guard, active-workspace pass-through). ◐ remainder: per-section selective export + audit-log. **Pending your publish + live verify (see below).** |
| 2026-06-18 | R3 (core) | G7 Cockpit | `456a6ed777` | Notifications "Attention" feed on the Engine Room (`/govern?tab=attention`): one derived feed of pending approvals, spend nearing/over a cap, and a stalled loop, severity-sorted, each card deep-links to its home. No migration (reads existing loop state). tsc + eslint + build green; adversarial review folded 1 fix (tab order). ◐ remainder: email + digests + prefs + a bell badge. **Pending your publish + live verify (see below).** |
| 2026-06-18 | P7 (core) | G8 Governance | `8a0514e4fd` | Incidents log on the Engine Room (`/govern?tab=incidents`): read-only "what went wrong", failed tool executions + errored auto-pipelines, newest first, each execution links to its trace. No migration. tsc + eslint + build green; adversarial review folded 1 fix (explicit workspace scoping on event_queue). ◐ remainder: guardrail/cost sources + a persistent incidents table. **Pending your publish + live verify (see below).** |
| 2026-06-18 | C4/E7 (core) | G8 Governance | `(this push)` | Agent inspector on Missions > Agents: pick an agent, see its recent run history (status, mission, step, when). Read-only, no migration. tsc + eslint + build green; adversarial review clean (no fix). ◐ remainder: shared/private memory inspector. **Pending your publish + live verify (see below).** |

## In progress

_(none yet)_

## Skipped / queued for the founder

_(none yet)_

| Item | Why skipped | What it needs from you |
| --- | --- | --- |

## Pending published-app verification (needs you to publish, then I verify)

The live app does not reflect this run's changes until you publish them. These items are code-complete and gate-green (tsc + build + lint + adversarial review) but not yet verified on the live app. Per playbook section 13, I do not test this run's unpublished changes against the live app (I may test behavior already deployed). Each item is dated and classified: "needs publish first" (this run's new work) or "quick-check now" (already-live behavior you can verify in a moment). When you publish, tell me and I will run the checks.

| Date noted | Item | When it can be verified | What to check |
| --- | --- | --- | --- |
| 2026-06-18 | U6 workspace export | Needs publish first (new this run) | Settings > Data > "Download workspace export". Confirm the JSON has the expected sections with non-zero counts on a seeded workspace, and that another workspace's data is not present. |
| 2026-06-18 | R3 Attention feed | Needs publish first (new this run) | Engine Room > Attention. With a pending approval (or a near-cap budget), confirm a severity-coded card appears and links to the right tab; confirm "All clear" when the loop is clean. |
| 2026-06-18 | P7 Incidents log | Needs publish first (new this run) | Engine Room > Incidents. With a failed tool execution present, confirm it appears with the error detail and a working "View trace" link; confirm "No incidents" when clean. |
| 2026-06-18 | C4/E7 Agent inspector | Needs publish first (new this run) | Missions > Agents > Agent inspector. Pick an agent, confirm its recent runs render with status/mission/time; confirm the empty state for an agent with no runs. |

## Notes and comments

- **Cycle 1 shipped U6 (core)** (above). Picked autonomously as the top buildable, file-disjoint, no-migration item (P0/P1-tagged trust escape-hatch), avoiding the parallel session's PLG and Gauntlet lanes.
- **Cycle 2 shipped R3 (core)** (above): the in-app Attention feed on the Engine Room. Top remaining buildable, file-disjoint, no-migration item; it derives from existing loop state, so it works the moment you publish.
- **Cycle 3 shipped P7 (core)** (above): the read-only Incidents log on the Engine Room. Derived from existing failure logs, no migration; folded a tenancy fix (explicit workspace scoping on `event_queue`).
- **Cycle 4 shipped C4/E7 (core)** (above): the Agent inspector on Missions > Agents. Read-only run history per agent, no migration; review came back clean (no fix needed).
- **Permission mode:** "accept edits on" plus the command allowlist in `.claude/settings.local.json` is sufficient; no "bypass" needed. Every commit, push, and build this run ran with no prompt. Documented in playbook section 11.
- **Published-app rule (new, playbook section 13):** no live testing during the run; code-complete items needing live verification are listed above for when you publish.
- Run scaffolding (cycle 0): this report, the [playbook](../operations/autonomous-build-loop.md), the permission allow/deny set, and the isolated worktree.
- The parallel session is active on `main`. Isolation via worktree means no collision; work lands on main by fast-forward push (already rebased-and-retried twice cleanly).

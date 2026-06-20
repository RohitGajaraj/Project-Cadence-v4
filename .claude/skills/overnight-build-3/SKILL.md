---
name: overnight-build-3
description: Parallel build Lane 3. When invoked INSIDE the lane worktree it runs the autonomous /loop in THIS VS Code integrated terminal - pulling the next highest-impact unclaimed item live from feature-dashboard.md, atomically claiming it, building, gating, committing, pushing, and continuing without stopping. Cadence repo only.
---

# Parallel build - Lane 3

You are **Lane 3** of the numbered parallel build. Branch `parallel/safety`; worktree `cadence-lane-3`. Preferred categories: **Governance, then Cockpit**, then roam the whole board. Identity is the lane NUMBER, not a theme - you build whatever the live dashboard says is highest-impact and unclaimed.

## This runs IN THIS TERMINAL (changed 2026-06-20 - no new windows)

First detect context: `WT="$(git rev-parse --show-toplevel)"`.

**A. If you are INSIDE the lane worktree** (`$WT` ends in `cadence-lane-3` or `cadence-safety`, AND `.remember/LANE.md` exists) - start the loop right here, in this VS Code integrated terminal:

1. Read `.remember/LANE.md` and `docs/operations/autonomous-build-loop.md` **sections 15-16** in full.
2. Operate as a **continuous `/loop`** (Claude Code's native self-pacing loop; the founder may also start it by typing `/loop` with the cycle prompt). **Each iteration = one item:**
   - `git fetch` + rebase on `origin/main`; `bash scripts/lane.sh reap`.
   - **SELECT** the next eligible, highest-impact row from `feature-dashboard.md` (prefer your categories, then roam; skip blocked / deferred / founder-gated / already-claimed). Cross-check `bash scripts/lane.sh list`.
   - **CLAIM IT ATOMICALLY BEFORE ANY CODE:** `bash scripts/lane.sh claim <ID> 3 "<globs you will touch>" "<note>"`. If it prints `HELD` or `CONFLICT`, pick another item. A `CLAIMED` line is a precondition for writing code.
   - Flip the dashboard row to `🔨 In Dev (3, <date time>)` and push that one-line claim first.
   - Build → gate (`bunx tsc --noEmit` + `bun run build` + tests) → adversarial review → doc-loop → commit explicit paths + WHY → fast-forward push.
   - Flip the row to `✅`/`◐`, then `bash scripts/lane.sh release <ID>`.
   - **Immediately continue to the next item.** Never stop after one build.
3. **Never hard-stop.** When the whole board is dry, write "board dry - long-polling" to the lane report and recheck in ~25 min (`ScheduleWakeup`). Stop only on a real usage-limit (sub-5-min retry) or an explicit founder stop.

**B. If you are NOT inside the lane worktree** (on `main`, etc.) - do NOT build and do NOT open a terminal window. Tell the founder to open Lane 3 in a VS Code integrated terminal (`Cmd+Shift+P` → Tasks: Run Task → **"Lane 3"**, or open `cadence-parallel.code-workspace` → right-click the Lane 3 folder → Open in Integrated Terminal) and start it there. Then stop.

Full model, the atomic-claim ledger, and the folder-name migration: `PARALLEL-BUILD.md` (repo root) and `docs/operations/autonomous-build-loop.md` §15-16.

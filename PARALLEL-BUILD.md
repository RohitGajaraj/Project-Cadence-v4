
# Parallel build - how to run the lanes

> Plain operating manual for running the backlog in parallel across several worktrees at once. The deep rules live in `docs/operations/autonomous-build-loop.md` sections 15-16; this is the "just tell me how to run it" page. **Rewritten 2026-06-20** for the numbered-lane model: lanes pull live from the dashboard, claim atomically, roam the whole board, run in the VS Code integrated terminal, and never stop on their own.

## The one rule

**One lane = one terminal = one worktree = one autonomous `/loop`.** Each lane is a numbered worker (Lane 1..4). It pulls the next highest-impact unclaimed item **live from `docs/planning/feature-dashboard.md`**, **claims it atomically** so no other lane can take it, builds it, and immediately moves to the next - never stopping until you stop it.

## The lane map (the legend)

| Lane | Skill | Folder | Branch | Prefers (then roams the whole board) |
| --- | --- | --- | --- | --- |
| **1** | `/overnight-build-1` | `cadence-cockpit` → `cadence-lane-1` | `parallel/cockpit` | Cockpit, then Governance |
| **2** | `/overnight-build-2` | `cadence-knowledge` → `cadence-lane-2` | `parallel/knowledge` | Sense, Decide, Interop |
| **3** | `/overnight-build-3` | `cadence-lane-3` | `parallel/safety` | Governance, then Cockpit |
| **4** | `/overnight-build-4` | `cadence-lane-4` | `parallel/build` | Build, then Interop |
| **0 - WM** (running) | `/overnight-build` | `overnight-build` | `overnight/wm` | the original whole-product overnight lane |

The lane folders are siblings of this repo, under `~/Projects/My Projects/My Builds/`. **Lanes 1 & 2 keep their `cadence-cockpit` / `cadence-knowledge` folder names until you migrate them** (see "Migrating the folder names" below) - the *number* is the identity, not the folder word. Branch names are stable internal handles and are not renamed.

## How to launch a lane - in the VS Code integrated terminal (the way you wanted)

The loop now runs **in the VS Code integrated terminal**, not a separate macOS Terminal window. Two ways:

**A. VS Code task (one click).** `Cmd+Shift+P` → "Tasks: Run Task" → pick **"Lane 1"** (or 2/3/4, or **"Lanes 1-4: open all"**). Each opens a dedicated integrated-terminal tab in the right worktree and starts that lane's continuous loop. (Open this repo folder in VS Code first so the tasks appear.)

**B. Open the lane folder, then `/loop`.** Open `cadence-parallel.code-workspace` (File → Open Workspace from File) to see all lanes in one window, right-click the lane's folder → **"Open in Integrated Terminal"**, then start the loop by typing:

```
/loop
```

and paste the **lane cycle prompt** (replace `<N>` with the lane number):

> Scoped parallel build Lane `<N>`. One cycle: git fetch + rebase origin/main; `bash scripts/lane.sh reap`; SELECT the next highest-impact eligible item live from `docs/planning/feature-dashboard.md` (prefer this lane's categories, then roam; skip blocked/deferred/founder-gated/already-claimed; cross-check `bash scripts/lane.sh list`); CLAIM IT with `bash scripts/lane.sh claim <ID> <N> "<globs>"` before writing any code (if HELD or CONFLICT, pick another); flip the dashboard row to In Dev and push the claim; build; gate (`bunx tsc --noEmit` + `bun run build` + tests); adversarial review; doc-loop; commit explicit paths with a WHY; fast-forward push; flip the row done and `bash scripts/lane.sh release <ID>`. Then continue to the next item. Never stop after one item; if the board is dry, note it and recheck in ~25 min. Stay in lane via the ledger; never touch FORBIDDEN files.

`/loop` is what makes it pick up the next item by itself, one after another - the thing that was missing before.

> Already sitting inside a lane's worktree terminal? Just type the lane skill (`/overnight-build-1`..`-4`) or `/loop` with the prompt above. It runs the loop **in that terminal** - it does not open a new window.

> Fallback only (non-VS-Code): `bash scripts/parallel-build.sh 3` pops a separate Terminal window. Prefer the VS Code path above.

## Why two lanes never grab the same item (the atomic claim ledger)

A git working tree is a **private** view: a claim written into one worktree's dashboard copy is invisible to the other worktrees until it is committed, pushed, and the others pull. That gap let two lanes pick the same item. The fix is a **shared claim ledger that lives outside every worktree**, at `~/.cadence-parallel/`, with an **atomic** primitive:

- **Claiming = `mkdir` of the item's claim dir**, which the OS does atomically - if two lanes race for the same item, exactly one wins and the rest get `HELD` and pick something else. (Proven by `scripts/lane.test.sh`: 12 concurrent claims → 1 winner.)
- **Each claim also reserves the file globs it will touch.** A claim whose files overlap an active claim is rejected (`CONFLICT`), so even when lanes roam onto *different* items they can never edit the *same files*. This is what lets a lane safely build anything on the board, not just its own category.

Commands (all lanes share one ledger):

```bash
bash scripts/lane.sh list                          # who holds what, right now
bash scripts/lane.sh claim <ID> <laneN> "<globs>"  # atomic claim BEFORE building (0=won 1=held 3=file-conflict)
bash scripts/lane.sh release <ID>                   # free it when the item ships
bash scripts/lane.sh reap                           # auto-free claims from dead sessions (>6h)
```

The lane still mirrors its claim into the dashboard (`🔨 In Dev`) and pushes it, so Lovable and the other tools - which don't read the ledger - also see it. The ledger is the real-time cross-worktree truth; the dashboard claim is the durable, tool-visible record. The static OWNED/FORBIDDEN lists in each `.remember/LANE.md` remain a backstop.

## Are the pinned reservations restrictive? (no - they are temporary)

The ledger holds two kinds of entries:
- **Per-item claims** (the normal case): a lane claims ONE dashboard row + the files it touches, builds it, releases it. Fully dynamic - any lane claims the highest-priority eligible row in ANY category. Nothing is glued to a category.
- **Pinned reservations** (`[pinned]` in `lane.sh list`): a TEMPORARY guard for a lane running WITHOUT the ledger (the old-model Lanes 0/1/2 during the 2026-06-20 transition). They reserve that lane's live files so a new ledger-aware lane can't collide with a session it cannot see.

**Pins are not the design and not permanent.** Each is released the moment its lane adopts the ledger or exits:
- `LANE1-COCKPIT`, `LANE2-KNOWLEDGE` - released when Lanes 1 & 2 migrate to `cadence-lane-1/2`.
- `LANE0-WM` - released when Lane 0 (the WM/overnight lane) stops; releasing it opens **Monetization + Credit** (the biggest open chunk) to roaming.
- `AGENTEXP` - released when the agent-experience worktree is gone.
- `CHOKEPOINT` - the ONE permanent reservation, and it is NOT restrictive: it covers the AI agent core (`runtime.server.ts`, `loop.server.ts`, …), which is never a buildable dashboard item.

So once every lane is on the ledger, the only thing reserved is the chokepoint, and every lane freely picks the single highest-priority item anywhere on the board. Release a pin by hand any time: `bash scripts/lane.sh release <PIN-ID>`. Safely migrate + auto-release a stopped lane: `bash scripts/lane-migrate.sh <src> <dst> <pin> <num>` (it refuses unless the session has truly exited and the tree is clean).

## "Own memory" - what each lane knows

Each lane reads, every cycle: its `.remember/LANE.md` (lane number, branch, report file, preferred categories, claim-glob conventions, OWNED/FORBIDDEN backstop), `docs/planning/SOURCE-OF-TRUTH.md` (the front-door tracker), `docs/planning/feature-dashboard.md` (the live prioritized register = what to build next), `docs/planning/considerations.md` (cross-cutting gaps), and `scripts/lane.sh list` (what every lane is on). That is its working memory of the parent project: priority, what is in flight, what is pending, and what is not yet verified.

## It never stops on its own

A lane does not halt when its preferred category empties - it **roams** to the next eligible item anywhere on the board. When the *whole* board is dry it writes "board dry - long-polling" to its report and **rechecks every ~25 minutes** (a new row, a freed claim, or a founder push wakes it). It stops only on a real usage-limit (sub-5-minute retry) or when you stop it. This is the founder "never idle-stop" ruling, applied to lanes.

## Migrating the folder names (Lanes 1 & 2, when you are ready)

Lanes 1 & 2 are running, so their folders can't be renamed under a live session. When you want the clean `cadence-lane-1` / `cadence-lane-2` names, **stop those two lanes**, then from this repo:

```bash
git worktree move ../cadence-cockpit   ../cadence-lane-1
git worktree move ../cadence-knowledge ../cadence-lane-2
```

Then update the two `cwd` paths in `.vscode/tasks.json` (Lane 1, Lane 2) and the two `path`s in `cadence-parallel.code-workspace`, and relaunch. Lanes 3 & 4 are already on the new names.

## Model switching (and saving tokens)

- **Switch mid-session:** `/model` (Opus 4.8, Sonnet 4.6, Haiku 4.5, Fable 5); `/fast` toggles faster Opus.
- **Pin a lane to a model:** add `--model <id>` to that lane's launch (the task `command`/`args`, or `scripts/parallel-build.sh` `launch_cmd`). A practical split: hard lanes on Opus, lighter lanes on Sonnet.
- Default for a full autonomous lane: Opus 4.8 with the 1M window.

## Monitor / stop

- Every lane commits + pushes to `main` each cycle with a clear WHY; `git log --oneline` is the live trail, and each lane's `docs/planning/archive/parallel-report-*.md` is its status.
- `bash scripts/lane.sh list` shows what every lane currently holds.
- To stop a lane: interrupt or close its terminal. Its last commit is already safe on `main`; `bash scripts/lane.sh reap` frees any claim it was holding.
- **First time:** watch each lane's first cycle confirm its number and claim its item before you walk away. After that it is hands-off.

## Troubleshooting

- **It asks for permission / stalls:** each worktree has `defaultMode: bypassPermissions` in its `.claude/settings.local.json`, plus `~/.cadence-parallel` in `additionalDirectories` so the ledger never prompts. If it still prompts, launch with `claude --dangerously-skip-permissions`.
- **A claim won't go through (`CONFLICT`):** another lane reserved overlapping files - that is the ledger doing its job. Pick a different item.
- **A lane is on the wrong branch:** the worktree must be on its expected branch (`git -C <worktree> branch --show-current`); the loop refuses to build otherwise.
- **The ledger looks stale:** `bash scripts/lane.sh reap` clears dead-session claims (>6h); pinned area-reservations for the running lanes never expire by design.

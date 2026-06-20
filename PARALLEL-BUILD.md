
# Parallel build - how to run the lanes

> Plain operating manual for running the backlog in parallel across several worktrees at once. The deep rules live in `docs/operations/autonomous-build-loop.md` sections 15-16; this is the "just tell me how to run it" page. **Rewritten 2026-06-20** for the numbered-lane model: lanes pull live from the dashboard, claim atomically, roam the whole board, run in the VS Code integrated terminal, and never stop on their own.

## The one rule

**One lane = one terminal = one worktree = one autonomous `/loop`.** Each lane is a numbered worker (Lane 1..4). It pulls the next highest-impact unclaimed item **live from `docs/planning/feature-dashboard.md`**, **claims it atomically** so no other lane can take it, builds it, and immediately moves to the next - never stopping until you stop it.

## The lane map (the legend)

Five equal peer worktrees (`cadence-lane-0` .. `cadence-lane-4`). None is reserved for anything; each claims one item at a time from the ledger.

| Lane | Skill | Folder | Branch | Prefers (then roams the whole board) |
| --- | --- | --- | --- | --- |
| **0** | (open the "Lane 0" task) | `cadence-lane-0` | `overnight/wm` | Monetization, Credit, Foundational |
| **1** | `/overnight-build-1` | `cadence-lane-1` | `parallel/cockpit` | Cockpit, then Governance |
| **2** | `/overnight-build-2` | `cadence-lane-2` | `parallel/knowledge` | Sense, Decide, Interop |
| **3** | `/overnight-build-3` | `cadence-lane-3` | `parallel/safety` | Governance, then Cockpit |
| **4** | `/overnight-build-4` | `cadence-lane-4` | `parallel/build` | Build, then Interop |

The lane folders are siblings of this repo, under `~/Projects/My Projects/My Builds/`. The *number* is the identity, not the folder word; branch names are stable internal handles and are not renamed. Lane 0 used to be the special whole-product "WM/overnight" lane; as of 2026-06-21 it is a normal peer that claims per item like the rest.

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

**Pins are not the design and not permanent.** The four transition pins were released as their lanes migrated to the ledger - **`LANE0-WM`, `LANE1-COCKPIT`, `LANE2-KNOWLEDGE`, and `AGENTEXP` are all GONE** (Monetization + Credit, Cockpit, and Knowledge are fully open to roaming). Current state (2026-06-21):

- **`CHOKEPOINT` - the ONE standing reservation, kept as a SAFETY guard (not a category fence).** It covers the AI agent core (`runtime.server.ts`, `loop.server.ts`, `tools/registry.server.ts`, `cache.server.ts`, `memory.server.ts`). These are never a buildable dashboard "item", and concurrent or incidental edits to them can break the whole product for every lane on its next rebase - so core changes are kept deliberate and single-threaded. If an item genuinely needs a core change, a lane releases the pin, claims those exact globs solo, makes the change with a hard gate + adversarial review, and re-pins.

So every lane now freely picks the single highest-priority item anywhere on the board; only the agent core is held back, for safety. Release any pin by hand: `bash scripts/lane.sh release <PIN-ID>`. Safely migrate + auto-release a stopped lane: `bash scripts/lane-migrate.sh <src> <dst> <pin> <num>` (refuses unless the session has exited and the tree is clean; `FORCE=1` for an operator-confirmed exit).

## "Own memory" - what each lane knows

Each lane reads, every cycle: its `.remember/LANE.md` (lane number, branch, report file, preferred categories, claim-glob conventions, OWNED/FORBIDDEN backstop), `docs/planning/SOURCE-OF-TRUTH.md` (the front-door tracker), `docs/planning/feature-dashboard.md` (the live prioritized register = what to build next), `docs/planning/considerations.md` (cross-cutting gaps), and `scripts/lane.sh list` (what every lane is on). That is its working memory of the parent project: priority, what is in flight, what is pending, and what is not yet verified.

## It never stops on its own

A lane does not halt when its preferred category empties - it **roams** to the next eligible item anywhere on the board. When the *whole* board is dry it writes "board dry - long-polling" to its report and **rechecks every ~25 minutes** (a new row, a freed claim, or a founder push wakes it). It stops only on a real usage-limit (sub-5-minute retry) or when you stop it. This is the founder "never idle-stop" ruling, applied to lanes.

## Seeing who is on what (per-lane current task)

Two views answer "which lane is building which item right now":

```bash
bash scripts/lane.sh board   # per-lane summary: Lane 0..4 -> current item (or idle) + standing reservations
bash scripts/lane.sh list    # every active claim with its file-globs and age
```

Plus the durable, tool-visible mirror: each lane flips its row in `docs/planning/feature-dashboard.md` to `🔨 In Dev (laneN, ...)` and adds an **Active claims** line when it claims, and clears it when it ships - so a `git pull` + open the dashboard also shows who is on what.

## Migrating the folder names (DONE 2026-06-21)

All five worktrees are on the clean `cadence-lane-0` .. `cadence-lane-4` names (done via `scripts/lane-migrate.sh`, which only moves a worktree once its session has exited and its tree is clean - `FORCE=1` for an operator-confirmed exit). Nothing left to migrate. If you ever need to re-migrate a worktree:

```bash
FORCE=1 bash scripts/lane-migrate.sh <oldFolder> <newFolder> <pinId-or-NONE> <laneNum>
```

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

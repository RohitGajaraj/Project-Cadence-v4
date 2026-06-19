# Parallel build - how to run the lanes

> Plain operating manual for running the backlog in parallel across several worktrees at once. Placed at the repo root on founder request so it is easy to find. The deep rules live in `docs/operations/autonomous-build-loop.md` (sections 15-16); this is the "just tell me how to run it" page.

## The one rule

**One lane = one terminal = one worktree = one autonomous loop.** Each lane builds a different set of files, so they never collide. A session is tied to the folder it launched in, so you launch one terminal per lane (a skill, a VS Code task, or a command does this for you).

## The lane map (this is the legend)

| Lane | Skill | What it builds | Worktree folder | Branch |
| --- | --- | --- | --- | --- |
| **1 - Cockpit** | `/overnight-build-1` | R3-PREFS notification prefs, then P7 incidents / cost-incident log | `cadence-cockpit` | `parallel/cockpit` |
| **2 - Knowledge** | `/overnight-build-2` | O1 knowledge-graph explorer, then O3 fact-drift + skill-pack export | `cadence-knowledge` | `parallel/knowledge` |
| **3 - Safety** | `/overnight-build-3` | FND-0.5 agent blast-radius, then FND-0.7 injection classifier | `cadence-safety` | `parallel/safety` |
| **4 - Build** | `/overnight-build-4` | F-BUILDER-MULTIFILE scoped multi-file build | `cadence-build` | `parallel/build` |
| **0 - WM** (running) | `/overnight-build` | Tenancy / billing / credit (the original overnight lane) | `overnight-build` | `overnight/wm` |

The worktree folders are siblings of this repo, under `~/Projects/My Projects/My Builds/`.

## How to launch a lane (pick one way)

**A. Claude Code skill (one command).** In any Claude Code session, type the lane's skill:

```
/overnight-build-1     (or -2 / -3 / -4)
```

It opens that lane's own terminal session and auto-starts the loop. (It does NOT run the build in your current session, so it won't eat your current session's tokens.)

**B. VS Code (your preferred way).** `.vscode/tasks.json` defines one task per lane.
`Cmd+Shift+P` -> "Tasks: Run Task" -> pick **"Lane 1: Cockpit"** (or 2/3/4, or **"Lanes 1-4: open all"**). Each opens its own integrated-terminal tab in the right worktree and auto-starts. (If a task does not appear, open this repo folder in VS Code first.)

**C. Terminal command.** From this repo:

```bash
bash scripts/parallel-build.sh            # interactive menu (1=cockpit .. 4=build, a=all)
bash scripts/parallel-build.sh 1          # open just lane 1 (numbers or names both work)
bash scripts/parallel-build.sh a          # open all 4 lanes at once
bash scripts/parallel-build.sh list       # just print the commands, open nothing
```

It opens a new macOS terminal window per lane (iTerm if running, else Terminal.app) and auto-starts. On a machine without macOS terminal automation it prints the command for you to paste.

> If you are already sitting inside a lane's worktree folder, you don't need any of the above - just type `/overnight-build` and it scopes itself to that lane.

## How do I know which tree I am in?

- `pwd` (the folder name is the worktree, e.g. `cadence-cockpit`) and `git branch --show-current` (e.g. `parallel/cockpit`).
- Each lane session, on its first turn, reads its `.remember/LANE.md` and states its lane out loud.
- It only ever writes to its own report: `docs/planning/archive/parallel-report-<lane>.md`.
- Tip: name each terminal tab. Run once in that terminal: `echo -ne "\033]0;Lane 1\007"`.

## Model switching (and saving tokens)

- **Switch mid-session:** type `/model` and pick (Opus 4.8, Sonnet 4.6, Haiku 4.5, Fable 5). `/fast` toggles faster Opus output.
- **Launch a lane pinned to a model:** add `--model <id>` when launching, e.g. `claude --model claude-sonnet-4-6`. Model ids: `claude-opus-4-8` (and the `[1m]` long-context variant), `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-fable-5`.
- **Token economy across lanes:** you do not have to run every lane on Opus. A practical split: keep the hard lanes (Safety, Knowledge) on Opus and run the lighter lanes (Cockpit, Build) on Sonnet to stretch your budget. To pin a lane, edit that lane's command to `claude --model claude-sonnet-4-6 "..."` (in `scripts/parallel-build.sh` `launch_cmd`, or the `.vscode/tasks.json` task's `command`/`args`).
- The recommended default for a full autonomous lane is Opus 4.8 with the 1M window; lower tiers trade some reasoning depth for cost.

## Running a lane from another tool (Antigravity, Gemini, Codex) - to spare Claude Code tokens

Honest note: the `/overnight-build-*` **skills are Claude-Code-specific** (they live in `.claude/skills` and `~/.claude/skills` and only Claude Code reads them). To run a lane from another tool without burning Claude Code tokens, use the **portable layer that every tool can read**:

1. Open the lane's worktree folder in that tool (e.g. open `cadence-cockpit` in Antigravity).
2. Tell its agent: "Run the lane build" - it follows `AGENTS.md` + the worktree's `.remember/LANE.md` + `docs/operations/autonomous-build-loop.md` sections 15-16 (all tool-agnostic).
3. Or just run `bash <repo>/scripts/parallel-build.sh <lane>` in that tool's terminal.

That tool's session uses **its own** model and token budget, so the parallel lanes do not draw down this Claude Code account.

## Why lanes never collide (one line)

Each lane owns a disjoint set of files (declared in its `.remember/LANE.md`), writes its own report, appends-only to shared docs, and rebases on `origin/main` every cycle - so they fast-forward onto `main` without conflicts. Full rules: `docs/operations/autonomous-build-loop.md` section 15.

## Monitor / stop

- Each lane commits + pushes to `main` every cycle with a clear WHY; `git log --oneline` is the live trail, and each lane's `parallel-report-<lane>.md` is its status.
- To stop a lane: interrupt or close its terminal. Its last commit is already safe on `main`; nothing is lost.
- **First time:** watch each lane's first cycle confirm its lane + pick the right item before you walk away. After that it is hands-off.

## Troubleshooting

- **It asks for permission / stalls:** each worktree has `defaultMode: bypassPermissions` in its `.claude/settings.local.json`, so it should run unattended. If it still prompts, launch with `claude --dangerously-skip-permissions`.
- **macOS opens windows, not tabs:** a forced new tab needs Accessibility permission for Terminal (System Settings > Privacy & Security > Accessibility). Windows need no permission, so that is the default. Use VS Code (option B) for clean tabs with no permission.
- **A skill says the worktree is on the wrong branch:** the launcher refuses to start a lane whose worktree is not on its expected branch - check `git -C <worktree> branch --show-current`.

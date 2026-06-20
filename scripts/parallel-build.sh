#!/usr/bin/env bash
# parallel-build.sh - FALLBACK launcher for the parallel build lanes.
#
# PREFERRED WAY (2026-06-20): run lanes in the VS Code INTEGRATED TERMINAL, not a
# separate macOS Terminal window. Use the "Lane N" VS Code tasks (Cmd+Shift+P ->
# Tasks: Run Task) or open cadence-parallel.code-workspace and right-click a lane
# folder -> Open in Integrated Terminal, then type /loop with the lane cycle
# prompt. This script (which pops a separate Terminal/iTerm window via osascript)
# remains only for non-VS-Code use. See PARALLEL-BUILD.md.
#
# Each lane runs the autonomous /loop in its own git worktree, scoped by that
# worktree's .remember/LANE.md (docs/operations/autonomous-build-loop.md s15-16).
# Choosing a lane = choosing which worktree gets a terminal.
#
# Usage:
#   ./scripts/parallel-build.sh            # interactive numbered menu
#   ./scripts/parallel-build.sh cockpit    # open one lane (wm|cockpit|knowledge|safety|build)
#   ./scripts/parallel-build.sh a          # open every NON-wm lane (one window each)
#   ./scripts/parallel-build.sh list       # just print each lane's launch command (no opening)
#
# Each opened session AUTO-STARTS the loop via a bootstrap prompt. (Verified CLI
# fact: a slash command cannot be passed at launch - `claude "/overnight-build"`
# only seeds text - so we pass a natural-language instruction that invokes the
# overnight-build skill.) macOS only for auto-open: iTerm (if present), else
# Terminal.app. Non-macOS / no osascript -> it prints the command to paste.
#
# Reliability: opens a NEW WINDOW per lane (titled), which is race-free and needs
# no Accessibility permission (a forced new TAB would need the cmd+t keystroke +
# Accessibility). The osascript uses the `on run argv` form so the spaced path is
# passed as a runtime arg and never crosses AppleScript-source quoting. Verified:
# Terminal path on macOS 26.5 / Terminal 2.15. iTerm path uses the current
# documented API (treat as documented-not-run if iTerm is absent).

set -uo pipefail   # NOT -e: an interactive read returning non-zero must not kill us.

ROOT="/Users/rohitgajaraj/Projects/My Projects/My Builds"
PRIMARY="$ROOT/Project-Cadence-v4"

BOOTSTRAP='You are a scoped parallel build lane in THIS worktree. Read .remember/LANE.md and docs/operations/autonomous-build-loop.md sections 15-16, then run as a CONTINUOUS autonomous loop (equivalent to /loop) IN THIS TERMINAL. Each cycle: git fetch + rebase origin/main; bash scripts/lane.sh reap; SELECT the next highest-impact eligible item live from feature-dashboard.md (prefer this lane'\''s categories then roam; skip blocked/deferred/founder-gated/already-claimed; cross-check bash scripts/lane.sh list); CLAIM IT ATOMICALLY with bash scripts/lane.sh claim <ID> <laneN> "<globs>" before writing any code (if HELD or CONFLICT, pick another); flip the dashboard row to In Dev and push that claim first; build; gate (bunx tsc --noEmit + bun run build + tests); adversarially review; run the doc-loop; commit explicit paths with a WHY; fast-forward push; flip the row done and bash scripts/lane.sh release <ID>; then immediately continue to the next item. Never stop after one build; if the board is dry, write "board dry - long-polling" to the lane report and recheck in ~25 min. Stay in lane via the ledger; never touch FORBIDDEN files.'

# name|branch|worktree-dir|description   (ordered so the menu numbers match: 1 .. 4, then wm)
LANES=(
  "cockpit|parallel/lane-1|cadence-lane-1|Lane 1 - pulls the next highest-impact unclaimed item (prefers Cockpit/Governance, then roams)"
  "knowledge|parallel/lane-2|cadence-lane-2|Lane 2 - pulls the next highest-impact unclaimed item (prefers Sense/Decide/Interop, then roams)"
  "safety|parallel/lane-3|cadence-lane-3|Lane 3 - pulls the next highest-impact unclaimed item (prefers Governance/Cockpit, then roams)"
  "build|parallel/lane-4|cadence-lane-4|Lane 4 - pulls the next highest-impact unclaimed item (prefers Build/Interop, then roams)"
  "wm|parallel/lane-0|cadence-lane-0|Lane 0 - pulls the next highest-impact unclaimed item (prefers Monetization/Credit/Foundational, then roams)"
)

lane_field() { # <name> <2branch|3dir|4desc>
  local want="$1" idx="$2" entry name branch dir desc
  for entry in "${LANES[@]}"; do
    IFS='|' read -r name branch dir desc <<< "$entry"
    if [ "$name" = "$want" ]; then
      case "$idx" in 2) printf '%s' "$branch" ;; 3) printf '%s' "$dir" ;; 4) printf '%s' "$desc" ;; esac
      return 0
    fi
  done
  return 1
}
lane_names() { local e n r; for e in "${LANES[@]}"; do IFS='|' read -r n r <<< "$e"; printf '%s\n' "$n"; done; }

# --- terminal detection (verified research): prefer iTerm when available ------
iterm_installed() {
  [ -d "/Applications/iTerm.app" ] && return 0
  mdfind "kMDItemCFBundleIdentifier == 'com.googlecode.iterm2'" 2>/dev/null | grep -q . && return 0
  return 1
}
choose_terminal() {
  if pgrep -x "iTerm2" >/dev/null 2>&1; then echo iterm; return; fi
  if iterm_installed; then echo iterm; return; fi
  echo terminal
}
is_macos() { [ "$(uname -s)" = "Darwin" ]; }
osascript_ok() { command -v osascript >/dev/null 2>&1; }

# The shell command the new session runs. printf %q keeps the spaced path and
# the bootstrap safe for the new shell; argv passing keeps it out of AppleScript.
launch_cmd() { printf 'cd %q && claude %q' "$1" "$BOOTSTRAP"; }

# --- osascript openers (on run argv = robust; new window per lane) ------------
open_terminal() { # <cmd> <lane>
  osascript - "$1" "$2" <<'OSA'
on run argv
  set theCmd to item 1 of argv
  set laneName to item 2 of argv
  tell application "Terminal"
    activate
    set newTab to do script theCmd   -- no target => a NEW WINDOW (race-free)
    delay 0.3
    set custom title of newTab to laneName
  end tell
end run
OSA
}
open_iterm() { # <cmd> <lane>   (current iTerm2 API; if `set name` errors on your version, drop that line)
  osascript - "$1" "$2" <<'OSA'
on run argv
  set theCmd to item 1 of argv
  set laneName to item 2 of argv
  tell application "iTerm"
    activate
    set newWin to (create window with default profile)
    tell current session of newWin
      write text theCmd
      set name to laneName
    end tell
  end tell
end run
OSA
}

print_lane() { # <name>   (fallback / list mode)
  local name="$1" branch dir abs desc
  branch="$(lane_field "$name" 2)"; dir="$(lane_field "$name" 3)"; desc="$(lane_field "$name" 4)"; abs="$ROOT/$dir"
  echo "  [$name]  branch $branch"
  echo "    $desc"
  echo "    launch:  cd \"$abs\" && claude"
  echo "    then type:  /overnight-build   (auto-started when opened via this script)"
  echo
}

open_lane() { # <name>
  local name="$1" branch dir abs cur cmd target rc
  branch="$(lane_field "$name" 2)" || { echo "Unknown lane: $name"; return 1; }
  dir="$(lane_field "$name" 3)"; abs="$ROOT/$dir"

  # 1) worktree must exist
  if [ ! -d "$abs" ]; then
    echo "  [$name] worktree MISSING: $abs"
    echo "    create it:  git -C \"$PRIMARY\" worktree add \"$abs\" -b $branch   (then add .remember/LANE.md)"; echo
    return 1
  fi
  # 2) must be a git worktree on the EXPECTED branch (never launch a loop on the wrong branch / main)
  if ! git -C "$abs" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "  [$name] $abs is not a git worktree - refusing to launch."; echo; return 1
  fi
  cur="$(git -C "$abs" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ "$cur" != "$branch" ]; then
    echo "  [$name] worktree is on '$cur', expected '$branch' - refusing (would risk building on the wrong branch)."; echo
    return 1
  fi

  # 3) non-macOS / no osascript -> print instead of opening
  if ! is_macos || ! osascript_ok; then
    echo "  (no macOS terminal automation here - printing the launch command)"; print_lane "$name"; return 0
  fi

  cmd="$(launch_cmd "$abs")"
  target="$(choose_terminal)"
  echo "  opening [$name] in $target -> $abs"
  if [ "$target" = "iterm" ]; then open_iterm "$cmd" "$name"; else open_terminal "$cmd" "$name"; fi
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "  [$name] osascript failed (check System Settings > Privacy > Automation). Falling back to print:"
    print_lane "$name"
  fi
}

do_list() {
  echo; echo "Parallel build lanes (each = one terminal + one worktree + one autonomous loop):"; echo
  local n; while IFS= read -r n; do print_lane "$n"; done < <(lane_names)
  echo "Each session reads its own .remember/LANE.md, stays in its lane, stops when its queue is dry."
  echo "Bypass-permissions is set per worktree, so the loop runs unattended once it starts."; echo
}
do_all_non_wm() {
  echo; echo "Opening every NON-wm lane (one window each). wm is the existing overnight session - left alone."; echo
  local n; while IFS= read -r n; do [ "$n" = "wm" ] && continue; open_lane "$n"; sleep 0.5; done < <(lane_names)
  echo; echo "Note: wm (overnight/wm) was NOT opened - it is the existing overnight session."; echo
}
do_menu() {
  echo; echo "Which lane do you want to launch?"; echo
  local i=0 n names=()
  while IFS= read -r n; do i=$((i+1)); names+=("$n"); printf "  %d) %-10s %s\n" "$i" "$n" "$(lane_field "$n" 4)"; done < <(lane_names)
  echo; echo "  a) all NON-wm lanes      q) quit"; echo
  local choice=""; printf "which lane? (number, a=all non-wm, q=quit): "
  if ! IFS= read -r choice; then echo; echo "(no input - quitting)"; return 0; fi
  case "$choice" in
    q|Q|"") echo "Quit." ;;
    a|A) do_all_non_wm ;;
    *)
      if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#names[@]}" ]; then
        local picked="${names[$((choice-1))]}"
        if [ "$picked" = "wm" ]; then
          printf "wm is the existing overnight session. Open a second wm window anyway? (y/N): "
          local yn=""; IFS= read -r yn || yn=""
          case "$yn" in y|Y) open_lane wm ;; *) echo "Skipped wm." ;; esac
        else
          open_lane "$picked"
        fi
      else
        echo "Unrecognized choice: $choice"; return 1
      fi ;;
  esac
}

arg="${1:-}"
# numeric aliases so `parallel-build.sh 1` works: 1=cockpit 2=knowledge 3=safety 4=build 0=wm
case "$arg" in
  1) arg=cockpit ;; 2) arg=knowledge ;; 3) arg=safety ;; 4) arg=build ;; 0) arg=wm ;;
esac
case "$arg" in
  "") do_menu ;;
  list) do_list ;;
  a|A|all) do_all_non_wm ;;
  wm|cockpit|knowledge|safety|build) open_lane "$arg" ;;
  *)
    echo "Unknown arg: $arg"
    echo "Valid: (none=menu) | list | a | 1|2|3|4|0 | cockpit|knowledge|safety|build|wm"
    exit 1 ;;
esac

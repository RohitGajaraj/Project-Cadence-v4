#!/usr/bin/env bash
# parallel-build.sh - list the file-disjoint parallel build lanes and print the exact
# launch command for each. Every lane runs the SAME autonomous loop (/overnight-build)
# in its own git worktree, self-scoped by that worktree's .remember/LANE.md.
# Choosing a lane = choosing which worktree you launch the terminal in.
#
# Usage:
#   ./scripts/parallel-build.sh           # list all lanes + launch commands
#   ./scripts/parallel-build.sh cockpit   # print just one lane
#
# This script never launches a session itself (an unattended loop needs its own
# terminal); it prints the command to paste. It has no side effects.
set -euo pipefail

ROOT="/Users/rohitgajaraj/Projects/My Projects/My Builds"

# name | branch | worktree-dir | description
LANES=(
  "wm|overnight/wm|overnight-build|WM tenancy / billing / credit (the original overnight lane)"
  "cockpit|parallel/cockpit|cadence-cockpit|R3-PREFS notification prefs + P7 incidents / cost-incident log"
  "knowledge|parallel/knowledge|cadence-knowledge|O1 knowledge-graph explorer + O3 drift / skill-pack export"
  "safety|parallel/safety|cadence-safety|FND-0.5 agent blast-radius + FND-0.7 injection classifier"
)

want="${1:-}"
echo
echo "Parallel build lanes (each = one terminal + one worktree + one autonomous loop):"
echo
for entry in "${LANES[@]}"; do
  IFS='|' read -r name branch dir desc <<< "$entry"
  if [ -n "$want" ] && [ "$want" != "$name" ]; then continue; fi
  echo "  [$name]  branch $branch"
  echo "    $desc"
  echo "    launch:  cd \"$ROOT/$dir\" && claude"
  echo "    then type:  /overnight-build"
  echo
done
if [ -z "$want" ]; then
  echo "Each session reads its own .remember/LANE.md, stays in its lane, and stops when its queue is dry."
  echo "Bypass-permissions is already set per worktree, so /overnight-build runs unattended (no approvals)."
fi

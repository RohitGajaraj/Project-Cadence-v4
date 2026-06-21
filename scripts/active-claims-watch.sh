#!/usr/bin/env bash
# Keeps THIS worktree's feature-dashboard.md current with origin so the founder sees the
# lanes' latest pushed status (who is 🔨 building, what is ✅/◐) without a manual pull.
# It ONLY fast-forwards when the tree is clean AND strictly behind origin (never ahead /
# diverged / dirty) - `--ff-only` can never lose work or create a conflict; it is skipped
# otherwise. There is NO separate status file: the register IN feature-dashboard.md is the
# single source, and the live ledger is `bash scripts/lane.sh board`. Run by the
# com.cadence.active-claims-sync launchd agent (RunAtLoad + KeepAlive = permanent).
set -u
SELF="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT="$(dirname "$SELF")"
INTERVAL="${ACTIVE_CLAIMS_INTERVAL:-15}"   # seconds between refreshes
cd "$ROOT" || exit 1
echo "[register-watch] started $(date) interval=${INTERVAL}s root=$ROOT"
while true; do
  git fetch -q origin main 2>/dev/null || true       # read-only: refresh origin/main only
  if [ -z "$(git status --porcelain 2>/dev/null)" ] \
     && git merge-base --is-ancestor HEAD origin/main 2>/dev/null \
     && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    git merge --ff-only origin/main >/dev/null 2>&1 || true   # safe catch-up; never loses work
  fi
  sleep "$INTERVAL"
done

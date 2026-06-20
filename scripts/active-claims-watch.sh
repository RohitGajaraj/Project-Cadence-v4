#!/usr/bin/env bash
# Continuous watcher that keeps docs/planning/active-claims.live.md real-time from the
# atomic claim ledger (~/.cadence-parallel) + origin/main's register. Run by the
# com.cadence.active-claims-sync launchd agent (KeepAlive=true). The `git fetch` is
# READ-ONLY (updates remote-tracking refs only; it never touches the working tree, never
# merges, never pulls), so it is safe to run continuously alongside the founder's work.
set -u
SELF="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT="$(dirname "$SELF")"
INTERVAL="${ACTIVE_CLAIMS_INTERVAL:-8}"   # seconds between refreshes
cd "$ROOT" || exit 1
echo "[active-claims-watch] started $(date) interval=${INTERVAL}s root=$ROOT"
while true; do
  git fetch -q origin main 2>/dev/null || true       # read-only: refresh origin/main only
  # Keep the committed register live too: if THIS worktree is clean AND strictly behind
  # origin (never ahead / diverged / dirty), fast-forward it so feature-dashboard.md shows
  # the lanes' latest pushed status. --ff-only can never lose work or create a conflict;
  # it is skipped whenever there is anything uncommitted or any local commit ahead.
  if [ -z "$(git status --porcelain 2>/dev/null)" ] \
     && git merge-base --is-ancestor HEAD origin/main 2>/dev/null \
     && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    git merge --ff-only origin/main >/dev/null 2>&1 || true
  fi
  python3 "$SELF/sync-active-claims.py" >/dev/null 2>&1 || true
  sleep "$INTERVAL"
done

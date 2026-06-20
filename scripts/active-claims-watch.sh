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
  python3 "$SELF/sync-active-claims.py" >/dev/null 2>&1 || true
  sleep "$INTERVAL"
done

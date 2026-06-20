#!/usr/bin/env bash
# Ensure the active-claims live-status watcher is installed + running.
# Idempotent and safe to call on every lane start / session start / boot - it does nothing
# if the watcher is already up. The launchd agent (RunAtLoad + KeepAlive) is the primary
# always-on mechanism; this is the belt-and-suspenders so a fresh checkout or a manual lane
# start also brings it up.
set -u
SELF="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLIST_SRC="$SELF/launchd/com.cadence.active-claims-sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.cadence.active-claims-sync.plist"
[ -f "$PLIST_SRC" ] || { echo "[ensure-watcher] plist not found: $PLIST_SRC"; exit 0; }
mkdir -p "$HOME/Library/LaunchAgents"
cp -f "$PLIST_SRC" "$PLIST_DST"
if launchctl list 2>/dev/null | grep -q com.cadence.active-claims-sync; then
  echo "[ensure-watcher] active-claims watcher already running"
else
  launchctl load "$PLIST_DST" 2>/dev/null && echo "[ensure-watcher] active-claims watcher loaded" \
    || echo "[ensure-watcher] could not load (run: launchctl load $PLIST_DST)"
fi

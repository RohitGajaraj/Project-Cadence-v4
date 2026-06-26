#!/usr/bin/env bash
# sync-pcv4.sh — Pull origin/main into Project-Cadence-v4.
#
# MANDATORY: run this after EVERY git push from any lane.
# `post-push` is not a real git hook, so this must be called explicitly.
# The lane.sh push wrapper calls this automatically.
#
# Usage:  bash scripts/sync-pcv4.sh
# Exit 0 always — sync failure is a warning, not a blocker.

V4="/Users/rohitgajaraj/Projects/My Projects/My Builds/Project-Cadence-v4"

if [[ ! -d "$V4" ]]; then
  echo "[sync-pcv4] WARN: $V4 not found — skipping"
  exit 0
fi

git -C "$V4" fetch origin -q 2>/dev/null || { echo "[sync-pcv4] WARN: fetch failed"; exit 0; }

LOCAL=$(git -C "$V4" rev-parse main 2>/dev/null)
REMOTE=$(git -C "$V4" rev-parse origin/main 2>/dev/null)
[[ "$LOCAL" == "$REMOTE" ]] && echo "[sync-pcv4] already up to date ($LOCAL)" && exit 0

# Stash tracked modifications (routeTree.gen.ts etc.) so the merge can proceed
STASHED=0
if ! git -C "$V4" diff --quiet 2>/dev/null || ! git -C "$V4" diff --cached --quiet 2>/dev/null; then
  git -C "$V4" stash push -q --message "sync-pcv4 pre-pull" 2>/dev/null && STASHED=1
fi

if git -C "$V4" merge --ff-only origin/main -q 2>/dev/null; then
  [[ $STASHED -eq 1 ]] && git -C "$V4" stash pop -q 2>/dev/null
  SHORT=$(git -C "$V4" rev-parse --short HEAD 2>/dev/null)
  printf "\033[32m[sync-pcv4]\033[0m Project-Cadence-v4 synced to %s\n" "$SHORT"
else
  [[ $STASHED -eq 1 ]] && git -C "$V4" stash pop -q 2>/dev/null
  printf "\033[33m[sync-pcv4]\033[0m WARN: could not fast-forward. Run manually:\n"
  printf "  git -C '%s' stash && git -C '%s' pull origin main && git -C '%s' stash pop\n" "$V4" "$V4" "$V4"
fi

exit 0

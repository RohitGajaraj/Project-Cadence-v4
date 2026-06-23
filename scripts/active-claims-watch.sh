#!/usr/bin/env bash
# Keeps THIS worktree's feature-dashboard.md (and the whole tree) current with origin so the
# founder sees the lanes' latest pushed status (who is 🔨 building, what is ✅/◐) without a
# manual pull. It fast-forwards (`--ff-only`, which can never lose work or create a conflict)
# whenever the tree is strictly behind origin AND has no REAL (non-generated) local changes.
# There is NO separate status file: the register IN feature-dashboard.md is the single source,
# and the live ledger is `bash scripts/lane.sh board`. Run by the com.cadence.active-claims-sync
# launchd agent (RunAtLoad + KeepAlive = permanent).
#
# PERMANENT FIX (founder ruling 2026-06-24): the watcher used to skip the ff whenever the tree
# was dirty in ANY way. A running dev server rewrites the tracked generated file
# `src/routeTree.gen.ts`, which made the tree permanently "dirty" and silently froze the
# founder's view 9+ commits behind. Generated artifacts auto-regenerate, so a local diff in
# them must NEVER block the catch-up: we discard them and ff anyway. Real source changes still
# block the ff (we never overwrite work). Add any future always-regenerated tracked file to
# GENERATED below and the drift cannot come back.
set -u
SELF="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT="$(dirname "$SELF")"
INTERVAL="${ACTIVE_CLAIMS_INTERVAL:-15}"   # seconds between refreshes
cd "$ROOT" || exit 1

# Tracked files a running dev server / build regenerates. A local diff here is noise, not work.
GENERATED=("src/routeTree.gen.ts")
# A porcelain grep pattern that matches ONLY the generated paths (so we can subtract them).
GEN_GREP=" (src/routeTree\.gen\.ts)$"

echo "[register-watch] started $(date) interval=${INTERVAL}s root=$ROOT"
while true; do
  git fetch -q origin main 2>/dev/null || true       # read-only: refresh origin/main only
  DIRTY="$(git status --porcelain 2>/dev/null)"
  # Real (non-generated) local changes — if any exist we MUST NOT ff (never overwrite work).
  NONGEN="$(printf '%s\n' "$DIRTY" | grep -vE "$GEN_GREP" | grep -v '^[[:space:]]*$' || true)"
  if [ -z "$NONGEN" ] \
     && git merge-base --is-ancestor HEAD origin/main 2>/dev/null \
     && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    # Discard ONLY the generated artifacts (they regenerate); real source is untouched above.
    if [ -n "$DIRTY" ]; then
      for f in "${GENERATED[@]}"; do git checkout -- "$f" 2>/dev/null || true; done
    fi
    git merge --ff-only origin/main >/dev/null 2>&1 || true   # safe catch-up; never loses work
  fi
  sleep "$INTERVAL"
done

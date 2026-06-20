#!/usr/bin/env bash
# lane-migrate.sh - safely migrate one running-lane worktree to its numbered name
# AFTER its session has exited, then release that lane's transition pin. Idempotent
# and heavily guarded so it can never move a worktree out from under a live session.
#
# Usage: lane-migrate.sh <srcName> <dstName> <pinId> <laneNum> [--dry-run]
#   e.g. lane-migrate.sh cadence-cockpit cadence-lane-1 LANE1-COCKPIT 1
#
# Guards (ALL must hold, else it refuses/waits and logs why):
#   - lsof must actually return results (sanity: it can see the main repo's cwd) -
#     if lsof is blind (e.g. a sandbox), FAIL SAFE and do nothing.
#   - dst must NOT already exist (idempotent: if already migrated, just release pin).
#   - src must exist; NO process may have its cwd inside src (session must have exited);
#     src tree must be clean.
# On success: git worktree move -> fix the moved settings self-ref -> update tasks.json
#   cwd + workspace path -> release the pin -> best-effort commit+push the tracked edits.
set -uo pipefail
ROOT="/Users/rohitgajaraj/Projects/My Projects/My Builds"
PRIMARY="$ROOT/Project-Cadence-v4"
LANE="$PRIMARY/scripts/lane.sh"
LOG="$HOME/.cadence-parallel/migrate.log"
mkdir -p "$HOME/.cadence-parallel" 2>/dev/null || true
log(){ echo "$(date '+%F %T') [migrate] $*" | tee -a "$LOG"; }

src="${1:?usage: lane-migrate.sh <src> <dst> <pin> <num> [--dry-run]}"
dst="${2:?dst}"; pin="${3:?pin}"; num="${4:?num}"; dry="${5:-}"
S="$ROOT/$src"; D="$ROOT/$dst"

lsof_sane(){ lsof -a -d cwd 2>/dev/null | grep -q "My Builds/Project-Cadence-v4"; }
cwd_inside(){ lsof -a -d cwd 2>/dev/null | grep -q "My Builds/$1"; }

# Idempotent: already migrated -> just ensure the pin is released.
if [ -d "$D" ] && [ ! -d "$S" ]; then
  log "$dst already exists, $src gone - ensuring pin $pin released"
  [ "$dry" = "--dry-run" ] || bash "$LANE" release "$pin" >>"$LOG" 2>&1
  exit 0
fi
lsof_sane   || { log "REFUSE: lsof returned nothing (sandbox/perms?) - cannot verify session exit"; exit 2; }
[ -d "$S" ] || { log "REFUSE: src $src missing"; exit 2; }
if cwd_inside "$src"; then log "WAIT: a process still has cwd inside $src - session alive"; exit 1; fi
if [ -n "$(git -C "$S" status --porcelain 2>/dev/null)" ]; then log "WAIT: $src tree dirty - not moving"; exit 1; fi

if [ "$dry" = "--dry-run" ]; then log "DRY-RUN: WOULD move $src -> $dst, update tasks/workspace/settings, release $pin"; exit 0; fi

log "migrating $src -> $dst"
git -C "$PRIMARY" worktree move "$S" "$D" 2>>"$LOG" || { log "FAIL: git worktree move"; exit 3; }

# fix the moved worktree's settings.local.json self-reference
python3 - "$D" "$S" "$D" <<'PY'
import json,sys
d, oldp, newp = sys.argv[1], sys.argv[2], sys.argv[3]
p=f"{d}/.claude/settings.local.json"
try:
  s=json.load(open(p)); ad=s["permissions"].get("additionalDirectories",[])
  s["permissions"]["additionalDirectories"]=[newp if x==oldp else x for x in ad]
  json.dump(s,open(p,"w"),indent=2); open(p,"a").write("\n"); print("settings self-ref fixed")
except Exception as e: print("settings fix skipped:",e)
PY

# update tasks.json cwd + workspace path (literal path replace)
python3 - "$PRIMARY" "$src" "$dst" <<'PY'
import sys
primary,src,dst=sys.argv[1],sys.argv[2],sys.argv[3]
for f in (f"{primary}/.vscode/tasks.json", f"{primary}/cadence-parallel.code-workspace"):
  try:
    s=open(f).read(); s2=s.replace(f"/{src}", f"/{dst}")
    if s2!=s: open(f,"w").write(s2); print("updated",f)
  except Exception as e: print("skip",f,e)
PY

bash "$LANE" release "$pin" >>"$LOG" 2>&1 && log "released pin $pin"

# best-effort commit+push of the tracked-file edits (never fail the migration on this)
( cd "$PRIMARY" \
  && git add .vscode/tasks.json cadence-parallel.code-workspace 2>/dev/null \
  && git commit -q -m "parallel-build: migrate $src -> $dst (lane $num session exited)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" 2>>"$LOG" \
  && git fetch origin -q && git rebase origin/main >>"$LOG" 2>&1 \
  && git push origin main >>"$LOG" 2>&1 && log "pushed tasks/workspace update" ) \
  || log "commit/push best-effort failed (changes left local) - push from main when convenient"
log "DONE $src -> $dst"

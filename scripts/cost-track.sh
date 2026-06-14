#!/usr/bin/env bash
#
# cost-track.sh — one-command wrapper around ruflo-cost-tracker's track.mjs.
#
# Why this exists: track.mjs has two bugs that bite this project specifically.
#   1. PATH ENCODING — its encodeProjectPath() replaces only "/ \ :" with "-",
#      but Claude Code ALSO encodes spaces as "-". This repo's path contains
#      spaces ("My Projects/My Builds"), so the script computes the wrong
#      ~/.claude/projects/<dir> name and bails before it reads TRACK_SESSION.
#      Fix: pass TRACK_CWD with spaces rewritten as "/", so the script's own
#      encoder (which turns "/" into "-") produces the correct dir name.
#   2. NO UPSERT — its `memory store` call omits --upsert, so re-running inside
#      the same session fails on the already-existing key. Fix: run track.mjs in
#      dry-run to emit the JSON, then store it ourselves with --upsert.
#
# Usage:
#   scripts/cost-track.sh                 # most-recent session for this project
#   scripts/cost-track.sh <session-id>    # pin a session id (no .jsonl suffix)
#   scripts/cost-track.sh /abs/path.jsonl # pin an explicit jsonl path
#
# If track.mjs is ever fixed upstream, this wrapper still works; delete it then.

set -euo pipefail

# --- Resolve the project root (real path, spaces intact) ---------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[[ -z "$PROJECT_DIR" ]] && PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CLAUDE_PROJECTS="$HOME/.claude/projects"

# Encode exactly like Claude Code does: "/", "\", ":" AND space all -> "-".
ENCODED="$(printf '%s' "$PROJECT_DIR" | tr '/\\: ' '-')"
SESSION_DIR="$CLAUDE_PROJECTS/$ENCODED"

if [[ ! -d "$SESSION_DIR" ]]; then
  echo "cost-track: no Claude Code session dir at $SESSION_DIR" >&2
  exit 2
fi

# --- Pick the session jsonl --------------------------------------------------
ARG="${1:-}"
if [[ -n "$ARG" && -f "$ARG" ]]; then
  SESSION_FILE="$ARG"                       # explicit path
elif [[ -n "$ARG" ]]; then
  SESSION_FILE="$SESSION_DIR/$ARG.jsonl"    # bare session id
else
  SESSION_FILE="$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1 || true)"  # latest
fi

if [[ -z "${SESSION_FILE:-}" || ! -f "$SESSION_FILE" ]]; then
  echo "cost-track: no session jsonl found (looked in $SESSION_DIR)" >&2
  exit 2
fi

SESSION_ID="$(basename "$SESSION_FILE" .jsonl)"
KEY="session-$SESSION_ID"
NAMESPACE="${TRACK_NAMESPACE:-cost-tracking}"

# --- Locate track.mjs (newest installed plugin version) ----------------------
TRACK_MJS="$(ls -t "$HOME"/.claude/plugins/cache/ruflo/ruflo-cost-tracker/*/scripts/track.mjs 2>/dev/null | head -1 || true)"
if [[ -z "${TRACK_MJS:-}" || ! -f "$TRACK_MJS" ]]; then
  echo "cost-track: track.mjs not found under ~/.claude/plugins/cache/ruflo/ruflo-cost-tracker/*/scripts/" >&2
  exit 2
fi

# TRACK_CWD trick: spaces -> "/" so track.mjs's encoder yields the right dir.
TRACK_CWD_HACK="${PROJECT_DIR// //}"
TMP_JSON="$(mktemp -t cost-track.XXXXXX.json)"
trap 'rm -f "$TMP_JSON"' EXIT

# --- 1) Compute the tally (dry-run; emit JSON + capture markdown) -------------
MD="$(
  TRACK_CWD="$TRACK_CWD_HACK" \
  TRACK_SESSION="$SESSION_FILE" \
  TRACK_OUT="$TMP_JSON" \
  TRACK_DRY_RUN=1 \
  TRACK_NAMESPACE="$NAMESPACE" \
  node "$TRACK_MJS"
)"

# --- 2) Persist with --upsert (works on first run AND re-runs) ----------------
if CLI_CORE=1 npx @claude-flow/cli-core@alpha memory store \
     --namespace "$NAMESPACE" --key "$KEY" \
     --value "$(cat "$TMP_JSON")" --upsert >/dev/null 2>&1; then
  STATUS="\`$NAMESPACE:$KEY\`"
else
  STATUS="**FAILED** (memory store --upsert)"
fi

# --- 3) Print the breakdown with a truthful Persisted status ------------------
printf '%s\n' "$MD" | sed "s|\*\*FAILED\*\* (dry-run)|$STATUS|"

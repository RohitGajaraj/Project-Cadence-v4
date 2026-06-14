#!/usr/bin/env bash
#
# cost-summary.sh — wrapper around ruflo-cost-tracker's summary.mjs.
#
# Prints a cost summary across all sessions in the cost-tracking namespace.
#
# CLI_CORE=1 is MANDATORY here, not just a speed knob: summary.mjs reads
# whichever memory backend CLI_CORE selects. cost-track.sh writes records with
# CLI_CORE=1 (cli-core JSON backend), so summary must match — without the flag it
# queries an empty SQLite store and silently reports "$0 / 0 sessions", no error.
# (It's also faster: ~2s cold-cache vs ~25s.)
#
# Usage:
#   bun run cost:summary                      # markdown format (default)
#   bun run cost:summary -- --format json     # stable JSON contract for consumers
#   scripts/cost-summary.sh --format json     # same, called directly
#
# Extra args are forwarded to summary.mjs verbatim (SUMMARY_NAMESPACE,
# SUMMARY_FED_NAMESPACE, SUMMARY_FORMAT env vars pass through too).
# If summary.mjs is ever moved or versioned differently, this wrapper
# still works; just update the glob pattern below.

set -euo pipefail

# --- Locate summary.mjs (newest installed plugin version) ----------------------
SUMMARY_MJS="$(ls -t "$HOME"/.claude/plugins/cache/ruflo/ruflo-cost-tracker/*/scripts/summary.mjs 2>/dev/null | head -1 || true)"
if [[ -z "${SUMMARY_MJS:-}" || ! -f "$SUMMARY_MJS" ]]; then
  echo "cost-summary: summary.mjs not found under ~/.claude/plugins/cache/ruflo/ruflo-cost-tracker/*/scripts/" >&2
  exit 2
fi

# --- Run with CLI_CORE=1 for fast backend ----------------------------------------
CLI_CORE=1 node "$SUMMARY_MJS" "$@"

#!/usr/bin/env bash
#
# cost-summary.sh — wrapper around ruflo-cost-tracker's summary.mjs.
#
# Prints cost summary across all sessions in the cost-tracking namespace.
# Uses CLI_CORE=1 for lite backend (~2s cold-cache vs ~25s).
#
# Usage:
#   scripts/cost-summary.sh                  # markdown format (default)
#   scripts/cost-summary.sh --format json    # json format
#
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

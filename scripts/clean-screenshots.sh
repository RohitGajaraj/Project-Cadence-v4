#!/usr/bin/env bash
#
# clean-screenshots.sh — keep image clutter out of the repo tree.
#
# This is the enforcement arm of docs/conventions/screenshot-placement.md.
# It is idempotent and SAFE: it only relocates or purges image files in known
# scratch and ephemeral locations. It NEVER touches:
#   - design-reference/   (committed canonical references)
#   - public/ , src/      (real app assets)
#   - the durable documentation buckets under docs/screenshots/
#     (reference, app-ui, screen-*, fixes, misc, design-refs, brand-feed)
#
# What it does:
#   1. Relocates stray images at the repo ROOT or directly under docs/ into the
#      verify bucket (zero tolerance: images never belong at the root).
#   2. Purges the ephemeral buckets past their retention window:
#        docs/screenshots/verify/  -> 14 days (override SCREENSHOT_VERIFY_RETENTION_DAYS)
#        .playwright-mcp/           ->  7 days (override SCREENSHOT_MCP_RETENTION_DAYS)
#
# Run manually:  bun run clean:screenshots   (or ./scripts/clean-screenshots.sh)
# To run automatically, wire it to the Claude Code session Stop hook in
# .claude/settings.json (pending founder approval; that file is gated config).
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || exit 0

VERIFY_RETENTION_DAYS="${SCREENSHOT_VERIFY_RETENTION_DAYS:-14}"
MCP_RETENTION_DAYS="${SCREENSHOT_MCP_RETENTION_DAYS:-7}"
DEST="docs/screenshots/verify"
mkdir -p "$DEST"

moved=0
# Stray images at the repo root and directly under docs/ (top level only) get
# relocated. Subfolders of docs/screenshots/ are intentional buckets, left alone.
for pat in ./*.png ./*.jpg ./*.jpeg ./*.gif ./*.webp docs/*.png docs/*.jpg docs/*.jpeg docs/*.gif docs/*.webp; do
  for f in $pat; do
    [ -e "$f" ] || continue
    target="$DEST/$(basename "$f")"
    # Avoid clobbering an existing capture with the same name.
    [ -e "$target" ] && target="$DEST/$(date +%Y%m%d-%H%M%S)-$(basename "$f")"
    mv -f "$f" "$target" && moved=$((moved + 1))
  done
done

# Purge ephemeral buckets past retention.
purged_verify=$(find "$DEST" -type f -mtime +"$VERIFY_RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')
purged_mcp=0
[ -d .playwright-mcp ] && purged_mcp=$(find .playwright-mcp -type f -mtime +"$MCP_RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')

# Speak only when something actually happened (quiet on a clean tree).
if [ "$moved" -gt 0 ] || [ "$purged_verify" -gt 0 ] || [ "$purged_mcp" -gt 0 ]; then
  echo "[clean-screenshots] relocated ${moved} stray image(s) into ${DEST}; purged ${purged_verify} verify + ${purged_mcp} mcp scratch past retention."
fi
exit 0

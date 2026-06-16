#!/usr/bin/env bash
#
# clean-workspace.sh — the repo working-tree janitor (images + FS-dup artifacts).
#
# Idempotent and SAFE. It only relocates/purges image files in known scratch and
# ephemeral locations, and removes macOS case-insensitive FS-duplication artifacts
# ONLY when their canonical twin exists. It never touches design-reference/ (committed
# references), public/ or src/ app assets, or the durable docs/screenshots/ buckets.
#
# Two jobs (convention: docs/conventions/workspace-hygiene.md):
#   1. IMAGES
#      - relocate stray images at the repo root or docs/ top level into
#        docs/screenshots/verify/ (no image belongs at the root)
#      - purge ephemeral buckets past retention:
#          docs/screenshots/verify/  -> 14 days (SCREENSHOT_VERIFY_RETENTION_DAYS)
#          .playwright-mcp/           ->  7 days (SCREENSHOT_MCP_RETENTION_DAYS)
#   2. FS-DUP ARTIFACTS
#      - remove macOS "<name> 2.<ext>" / "<name> 2" duplicates (the case-insensitive
#        filesystem + sync artifacts CLAUDE.md warns about) ONLY when the canonical
#        "<name>.<ext>" / "<name>" exists, so a legitimately-named file is never lost.
#
# Run manually:  bun run clean:workspace   (or ./scripts/clean-workspace.sh)
# To run automatically, wire it to the Claude Code session Stop hook in
# .claude/settings.json (pending founder approval; that file is gated config).
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || exit 0

VERIFY_RETENTION_DAYS="${SCREENSHOT_VERIFY_RETENTION_DAYS:-14}"
MCP_RETENTION_DAYS="${SCREENSHOT_MCP_RETENTION_DAYS:-7}"
DEST="docs/screenshots/verify"
mkdir -p "$DEST"

# ---- 1. Images: relocate root / docs-top-level strays into the verify bucket ----
moved=0
for pat in ./*.png ./*.jpg ./*.jpeg ./*.gif ./*.webp docs/*.png docs/*.jpg docs/*.jpeg docs/*.gif docs/*.webp; do
  for f in $pat; do
    [ -e "$f" ] || continue
    target="$DEST/$(basename "$f")"
    [ -e "$target" ] && target="$DEST/$(date +%Y%m%d-%H%M%S)-$(basename "$f")"
    mv -f "$f" "$target" && moved=$((moved + 1))
  done
done

# ---- 1b. Images: purge ephemeral buckets past their retention window ----
purged_verify=$(find "$DEST" -type f -mtime +"$VERIFY_RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')
purged_mcp=0
[ -d .playwright-mcp ] && purged_mcp=$(find .playwright-mcp -type f -mtime +"$MCP_RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')

# ---- 2. macOS FS-duplication artifacts ("<name> 2.<ext>" / "<name> 2") ----
# Removed ONLY when the canonical twin exists, so a real file is never deleted.
dups=0
while IFS= read -r p; do
  [ -e "$p" ] || continue
  base="$(basename "$p")"
  dir="$(dirname "$p")"
  if [[ "$base" == *" "[2-9]"."* ]]; then
    canon="${base/ [2-9]./.}"      # "<name> 2.<ext>" -> "<name>.<ext>"
  else
    canon="${base% [2-9]}"          # "<name> 2"       -> "<name>"
  fi
  if [ -e "$dir/$canon" ] && [ "$base" != "$canon" ]; then
    rm -rf "$p" && dups=$((dups + 1))
  fi
done < <(find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./.venv -o -path ./.wrangler \) -prune -o \( -name "* [2-9]" -o -name "* [2-9].*" \) -print 2>/dev/null)

# Speak only when something actually happened (quiet on a clean tree).
if [ "$moved" -gt 0 ] || [ "$purged_verify" -gt 0 ] || [ "$purged_mcp" -gt 0 ] || [ "$dups" -gt 0 ]; then
  echo "[clean-workspace] images: relocated ${moved}, purged ${purged_verify} verify + ${purged_mcp} mcp scratch; FS-dup artifacts removed: ${dups}."
fi
exit 0

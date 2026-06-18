#!/bin/bash
# docs-doctor.sh - anti-rot check for the Cadence documentation system.
#
# WHY: this repo's docs have been cleaned up repeatedly. This check catches the
# rot that forces those cleanups, so it does not return. Run it before committing
# doc changes (bun run docs:check). It is the enforcement half of the
# "Documentation Operating System" standing rule in AGENTS.md.
#
# Exit 1 (hard fail) on unambiguous rot: stray root/top-level files and macOS
# " 2" duplicates. Reports (warns) on softer signals: duplicated status owners
# and broken relative .md links.

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

FAIL=0
WARN=0

# Files allowed to live at the repo root (everything else belongs under docs/).
ROOT_WHITELIST=" AGENTS.md CLAUDE.md GEMINI.md README.md DESIGN.md ENTRY.md Ai_Cofounder.md plan.md "
# Files allowed at docs/ top level (everything else belongs in a subfolder).
DOCS_TOP_WHITELIST=" README.md brand-feed.md design-legacy.md "

echo "== docs-doctor =="

echo "-- [1] stray .md at repo root (only the canonical entry points belong here) --"
for f in *.md; do
  [ -e "$f" ] || continue
  case "$ROOT_WHITELIST" in *" $f "*) ;; *) echo "  FAIL stray root doc: $f  (move into docs/<subfolder>/ and link it from that folder's index)"; FAIL=1;; esac
done

echo "-- [2] stray .md at docs/ top level (belongs in a subfolder) --"
for f in docs/*.md; do
  [ -e "$f" ] || continue
  b="$(basename "$f")"
  case "$DOCS_TOP_WHITELIST" in *" $b "*) ;; *) echo "  FAIL stray docs/ doc: $f  (belongs in docs/<subfolder>/)"; FAIL=1;; esac
done

echo "-- [3] macOS ' 2' duplication artifacts --"
DUPES="$(find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./.venv \) -prune -o \( -name '* 2.*' -o -name '* 2' \) -print 2>/dev/null)"
if [ -n "$DUPES" ]; then echo "$DUPES" | sed 's/^/  FAIL dup artifact: /'; FAIL=1; else echo "  none"; fi

echo "-- [4] duplicated status ownership (status must live only in the SSOT / dashboard) --"
BOARDS="$(grep -rIl --include='*.md' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive 'Live status board' . 2>/dev/null)"
BOARD_COUNT="$(printf '%s' "$BOARDS" | grep -c . )"
if [ "$BOARD_COUNT" -gt 1 ]; then
  echo "  WARN 'Live status board' appears in $BOARD_COUNT live files (status should live only in the SSOT / feature-dashboard):"
  printf '%s\n' "$BOARDS" | sed 's/^/    /'
  WARN=1
else
  echo "  ok ($BOARD_COUNT)"
fi

echo "-- [5] broken relative .md links (report only) --"
BROKEN_LIST="$(
  find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./.venv -o -path '*/archive/*' \) -prune -o -name '*.md' -print 2>/dev/null | while IFS= read -r mdfile; do
    d="$(dirname "$mdfile")"
    grep -oE '\]\([^) ]+\.md[^) ]*\)' "$mdfile" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//; s/#.*$//' | while IFS= read -r link; do
      [ -z "$link" ] && continue
      case "$link" in http*|/*|mailto:*) continue ;; esac
      [ -f "$d/$link" ] || echo "  BROKEN $mdfile -> $link"
    done
  done
)"
if [ -n "$BROKEN_LIST" ]; then
  printf '%s\n' "$BROKEN_LIST"
  echo "  WARN $(printf '%s\n' "$BROKEN_LIST" | grep -c 'BROKEN') broken relative .md link(s); fix or repoint them."
  WARN=1
else
  echo "  none"
fi

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "docs-doctor: ISSUES FOUND (hard rot). Fix the FAIL items in the same commit."
  exit 1
fi
[ "$WARN" -ne 0 ] && echo "docs-doctor: clean of hard rot; review the WARN items above." || echo "docs-doctor: clean."
exit 0

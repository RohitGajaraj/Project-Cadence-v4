#!/bin/bash
# docs-doctor.sh - anti-rot check for the Cadence documentation system.
#
# WHY: this repo's docs have been cleaned up repeatedly. This check catches the
# rot that forces those cleanups, so it does not return. Run before committing
# doc changes (bun run docs:check). It is the enforcement half of the
# "Documentation Operating System" standing rule in AGENTS.md.
#
# Scope: EVERYTHING, archive included (archive is not exempt from the rules).
# Exit 1 (hard fail) on unambiguous rot: stray root/top-level files, macOS " 2"
# duplicates, dates in filenames. Reports (warns) on broken links, duplicated
# status owners, and docs missing a Created/Last updated header.

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

FAIL=0
WARN=0

# Root is reserved for SYSTEM-READ entry points (tools auto-load them from here, so they MUST stay at root).
ROOT_WHITELIST=" AGENTS.md CLAUDE.md GEMINI.md README.md design.md ENTRY.md Ai_Cofounder.md plan.md "
DOCS_TOP_WHITELIST=" README.md brand-feed.md "

echo "== docs-doctor =="

echo "-- [1] stray .md at repo root (only the system-read entry points belong here) --"
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
BOARDS="$(grep -rIl --include='*.md' --exclude-dir=node_modules --exclude-dir=.git 'Live status board' . 2>/dev/null)"
BOARD_COUNT="$(printf '%s' "$BOARDS" | grep -c . )"
if [ "$BOARD_COUNT" -gt 1 ]; then
  echo "  WARN the phrase 'Live status board' appears in $BOARD_COUNT files (check none is a second live board; status belongs in the SSOT / feature-dashboard):"
  printf '%s\n' "$BOARDS" | sed 's/^/    /'
  WARN=1
else
  echo "  ok ($BOARD_COUNT)"
fi

echo "-- [5] broken relative .md links (report only; archive INCLUDED) --"
BROKEN_LIST=""
while IFS= read -r mdfile; do
  [ -z "$mdfile" ] && continue
  d="$(dirname "$mdfile")"
  links="$(grep -oE '\]\([^) ]+\.md[^) ]*\)' "$mdfile" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//; s/#.*$//')"
  while IFS= read -r link; do
    case "$link" in ""|http*|/*|mailto:*) continue ;; esac
    if [ ! -f "$d/$link" ]; then BROKEN_LIST="${BROKEN_LIST}  BROKEN ${mdfile} -> ${link}"$'\n'; fi
  done <<< "$links"
done < <(find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./.venv \) -prune -o -name '*.md' -print 2>/dev/null)
if [ -n "$BROKEN_LIST" ]; then
  LIVE="$(printf '%s' "$BROKEN_LIST" | grep -v '/archive/' || true)"
  ARCH="$(printf '%s' "$BROKEN_LIST" | grep -c '/archive/' || true)"
  if [ -n "$LIVE" ]; then printf '%s\n' "$LIVE"; echo "  WARN $(printf '%s\n' "$LIVE" | grep -c 'BROKEN') broken link(s) in LIVE docs (fix these)."; WARN=1; else echo "  no broken links in live docs"; fi
  [ "${ARCH:-0}" -gt 0 ] && echo "  (plus ${ARCH} broken link(s) inside archived historical docs - left as historical record)"
else
  echo "  none"
fi

echo "-- [6] dates in .md filenames (date belongs in the header, not the name; archive INCLUDED) --"
DATED="$(find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./.venv -o -path ./.remember \) -prune -o -name '*[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.md' -print 2>/dev/null)"
if [ -n "$DATED" ]; then echo "$DATED" | sed 's/^/  FAIL dated filename: /'; echo "  (drop the date from the name; put Created/Last updated in the file header.)"; FAIL=1; else echo "  none"; fi

echo "-- [7] docs missing a Created / Last updated header --"
MISS=0
while IFS= read -r mdfile; do
  [ -z "$mdfile" ] && continue
  if ! head -12 "$mdfile" | grep -qiE 'Last updated|Created:'; then echo "  WARN no date header: $mdfile"; MISS=1; fi
done < <( { find docs -name '*.md' 2>/dev/null; for r in AGENTS.md CLAUDE.md GEMINI.md README.md design.md ENTRY.md Ai_Cofounder.md plan.md; do [ -f "$r" ] && echo "$r"; done; } )
if [ "$MISS" -ne 0 ]; then echo "  (add '> _Created: YYYY-MM-DD · Last updated: YYYY-MM-DD_' under the H1)"; WARN=1; else echo "  ok"; fi

echo ""
if [ "$FAIL" -ne 0 ]; then echo "docs-doctor: ISSUES FOUND (hard rot). Fix the FAIL items in the same commit."; exit 1; fi
[ "$WARN" -ne 0 ] && echo "docs-doctor: clean of hard rot; review the WARN items above." || echo "docs-doctor: clean."
exit 0

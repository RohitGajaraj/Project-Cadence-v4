#!/usr/bin/env bash
#
# check-humanized.sh build-time guard for the humanized-output convention.
#
# Scans ADDED lines (lines a diff prefixes with +) of staged TEXT files and
# flags AI fingerprints the convention bans: the em dash (U+2014), the en dash
# (U+2013), and the invisible / look-alike character set
# (U+200B U+200C U+200D U+2060 U+FEFF U+00A0 U+202F U+00AD U+200E U+200F U+FFFD).
# Convention: docs/conventions/humanized-output.md ("Banned fingerprints").
#
# This is the deferred build-time half of that convention. The runtime half
# (humanizeText at the AI chokepoint) already ships in src/lib/ai/humanize.ts.
#
# Scope: staged TEXT files only (*.md, *.ts, *.tsx, *.sql). It best-effort skips
# obvious code so a legitimate dash inside a sample is not flagged: fenced
# triple-backtick (or triple-tilde) blocks, and inline `backtick` code spans on
# the same line.
#
# WARN-ONLY by default. It always exits 0 and prints a warning, so it can never
# block a commit or a session. Set STRICT=1 to make it exit non-zero when it
# finds a hit (for a CI gate or an opt-in blocking pre-commit hook).
#
# Usage:
#   scripts/check-humanized.sh                 # scan the staged diff (warn-only)
#   STRICT=1 scripts/check-humanized.sh        # same, but exit 1 on any hit
#   scripts/check-humanized.sh path/a.md b.ts  # scan specific files (whole file)
#
# When given file arguments it scans every line of those files (not a diff), so
# you can check a file before staging it. With no arguments it scans the staged
# diff (git diff --cached) and reports file:line for each added hit.
#
# Detection engine: perl with -CSD (decode stdin as UTF-8), so the banned set is
# matched as Unicode codepoints. This is portable across macOS (BSD grep has no
# PCRE) and Linux. Input arrives as "<lineno>\t<content>" pairs on stdin.

set -uo pipefail

STRICT="${STRICT:-0}"
TEXT_EXT_RE='\.(md|ts|tsx|sql)$'

# --- The perl scanner: reads "<lineno>\t<content>" lines, prints a hit line
# "  <file>:<lineno>  <names>" for each offending added line, and exits with a
# count of hits via a trailing "HITS=<n>" sentinel line on its last line.
# $1 is the file label to print in hits.
run_scanner() {
  local file="$1"
  perl -CSD -e '
    my $file = shift;
    my $in_fence = 0;
    my $hits = 0;
    # Banned set: em dash, en dash, then the invisible / look-alike chars.
    my $banned = qr/[\x{2014}\x{2013}\x{200B}\x{200C}\x{200D}\x{2060}\x{FEFF}\x{00A0}\x{202F}\x{00AD}\x{200E}\x{200F}\x{FFFD}]/;
    while (my $rec = <STDIN>) {
      chomp $rec;
      my ($lineno, $content) = split(/\t/, $rec, 2);
      $content = "" unless defined $content;

      # Toggle fenced-code state on a line that opens or closes ``` or ~~~ .
      if ($content =~ /^\s*(```|~~~)/) { $in_fence = $in_fence ? 0 : 1; next; }
      next if $in_fence;

      # Best-effort: drop inline `code` spans before checking.
      (my $stripped = $content) =~ s/`[^`]*`//g;

      next unless $stripped =~ $banned;

      my @names;
      push @names, "em-dash(U+2014)"  if $stripped =~ /\x{2014}/;
      push @names, "en-dash(U+2013)"  if $stripped =~ /\x{2013}/;
      push @names, "invisible-or-lookalike-char"
        if $stripped =~ /[\x{200B}\x{200C}\x{200D}\x{2060}\x{FEFF}\x{00A0}\x{202F}\x{00AD}\x{200E}\x{200F}\x{FFFD}]/;
      printf "  %s:%s  %s\n", $file, (defined $lineno ? $lineno : "?"), join(", ", @names);
      $hits++;
    }
    print "HITS=$hits\n";
  ' "$file"
}

# Total hits accumulate here across files.
total_hits=0

# Consume one scanner's output (passed on stdin): print hit lines to stdout and
# add the HITS sentinel to total_hits. Runs in the current shell (fed via a
# process-substitution redirect, not a pipe) so total_hits survives.
consume_scanner() {
  local line n
  while IFS= read -r line; do
    case "$line" in
      HITS=*)
        n="${line#HITS=}"
        total_hits=$((total_hits + n))
        ;;
      *)
        printf '%s\n' "$line"
        ;;
    esac
  done
}

scan_file_args() {
  local f n line tmp
  tmp="$(mktemp)"
  for f in "$@"; do
    if [[ ! -f "$f" ]]; then
      printf 'check-humanized: not a file, skipping: %s\n' "$f" >&2
      continue
    fi
    [[ "$f" =~ $TEXT_EXT_RE ]] || continue
    # Emit "<lineno>\t<line>" for every line, scan, capture, then consume in the
    # current shell so the hit count is not lost to a pipeline subshell.
    n=0
    while IFS= read -r line || [[ -n "$line" ]]; do
      n=$((n + 1))
      printf '%s\t%s\n' "$n" "$line"
    done < "$f" | run_scanner "$f" > "$tmp"
    consume_scanner < "$tmp"
  done
  rm -f "$tmp"
}

scan_staged_diff() {
  local files file tmp
  files="$(git diff --cached --name-only --diff-filter=ACMR | grep -E "$TEXT_EXT_RE" || true)"
  [[ -z "$files" ]] && return 0
  tmp="$(mktemp)"
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    [[ -f "$file" ]] || continue
    # Parse the unified diff: track the new-file line number per hunk, then feed
    # only ADDED lines (a leading "+", not the "+++" header) to the scanner as
    # "<newlineno>\t<content>". Capture to a temp file, then consume in the
    # current shell so the hit count is not lost to a pipeline subshell.
    git diff --cached --unified=0 -- "$file" \
      | awk '
          /^@@ / {
            match($0, /\+[0-9]+/)
            newno = substr($0, RSTART + 1, RLENGTH - 1) + 0
            next
          }
          /^\+\+\+/ { next }
          /^\+/ {
            printf "%d\t%s\n", newno, substr($0, 2)
            newno++
          }
        ' \
      | run_scanner "$file" > "$tmp"
    consume_scanner < "$tmp"
  done <<< "$files"
  rm -f "$tmp"
}

main() {
  if ! command -v perl >/dev/null 2>&1; then
    echo "check-humanized: perl not found; cannot scan. Skipping (warn-only)." >&2
    exit 0
  fi

  if [[ $# -gt 0 ]]; then
    scan_file_args "$@"
  else
    if ! command -v git >/dev/null 2>&1; then
      echo "check-humanized: git not found and no file arguments given; nothing to scan." >&2
      exit 0
    fi
    scan_staged_diff
  fi

  if [[ $total_hits -eq 0 ]]; then
    echo "check-humanized: clean. No banned dashes or invisible characters in scanned additions."
    exit 0
  fi

  echo ""
  echo "check-humanized: found $total_hits line(s) with banned dashes or invisible characters."
  echo "Fix hint: replace em/en dashes with a period, comma, colon, parentheses, or a line break;"
  echo "          delete invisible or look-alike characters (use a normal space)."
  echo "Convention: docs/conventions/humanized-output.md"

  if [[ "$STRICT" == "1" ]]; then
    echo "check-humanized: STRICT=1, exiting non-zero."
    exit 1
  fi
  echo "check-humanized: warn-only (set STRICT=1 to fail). Exiting 0."
  exit 0
}

main "$@"

#!/usr/bin/env bash
# dashboard-tally.sh — recompute the feature-dashboard "At a glance" tally from the rows.
#
# WHY: the headline completion %, status counts, and by-priority counts are DERIVED from
# the register rows, not hand-kept. They must be refreshed in the SAME commit as every
# status flip so the dashboard is live for the founder and for every lane (founder ruling
# 2026-06-24: the headline was drifting because lanes flipped a row but never recomputed).
# This prints the exact numbers to write into the headline; it is deterministic, so on a
# rebase you just re-run it and overwrite the headline block (the numbers are never merged
# by hand). It does NOT reorder rows (that is the conflict-heavy `rerank-dashboard.py`,
# kept as a periodic reconcile) — it only reads the current rows and tallies.
#
# Usage:  bash scripts/dashboard-tally.sh        (from the repo root)

set -euo pipefail
F="docs/planning/feature-dashboard.md"
[ -f "$F" ] || { echo "no $F" >&2; exit 1; }

echo "=== status tally (strict = done/total; weighted folds ◐ at its [~NN%], ⏸️/🔨 at 0.5) ==="
awk -F'|' '/^\| [0-9]+ \|/{
    s=$3; gsub(/^[ \t]+|[ \t]+$/,"",s);
    # collapse a "🔨 In Dev (...)" status to the bare 🔨 token for weighting/counting
    if (s ~ /^🔨/) s="🔨";
    c[s]++; t++;
    w=(s=="✅")?1:(s=="◐")?(match($0,/\[~[0-9]+%\]/)?substr($0,RSTART+2,RLENGTH-4)/100:0.5):(s=="⏸️"||s=="🔨")?0.5:0;
    W+=w
  } END {
    for(k in c) printf "  %s = %d\n", k, c[k];
    printf "  total=%d  strict=%.1f%% (%d/%d)  weighted=%.2f (%.1f%%)\n", t, (c["✅"]/t)*100, c["✅"], t, W, (W/t)*100;
    printf "  not-done = %d\n", t - c["✅"]
  }' "$F"

echo "=== by-priority class (✅ rows map to Done, mirrors rerank-dashboard.py classify) ==="
awk -F'|' '/^\| [0-9]+ \|/{
    s=$3; gsub(/^[ \t]+|[ \t]+$/,"",s);
    p=$8; gsub(/^[ \t]+|[ \t]+$/,"",p);
    if(s=="✅") p="Done";
    c[p]++
  } END { for(k in c) printf "  %s = %d\n", k, c[k] }' "$F" | sort

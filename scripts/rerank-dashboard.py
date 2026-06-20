#!/usr/bin/env python3
"""Rerank + reclassify the feature-dashboard.md master register by priority.

ONE uniform system. The Rank (the `#` column) is DERIVED, never hand-kept
(like the awk tally): rows are grouped by their Priority class, sorted within a
group, and renumbered 1..N ascending so #1 is the single highest priority.

Priority classes (the uniform vocabulary; ONE per row, in the Priority column):
  Tier 1  = fundamentals / foundation / core features / core enablements / USPs (build first)
  Tier 2  = design + eye-for-detail on the core (founder-prompted)
  Tier 3  = non-essential / non-foundational (privacy, ops hygiene, enterprise-readiness)
  Tier 4  = final detailing + polish (founder-prompted, last)
  Gated   = founder-gated; ranked in place but parked until the founder unblocks it
  Lovable = Lovable-owned (built in parallel by Lovable; never a Claude pick)
  Deferred= cut / post-PMF / superseded
  Done    = shipped

Ranking order: Tier 1 < Tier 2 < Tier 3 < Tier 4 < Gated < Lovable < Deferred < Done,
then within a group by the Tier-1 fine order (below) else file order (stable). So the
active build front (Tier 1..4) gets the low ranks. An agent builds the lowest-Rank row
whose Priority is a Tier (skip Gated/Lovable/Done/Deferred) that is unclaimed.

To add a new item: add the row with its Priority class set (or leave a legacy value and
let this map it), place it among its peers, then run this script. Everything re-sequences
and the other items shift up/down by priority. It is idempotent: rows already carrying a
class keep it; legacy values (P0/P1/WM-*/BYO-*/...) are mapped once.

Usage:  python3 scripts/rerank-dashboard.py   (from the repo root)
"""
import sys, collections

PATH = "docs/planning/feature-dashboard.md"
GROUP = {"Tier 1": 0, "Tier 2": 1, "Tier 3": 2, "Tier 4": 3,
         "Gated": 4, "Lovable": 5, "Deferred": 6, "Done": 7}
KNOWN = set(GROUP)
# Tier-1 fine order (the active build front). Edit to reprioritize WITHIN Tier 1.
T1 = ["DBR-1.5", "MOAT-VIS", "F-IA-BRAIN-GRAPH", "MOAT-METRIC", "EMBED-CHOKEPOINT",
      "FIRECRAWL-FLOOR", "H1-TASKS", "W1-AUTO", "O1", "O3", "Q1 / ENG-07 / F-MCP-V1"]
T1ORD = {k: i for i, k in enumerate(T1)}

LOVABLE = {"M-C-PRICE", "WM-M3", "WM-M6", "WM-M7", "WM-M8", "WM-M13", "WM-M10", "WM-M11",
           "WM-M12", "WM-M14", "WM-M16", "WM-M17", "WM-M18", "WM-M19", "BYO-P4"}
DEFERRED = {"SEN-04", "F-AUDIO-1", "F-AUDIO-2", "K1-deploy", "F-COCKPIT-MACHINE-MODE",
            "WM-S1", "WM-S2", "WM-S3", "WM-S4", "WM-S5"}
TIER4 = {"HUMAN-SWEEP"}
GATED = {"SEN-01", "Q2", "SEN-05", "F-ANALYTICS-1", "F-ANALYTICS-2", "PLG", "SANDBOX",
         "BLD-04", "A6 / ENG-08", "F-CONN", "M-C-EXPIRY", "CMD (H2)", "BYO-P1a", "BYO-P1b",
         "BYO-P1c", "BYO-P1d", "BYO-P2", "BYO-P3", "BYO-P5"}
TIER2 = {"F-IA-V4", "F-IA-TODAY-BRIEFING", "F-IA-CULL-CALDOCS", "F-IA-AGENTS-TABS"}
TIER1 = {"DBR-1.5", "MOAT-VIS", "F-IA-BRAIN-GRAPH", "MOAT-METRIC", "EMBED-CHOKEPOINT",
         "FIRECRAWL-FLOOR", "H1-TASKS", "W1-AUTO", "O1", "O3", "Q1 / ENG-07 / F-MCP-V1",
         "DBR (H1)", "H2-WRITES", "WM-F1", "WM-F1b", "WM-F2", "WM-F3", "WM-F4", "WM-F5",
         "WM-F6", "WM-F7", "WM-F8", "WM-F9", "WM-M1", "WM-M2", "WM-M4", "WM-M5", "WM-M9", "WM-M15"}


def classify(status, current, rid):
    if status == "✅":
        return "Done"
    if current in KNOWN:
        return current
    if rid in LOVABLE: return "Lovable"
    if rid in DEFERRED: return "Deferred"
    if rid in TIER4: return "Tier 4"
    if rid in GATED: return "Gated"
    if rid in TIER2: return "Tier 2"
    if rid in TIER1: return "Tier 1"
    return "Tier 3"


lines = open(PATH).read().split("\n")
hdr = next((i for i, l in enumerate(lines)
            if l.startswith("| # | Status | ID | Feature | What it does |")), None)
if hdr is None:
    sys.exit("master register header not found; aborting")
start = hdr + 2  # skip header + separator
data_idx = []
i = start
while i < len(lines) and lines[i].startswith("| ") and lines[i].count("|") >= 9:
    data_idx.append(i)
    i += 1
rows = [lines[j] for j in data_idx]

parsed = []
for orig, ln in enumerate(rows):
    p = ln.split("|")
    rid, status = p[3].strip(), p[2].strip()
    # dedupe DATA-RETENTION-b: keep the shipped '(dormant)' row, drop the other
    if rid == "DATA-RETENTION-b" and "(dormant)" not in p[4]:
        continue
    p[7] = f" {classify(status, p[7].strip(), rid)} "
    parsed.append((orig, p, rid))

parsed.sort(key=lambda t: (GROUP.get(t[1][7].strip(), 2), T1ORD.get(t[2], 99), t[0]))

new_rows, ids = [], []
for rank, (orig, p, rid) in enumerate(parsed, 1):
    p[1] = f" {rank} "
    ids.append(rid)
    new_rows.append("|".join(p))

lines = lines[:data_idx[0]] + new_rows + lines[data_idx[-1] + 1:]
open(PATH, "w").write("\n".join(lines))

dup = [k for k, v in collections.Counter(ids).items() if v > 1]
print(f"reranked {len(rows)} -> {len(new_rows)} rows (dropped {len(rows) - len(new_rows)} dup) | "
      f"unique ids {len(set(ids))} | dup ids: {dup or 'none'}")
print("class histogram:", dict(sorted(collections.Counter(
    r.split('|')[7].strip() for r in new_rows).items())))
print("top of the rank (build these first):")
for l in new_rows[:14]:
    p = l.split("|")
    print(f"  #{p[1].strip():3} {p[2].strip():2} {p[3].strip():24} {p[7].strip()}")

#!/usr/bin/env python3
"""Regenerate the "Active claims" table in feature-dashboard.md from the live claim ledger.

The Active-claims table is DERIVED, never hand-kept (like the Rank and the % tally):
it is a git-visible mirror of the real-time ledger at ~/.cadence-parallel/claims/.
Run it on every claim AND on every ship/release so the board shows, in real time,
which lane is on which activity, since when, and with what status - and so a finished
item is removed the moment its claim is released.

Each ledger claim is a dir ~/.cadence-parallel/claims/<ID>/ with a `meta` file
(id=, lane=, globs=, note=, pinned=). The dir mtime is when it was claimed.
The CHOKEPOINT pin (pinned=true) is shown as a standing reservation, not a lane task.
The item's Rank + activity name are looked up from the Master register.

Usage:  python3 scripts/sync-active-claims.py   (from the repo root)
"""
import os, re, glob, datetime, sys

LEDGER = os.path.expanduser("~/.cadence-parallel/claims")
# resolve the dashboard relative to THIS script (scripts/) so it works from any cwd/worktree
PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "docs", "planning", "feature-dashboard.md")

# --- read the ledger ---
active, pinned = [], []
for meta_path in glob.glob(os.path.join(LEDGER, "*", "meta")):
    kv = {}
    for line in open(meta_path):
        if "=" in line:
            k, v = line.rstrip("\n").split("=", 1)
            kv[k] = v
    claimed = datetime.datetime.fromtimestamp(os.path.getmtime(os.path.dirname(meta_path)))
    rec = {"id": kv.get("id", ""), "lane": kv.get("lane", "?"),
           "globs": kv.get("globs", ""), "note": kv.get("note", ""),
           "claimed": claimed}
    (pinned if kv.get("pinned") == "true" else active).append(rec)

# --- look up Rank + activity from the register ---
lines = open(PATH).read().split("\n")
hdr = next((i for i, l in enumerate(lines) if l.startswith("| # | Status | ID | Feature | What it does |")), None)
reg = {}
if hdr is not None:
    i = hdr + 2
    while i < len(lines) and lines[i].startswith("| ") and lines[i].count("|") >= 9:
        p = lines[i].split("|")
        reg[p[3].strip()] = {"rank": p[1].strip(), "feature": p[5].strip(), "status": p[2].strip()}
        i += 1


def short_files(globs):
    parts = [g.split("/")[-1] for g in globs.split(",") if g][:2]
    extra = max(0, len([g for g in globs.split(",") if g]) - 2)
    return ", ".join(parts) + (f" +{extra}" if extra else "")


active.sort(key=lambda r: (r["lane"], r["claimed"]))
rows = ["| Lane | Rank | ID | Activity | Claimed | Status | Files |",
        "| --- | --- | --- | --- | --- | --- | --- |"]
if active:
    for r in active:
        meta = reg.get(r["id"], {})
        rank = meta.get("rank", "-")
        feat = meta.get("feature", r["note"] or r["id"])
        age_min = int((datetime.datetime.now() - r["claimed"]).total_seconds() // 60)
        when = r["claimed"].strftime("%Y-%m-%d %H:%M") + f" ({age_min}m ago)"
        rows.append(f"| lane {r['lane']} | #{rank} | {r['id']} | {feat[:60]} | {when} | 🔨 In Dev | {short_files(r['globs'])} |")
else:
    rows.append("| - | - | - | _(no lane active right now)_ | - | - | - |")

note = ""
if pinned:
    p = pinned[0]
    note = f"\n> **Standing reservation (safety, not a lane task):** `{p['id']}` pinned to lane `{p['lane']}` - {p['note']}."

block = "\n".join(rows) + "\n" + note + (f"\n> _Regenerated from the live ledger ({os.path.basename(LEDGER)}) by `scripts/sync-active-claims.py` at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}; run on every claim and every ship._" if True else "")

# --- splice into the file: replace the table block under "## Active claims" ---
start = next((i for i, l in enumerate(lines) if l.startswith("## Active claims")), None)
if start is None:
    sys.exit("'## Active claims' section not found")
# the table starts at the first "| " line after the heading; replace everything from
# there up to the next section boundary ("---" or a "## " heading), so the table + any
# trailing notes are fully replaced (no accumulation across runs).
t0 = next(i for i in range(start, len(lines)) if lines[i].startswith("| "))
t1 = t0
while t1 < len(lines) and not (lines[t1].strip() == "---" or lines[t1].startswith("## ")):
    t1 += 1
lines = lines[:t0] + block.split("\n") + [""] + lines[t1:]
open(PATH, "w").write("\n".join(lines))
print(f"Active claims synced: {len(active)} active, {len(pinned)} pinned reservation(s).")
for r in active:
    print(f"  lane {r['lane']}: {r['id']} (#{reg.get(r['id'],{}).get('rank','-')})")

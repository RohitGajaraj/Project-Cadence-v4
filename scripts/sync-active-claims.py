#!/usr/bin/env python3
"""Regenerate the LIVE build-status view from the ledger + the freshest origin register.

Why this exists: git-tracked files (the dashboard register, an Active-claims table) can
NEVER be real-time on a given machine - they only change on commit -> push -> pull. Relying
on them for "what is claimed / what is done" causes two failures the founder hit: sessions
COLLIDE on the same item (they read a stale board), and finished/in-progress status looks
wrong. The real-time truths are two LOCAL/ORIGIN sources, not the working-tree file:
  1. the atomic claim ledger at ~/.cadence-parallel (shared by every worktree, instant)  -> who is building what NOW
  2. origin/main's register (a `git fetch` away, read-only, no working-tree risk)         -> the freshest done/in-progress status

This script renders BOTH into a single GIT-IGNORED file, `docs/planning/active-claims.live.md`,
regenerated every few seconds by the `com.cadence.active-claims-sync` launchd watcher (which
also does the read-only `git fetch`). It never rots, never conflicts, needs no pull. Open it
once; your editor live-reloads it. The atomic ledger - not this file - is what PREVENTS
collisions: every session must `bash scripts/lane.sh claim <ID> <lane> "<globs>"` and proceed
only on exit 0 BEFORE doing any work.

Usage:  python3 scripts/sync-active-claims.py
"""
import os, glob, datetime, subprocess

LEDGER = os.path.expanduser("~/.cadence-parallel/claims")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = os.path.join(ROOT, "docs", "planning", "active-claims.live.md")
LANES = ["0", "1", "2", "3", "4"]


def register_text():
    """Freshest register: origin/main if reachable (read-only), else the local file."""
    r = subprocess.run(["git", "-C", ROOT, "show", "origin/main:docs/planning/feature-dashboard.md"],
                       capture_output=True, text=True)
    src = "origin/main"
    if r.returncode != 0 or not r.stdout:
        local = os.path.join(ROOT, "docs", "planning", "feature-dashboard.md")
        return (open(local).read() if os.path.exists(local) else ""), "local (origin unreachable)"
    return r.stdout, src


# --- ledger: who is building what NOW ---
by_lane, pinned = {}, []
for meta_path in glob.glob(os.path.join(LEDGER, "*", "meta")):
    kv = {}
    for line in open(meta_path):
        if "=" in line:
            k, v = line.rstrip("\n").split("=", 1)
            kv[k] = v
    rec = {"id": kv.get("id", ""), "lane": kv.get("lane", "?"), "globs": kv.get("globs", ""),
           "note": kv.get("note", ""),
           "claimed": datetime.datetime.fromtimestamp(os.path.getmtime(os.path.dirname(meta_path)))}
    if kv.get("pinned") == "true":
        pinned.append(rec)
    else:
        by_lane.setdefault(rec["lane"], []).append(rec)
claimed_ids = {r["id"]: r["lane"] for recs in by_lane.values() for r in recs}

# --- register: rank, activity, freshest status ---
reg_rows = []  # (rank_int, id, status, priority, feature)
reg_by_id = {}
text, reg_src = register_text()
lines = text.split("\n")
hdr = next((i for i, l in enumerate(lines) if l.startswith("| # | Status | ID | Feature | What it does |")), None)
if hdr is not None:
    i = hdr + 2
    while i < len(lines) and lines[i].startswith("| ") and lines[i].count("|") >= 9:
        p = [c.strip() for c in lines[i].split("|")]
        try:
            rank = int(p[1])
        except ValueError:
            i += 1
            continue
        rec = {"rank": rank, "status": p[2], "id": p[3], "feature": p[5], "priority": p[7]}
        reg_rows.append(rec)
        reg_by_id[p[3]] = rec
        i += 1


def short_files(globs):
    parts = [g.split("/")[-1] for g in globs.split(",") if g][:2]
    extra = max(0, len([g for g in globs.split(",") if g]) - 2)
    return ", ".join(parts) + (f" +{extra}" if extra else "")


now = datetime.datetime.now()

# Section 1: in progress now, per lane (from the ledger)
prog = ["| Lane | Rank | ID | Activity | Claimed | Status | Files |",
        "| --- | --- | --- | --- | --- | --- | --- |"]
active_n = 0
for ln in LANES:
    claims = sorted(by_lane.get(ln, []), key=lambda r: r["claimed"])
    if not claims:
        prog.append(f"| lane {ln} | - | - | _(idle, no active claim)_ | - | - | - |")
        continue
    for r in claims:
        active_n += 1
        m = reg_by_id.get(r["id"], {})
        feat = (m.get("feature") or r["note"] or r["id"])[:55]
        age = int((now - r["claimed"]).total_seconds() // 60)
        prog.append(f"| lane {ln} | #{m.get('rank','-')} | {r['id']} | {feat} | {r['claimed'].strftime('%H:%M')} ({age}m) | 🔨 In Dev | {short_files(r['globs'])} |")

# Section 2: top of the rank with LIVE status (done included, so finished items show as done)
TIERS = {"Tier 1", "Tier 2", "Tier 3", "Tier 4"}
tier_rows = [r for r in sorted(reg_rows, key=lambda x: x["rank"]) if r["priority"] in TIERS]
done_n = sum(1 for r in tier_rows if r["status"] == "✅")
queue = ["| State | Rank | ID | Priority | Status (origin) | Who |",
         "| --- | --- | --- | --- | --- | --- |"]
shown = 0
for r in tier_rows:
    claimed_lane = claimed_ids.get(r["id"])
    if r["status"] == "✅":
        state, who = "✓ done", "-"
    elif claimed_lane:
        state, who = f"🔒 building", f"lane {claimed_lane}"
    else:
        state, who = "🟢 FREE", "-"
    queue.append(f"| {state} | #{r['rank']} | {r['id']} | {r['priority']} | {r['status']} | {who} |")
    shown += 1
    if shown >= 18:
        break

resv = "".join(f"\n- `{p['id']}` (lane `{p['lane']}`) - {p['note']}" for p in pinned)
content = (
    "# Build status - LIVE (auto-generated; do not edit)\n\n"
    f"> **The real-time view of who is building what + what is next.** Regenerated every few seconds by the "
    f"`com.cadence.active-claims-sync` watcher from the atomic claim ledger (`~/.cadence-parallel`, instant) and "
    f"origin/main's register (read-only `git fetch`, no pull needed). **Git-ignored** - it never rots, never conflicts. "
    f"Instant CLI view: `bash scripts/lane.sh board`.\n>\n"
    f"> **Updated {now.strftime('%Y-%m-%d %H:%M:%S')}** | active lanes: {active_n} | Tier items done: {done_n} | register source: {reg_src}\n>\n"
    f"> **COLLISIONS ARE PREVENTED BY THE LEDGER, NOT THIS FILE.** Before any work, a session MUST run "
    f"`bash scripts/lane.sh claim <ID> <lane> \"<globs>\"` and proceed only if it returns success (exit 0 = won). "
    f"A `HELD`/`CONFLICT` result means another lane has it - pick the next 🟢 free item below. Never start work before claiming.\n\n"
    "## In progress now (per lane)\n\n" + "\n".join(prog) + "\n\n"
    "## Top of the rank - LIVE status (✓ done · 🔒 building · 🟢 free)\n\n" + "\n".join(queue) + "\n\n"
    + ("## Standing reservations (safety, not a lane task)" + resv + "\n" if pinned else "")
)
open(LIVE, "w").write(content)
print(f"live status updated: {active_n} active, {len(pinned)} reserved, register from {reg_src} -> {os.path.relpath(LIVE, ROOT)}")

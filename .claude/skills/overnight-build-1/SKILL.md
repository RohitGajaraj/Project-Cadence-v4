---
name: overnight-build-1
description: Launch parallel build Lane 1 (Cockpit / observability - R3-PREFS notification prefs + P7 incidents/cost-incident log) in its own worktree session, auto-starting the scoped /overnight-build loop. Cadence repo only.
---

# Parallel build - Lane 1 (Cockpit / observability)

Launches **Lane 1**: worktree `cadence-cockpit`, branch `parallel/cockpit`. Builds R3-PREFS (notification preferences) then P7 (incidents + cost-incident log). Full scope lives in that worktree's `.remember/LANE.md`.

A Claude Code session cannot relocate itself to another worktree, so this skill OPENS Lane 1's own session (a new terminal window/tab in the worktree) which auto-starts the loop. Run:

```bash
bash "/Users/rohitgajaraj/Projects/My Projects/My Builds/Project-Cadence-v4/scripts/parallel-build.sh" cockpit
```

If you are ALREADY inside the `cadence-cockpit` worktree, do not open another - just invoke `/overnight-build` (playbook section 16 scopes it to this lane automatically).

Full lane map, model switching, and cross-tool usage: `PARALLEL-BUILD.md` at the repo root.

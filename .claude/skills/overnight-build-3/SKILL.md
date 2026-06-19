---
name: overnight-build-3
description: Launch parallel build Lane 3 (Safety / Governance - FND-0.5 agent blast-radius + FND-0.7 learned injection classifier) in its own worktree session, auto-starting the scoped /overnight-build loop. Cadence repo only.
---

# Parallel build - Lane 3 (Safety / Governance)

Launches **Lane 3**: worktree `cadence-safety`, branch `parallel/safety`. Builds FND-0.5 (per-agent tool allow-list + product scope) then FND-0.7 (learned prompt-injection classifier + quarantine). Full scope lives in that worktree's `.remember/LANE.md`.

A Claude Code session cannot relocate itself to another worktree, so this skill OPENS Lane 3's own session (a new terminal window/tab in the worktree) which auto-starts the loop. Run:

```bash
bash "/Users/rohitgajaraj/Projects/My Projects/My Builds/Project-Cadence-v4/scripts/parallel-build.sh" safety
```

If you are ALREADY inside the `cadence-safety` worktree, do not open another - just invoke `/overnight-build` (playbook section 16 scopes it to this lane automatically).

Full lane map, model switching, and cross-tool usage: `PARALLEL-BUILD.md` at the repo root.

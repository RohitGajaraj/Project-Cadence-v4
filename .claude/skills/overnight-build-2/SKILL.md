---
name: overnight-build-2
description: Launch parallel build Lane 2 (Knowledge / Sense - O1 knowledge-graph explorer + O3 fact-drift / skill-pack export) in its own worktree session, auto-starting the scoped /overnight-build loop. Cadence repo only.
---

# Parallel build - Lane 2 (Knowledge / Sense)

Launches **Lane 2**: worktree `cadence-knowledge`, branch `parallel/knowledge`. Builds O1 (typed knowledge-graph explorer) then O3 (fact-currency/drift flags + versioned skill-pack export). Full scope lives in that worktree's `.remember/LANE.md`.

A Claude Code session cannot relocate itself to another worktree, so this skill OPENS Lane 2's own session (a new terminal window/tab in the worktree) which auto-starts the loop. Run:

```bash
bash "/Users/rohitgajaraj/Projects/My Projects/My Builds/Project-Cadence-v4/scripts/parallel-build.sh" knowledge
```

If you are ALREADY inside the `cadence-knowledge` worktree, do not open another - just invoke `/overnight-build` (playbook section 16 scopes it to this lane automatically).

Full lane map, model switching, and cross-tool usage: `PARALLEL-BUILD.md` at the repo root.

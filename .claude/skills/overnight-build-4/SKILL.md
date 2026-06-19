---
name: overnight-build-4
description: Launch parallel build Lane 4 (Build / Studio - F-BUILDER-MULTIFILE scoped multi-file build) in its own worktree session, auto-starting the scoped /overnight-build loop. Cadence repo only.
---

# Parallel build - Lane 4 (Build / Studio)

Launches **Lane 4**: worktree `cadence-build`, branch `parallel/build`. Builds F-BUILDER-MULTIFILE (scoped multi-file build: pre-declared touch list + max-N files). Full scope lives in that worktree's `.remember/LANE.md`.

A Claude Code session cannot relocate itself to another worktree, so this skill OPENS Lane 4's own session (a new terminal window/tab in the worktree) which auto-starts the loop. Run:

```bash
bash "/Users/rohitgajaraj/Projects/My Projects/My Builds/Project-Cadence-v4/scripts/parallel-build.sh" build
```

If you are ALREADY inside the `cadence-build` worktree, do not open another - just invoke `/overnight-build` (playbook section 16 scopes it to this lane automatically).

Full lane map, model switching, and cross-tool usage: `PARALLEL-BUILD.md` at the repo root.

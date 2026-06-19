# memory.md — Memory layers (User Memory + Project Memory)

> _Created: 2026-06-11 · Last updated: 2026-06-11_

> Cadence's work spans two distinct memory stores. They sound similar ("memory" vs "remember") — so this file names them clearly and says exactly **where each lives and what goes in it.** Operating rules: [`AGENTS.md`](../../AGENTS.md). Session boot via hooks: [`hooks.md`](./hooks.md).

## The two layers at a glance

| Layer | Clear name                    | Scope                                                            | Where it is stored                                                              | What goes in it                                                            |
| ----- | ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1     | **User Memory** (auto-memory) | The _person_, across **all** their projects (user/account level) | The Claude Code auto-memory store (outside this repo), indexed in a `MEMORY.md` | Durable facts about the user, validated preferences, cross-project context |
| 2     | **Project Memory**            | **This project only**                                            | The project-local `.remember/` folder in this repo                              | Session logs, decisions, and learnings specific to Cadence                 |

Rule of thumb: _"Is this true no matter what project I'm in?"_ → **User Memory.** _"Is this about Cadence specifically?"_ → **Project Memory** (`.remember/`). If both, write both and keep them in sync.

> Note: the project-local folder is named `.remember/` (a Claude Code session convention the SessionStart hook reads — see [`hooks.md`](./hooks.md)). We keep that folder name for tool compatibility, but refer to its _contents_ as **Project Memory** for clarity.

---

## Layer 1 — User Memory (cross-project, auto-memory)

Persistent across sessions and projects. Four types: `user`, `feedback`, `project`, `reference`. Files use frontmatter (`name`, `description`, `metadata.type`); indexed in `MEMORY.md`.

| Type        | Save when                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `user`      | Durable facts about the person (role, preferences, knowledge). Not negative judgments.                                                  |
| `feedback`  | The user corrects your approach OR validates a non-obvious one. Save both. Lead with the rule, then `**Why:**` and `**How to apply:**`. |
| `project`   | Cross-project initiatives, deadlines, motivations. Convert relative dates to absolute.                                                  |
| `reference` | Pointers to external systems (Linear projects, Slack channels, dashboards).                                                             |

**Do not save:** code patterns, conventions, architecture, file paths (read current state instead); git history (use `git log`/`blame`); debugging recipes (the fix is in the code); anything already in [`AGENTS.md`](../../AGENTS.md) or its linked docs; ephemeral task state (use tasks). These hold even when asked — if asked to save a list, ask what was _surprising_ or _non-obvious_.

**Before recommending from User Memory:** records can be stale. A claim that file X exists or flag Y is set was true _when written_ — verify against current code/git before acting.

## Layer 2 — Project Memory (`.remember/`, this project only)

Visible at session start (via the SessionStart hook). Append after non-trivial work on Cadence.

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `now.md`              | Live buffer for the active session.  |
| `today-YYYY-MM-DD.md` | Daily log.                           |
| `recent.md`           | Last 7 days.                         |
| `archive.md`          | Older history.                       |
| `core-memories.md`    | Pivotal, identity-shaping decisions. |

Append after shipping a non-trivial change, discovering a non-obvious fact future-you will want, or a framing shift. This is part of the **closed documentation loop** ([`AGENTS.md`](../../AGENTS.md), section 5): learnings get logged, not lost. When in doubt, search `.remember/` before re-deriving knowledge a past session produced.

## Memory vs plans/tasks

Memory is for the _next_ conversation. For the _current_ one, use **Plans** (implementation alignment) and **Tasks** (discrete steps with progress). Do not save in-progress state to memory.

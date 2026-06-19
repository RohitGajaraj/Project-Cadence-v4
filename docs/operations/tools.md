# tools.md — Tool conventions

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> When to use which tool. Keeps tool calls cheap, correct, and reviewable. Operating rules: [`AGENTS.md`](../../AGENTS.md). This file was referenced across the docs but missing — it now exists.

## File and search tools (use the dedicated tool, not Bash)

| Need                          | Tool              | Not                   |
| ----------------------------- | ----------------- | --------------------- |
| Find files by name/pattern    | `Glob`            | `find`, `ls`          |
| Search file contents          | `Grep`            | `grep`, `rg` in Bash  |
| Read a known file             | `Read`            | `cat`, `head`, `tail` |
| Edit an existing file         | `Edit`            | `sed`, `awk`          |
| Create / fully rewrite a file | `Write`           | `echo >`, heredoc     |
| Open-ended multi-round search | `Agent` (Explore) | repeated manual greps |

Reserve `Bash` for actually running things (installs, builds, tests, migrations, git). Quote paths with spaces.

## Read/Edit/Write discipline

- **Read before Edit/Write on existing files.** The tools track read-state by absolute path. After any `mv`/`git mv`, re-Read at the new path (see [`AGENTS.md`](../../AGENTS.md), section 7).
- **Prefer `Edit` over `Write` for changes** — it sends only the diff. Use `Write` for new files or full rewrites.
- **Surgical edits only.** Every changed line traces to the task ([`AGENTS.md`](../../AGENTS.md), section 3).

## Bash discipline

- Batch independent commands into one message with parallel calls; chain dependent ones with `&&`.
- Use `run_in_background` for long-running processes; do not poll with `sleep`.
- Package managers: `npm`/`bun` as the repo uses; for Python use the repo's environment convention.
- Never run destructive git (`reset --hard`, `push --force`, branch delete) without explicit approval. See [`commits.md`](./commits.md).

## Tasks

- Create tasks for any multi-step work; set `in_progress` when starting, `completed` when done.
- Do not batch-complete at the end — update as you go ([`AGENTS.md`](../../AGENTS.md), section 1).
- Include a verification step for non-trivial work (tests, screenshots, diff review).

## Subagents (Agent/Task tool)

- Selection and briefing guidance: [`subagents.md`](./subagents.md).
- Launch independent subagents in a single message to run them concurrently.
- Verify a code-writing subagent's diff before reporting done.

## Web and docs

- For library docs, prefer the `context7-plugin` over raw web fetch.
- For current facts, search before answering — do not rely on training for present-day state.

## Product / runtime tools (inside the app)

Tool calls _the product's agents_ make (e.g. `search_workspace`, `create_task`, `create_linear_issue`, `write_doc`, `run_eval`, `delegate_to_agent`) are a product capability with their own allow-list and audit log. Their contract lives in [`architecture/runtime.md`](../../architecture/runtime.md) and [`architecture/integrations.md`](../../architecture/integrations.md) — not here.

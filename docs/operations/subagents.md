# subagents.md — Working with engineering subagents

> _Created: 2026-06-11 · Last updated: 2026-06-11_

> How to pick, brief, and trust the agents you (Claude / Codex / Antigravity / Gemini) delegate to. Operating rules: [`AGENTS.md`](../../AGENTS.md). Skills: [`skills.md`](./skills.md).
>
> **Note on naming:** this file is `subagents.md`, not `agents.md`, to avoid a case-insensitive collision with the cross-tool standard [`AGENTS.md`](../../AGENTS.md). Two different concepts; two different files.

## Two kinds of "agent" — do not confuse them

| Kind                      | What it is                                                                                                                                                                                                                                                                                                                                          | Where it lives                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product agents**        | The in-product specialists Cadence runs for the user — 6 outcome-focused durable agents (Orchestrator, Discovery, Strategist, Builder, Growth, Analyst) plus ephemeral specialists spawned by Orchestrator per task. Each agent owns a clear lifecycle band; fixed seats for micro-roles are avoided. Full roster with persona mapping: plan.md §6. | Seeded in the `agents` table. Configured via `system_prompt`, `tool_allowlist`, `default_model`, `temperature`, `approval_mode`, `memory_enabled`. Full roster and rationale: [`plan.md`](../../plan.md) §6. |
| **Engineering subagents** | The ones you delegate to via the `Agent`/Task tool.                                                                                                                                                                                                                                                                                                 | Provided by the harness + plugins. Active list appears in the session reminder.                                                                                                                          |

This doc is meta-guidance for **engineering agents & subagents**. Product agents are a product capability — schema changes need a migration and a [`plan.md`](../../plan.md) update.

## When to delegate

- **Parallelizable independent work** — multiple file searches, multiple reviewers across surfaces.
- **Large intermediate output** you do not want polluting main context — broad codebase exploration.
- **A specialized agent's description fits** — match its purpose, do not force-fit.

If a task is single-step and you know the target, use the direct tool. Do not delegate routine reads, greps, or edits.

## Default picks for this repo

| Goal                                          | Subagent                                              |
| --------------------------------------------- | ----------------------------------------------------- |
| Open-ended code search across many files      | `Explore`                                             |
| Implementation plan for a non-trivial feature | `Plan` or `ecc:planner`                               |
| Architectural design                          | `ecc:architect` / `ecc:code-architect`                |
| Trace how a feature works end-to-end          | `ecc:code-explorer`                                   |
| Library docs lookup                           | `ecc:docs-lookup` / `context7-plugin:docs-researcher` |
| TS/JS review post-change                      | `ecc:typescript-reviewer`                             |
| React/Tailwind UI review                      | `ecc:typescript-reviewer` + `ecc:a11y-architect`      |
| DB / migration / RLS review                   | `ecc:database-reviewer`                               |
| Security review (auth, BYO keys, hooks)       | `ecc:security-reviewer`                               |
| Test coverage for a PR                        | `ecc:pr-test-analyzer`                                |
| Silent-failure / swallowed-error hunt         | `ecc:silent-failure-hunter`                           |
| Documentation pass                            | `ecc:doc-updater`                                     |
| E2E test creation / repair                    | `ecc:e2e-runner`                                      |
| Build / type error fix                        | `ecc:build-error-resolver`                            |

The above suggested agent's list is for a short use case, for example, and the preferences are just an example. You have a vast, huge amount of skills and agents available for your disposal. Please always look into the library that's installed and available to you, and also look into the respective folders. What skills make sense? Please invoke them accordingly and plan for it accordingly. You are free to invoke everything. I want you to first prefer skills and agents first rather than you trying to do the task on your own first.

## How to brief a subagent

Brief it like a smart colleague who just walked in with zero context.

- State the goal in one sentence.
- Give enough background that it can make judgment calls.
- Specify what to check and what form the answer should take.
- Terse one-line prompts produce shallow output. Be specific.

## Trust but verify

A subagent's summary describes what it _intended_ to do. For any code-writing agent, read the diff before declaring done.

## Anti-patterns

- Invoking five reviewers for a 20-line change. Pick one.
- Running multiple planners for the same feature. Pick one.
- Delegating routine reads or one-line greps. Just do them.
- Repeating a search a subagent is already running. Wait for its result.

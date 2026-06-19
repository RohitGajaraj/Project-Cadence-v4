# commits.md - Commit discipline

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> How code lands. Strict because one operator working with a swarm of agents cannot afford ambiguous git state. Operating rules: [`AGENTS.md`](../../AGENTS.md).
>
> **Policy vs. enforcement.** This file is the _policy_ - what/when/how to commit (human judgment). The mechanical _enforcement_ (blocking `--no-verify`, requiring `gstack`, refusing force-push to `main`) runs as a Claude Code `PreToolUse` hook - see [`hooks.md`](./hooks.md). Policy decides intent; the hook guarantees the invariants.

## Use a commit skill - scan first, then act

Before committing, scan available commit and ship skills in your session. Good defaults if available: `gstack-ship`, `commit-commands:commit`. Always pick the best fit from what is installed - do not default to one tool without checking.

If no commit skill is available, use `git commit` directly with the message discipline below.

- **Never** `--no-verify` or `--no-gpg-sign` unless explicitly asked.
- **Never** force-push to `main`. Warn even if asked.
- Co-author trailer on AI-assisted commits as configured for the repo.

The commit discipline (message quality, git WHY rule, no bypass) is what matters - not which skill executes it.

## The WHY rule - every git action needs a one-line reason

**Every git interaction must carry a clear, one-line explanation of the WHY - not just the WHAT.** The diff shows the WHAT; the commit/push/pull message explains the WHY and the context. This is a standing, cross-tool rule (Claude Code, Lovable, Antigravity, Gemini CLI) and applies equally to:

- **Commits** (`git commit`, `gstack commit`)
- **Pushes** (`git push`, `gstack push`)
- **Pulls** (`git pull`)
- **Branch operations** (`git checkout`, `git branch`, `git merge`)
- **Resets or rewrites** (never without explicit approval)

### What belongs in the WHY

1. **Context** - which feature, epic, or ticket this serves (e.g., "FND-KILLSWITCH 0.6", "F1.2 Signal card").
2. **Goal** - what the change accomplishes (e.g., "add Pantone guidance for AI color selection", "fix multi-tenancy routing in chokepoint").
3. **Risk or consideration** - if relevant (e.g., "breaking change to /api/sync endpoint", "requires design.md review before ship", "blocks Lovable until merged").

### Examples for push / pull / merge

Pushes, pulls, and merges are easy to fire off bare. Each still needs the one-line WHY:

- **Push** - `git push - landing foundation-hardening work from active-task; FND-KILLSWITCH design pass complete`
- **Pull** - `git pull - sync latest from main before resuming F1.2 Signal card work; check for conflicts in design.md`
- **Merge** - `git merge origin/main - pulling latest auth fixes for security audit; recompute active-task.md after merge`
- **Branch create** - `git checkout -b feature/fnd-color-audit - preparing isolated work for Pantone palette assessment; will rebase to main`

## Timestamp discipline (date + time, for an audit trail)

**Every NEW dated entry across the project carries both the date AND the time, in `YYYY-MM-DD HH:MM` form** (not just the overnight build report). This covers the live build log in [`../../plan.md`](../../plan.md) §4, the feature dashboard's Recent log, the strategy [`session-decisions.md`](../strategy/session-decisions.md), and any status or handoff doc. A bare date loses the ordering of work within a day; the time restores it, so a future reader or tool can reconstruct exactly when each change landed.

- **Forward-only, no historical backfill.** This rule applies to entries written from 2026-06-18 onward. Do NOT spend time or tokens retro-stamping old entries; a date-only history is fine. Recent entries (today/yesterday) may get a time if the data point is already on hand, but never backfill day-one history.
- **Source the timestamp from the clock, never guess it:** `date "+%Y-%m-%d %H:%M"`.
- **Stamp at the moment of the action:** capture the start-of-build (or commit) time, so the entry reflects when the work actually happened, not when the doc was later tidied.

This is on equal footing with the WHY rule above, and applies across all tools (Claude Code, Lovable, Antigravity, Gemini).

## When a hook fails

A pre-commit hook failure means the commit did **not** happen. **Do not `--amend`** - that would modify the previous commit and lose work.

1. Read the hook output.
2. Fix the underlying issue.
3. Re-stage and create a **new** commit.

## Branching

- `main` is the primary branch and default PR base.
- For doc-only or scoped changes, ask whether to commit to `main` or a branch.
- **Default for documentation rewrites: stage, do not commit** - confirm with the user first.

## What to stage

- Stage specific files by name when the change is contained.
- Use `git add -A` only after `git status` confirms nothing sensitive (`.env`, credentials, large binaries) is in the tree.

## PRs

- One bundled PR is often right for refactors here - splitting creates churn.
- Title under 70 chars. Body: `## Summary` + `## Test plan`.
- Return the URL after opening.

## Commit messages

Follow the repo's existing style (check `git log`). Conventional-Commits-ish prefixes: `feat(scope)`, `fix(scope)`, `docs(scope)`, `chore(scope)`. Focus on the _why_ - the diff shows the _what_.

A good commit message states the WHAT on the subject line and the WHY in the body:

```
fix(auth): prevent session token duplication on concurrent requests

Root cause: stream chokepoint was not deduping in-flight requests. Added
unique requestId tracking to prevent double-auth. Fixes flaky tests in
multi-request auth scenarios. Depends on: foundation tenancy retrofit.
```

The next engineer (or agent) can then understand the context of the fix without reading the diff.

## Destructive ops - ask first

Deleting branches, `git reset --hard`, force-pushing anywhere (refuse for `main`), `rm -rf` on tracked files outside the change. One past approval does not extend forward.

## Never commit without explicit ask

Only commit when the user requests it. After a long task, default to **stage, do not commit** - surface what is staged and let the user decide. See [`AGENTS.md`](../../AGENTS.md), section 6.

## Quick reference

| Action            | Required              | Format                                                                                |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------- |
| **Commit**        | Yes                   | `<type>(<scope>): <what>` + newline + `<why this matters>` + newline + `Ticket: <ID>` |
| **Push**          | Yes                   | `git push - <ticket> · <task summary>`                                                 |
| **Pull**          | Yes                   | `git pull - <reason for sync> · <what to check after>`                                 |
| **Merge**         | Yes                   | `git merge <branch> - <why needed>` + note any breaking changes                        |
| **Branch create** | Yes                   | `git checkout -b <branch> - <purpose>`                                                 |
| **Rebase**        | Yes (with approval)   | Ask first, include reason, document in the SSOT section 0 (the live cursor)            |
| **Force-push**    | No (to main)          | Refuse. Allow to feature branches with dated approval only.                            |
| **Reset --hard**  | No (to main)          | Refuse. Allow to local branches with confirmation.                                     |

## What this enables

1. **Asynchronous handoffs.** Future tools can read your commit message and understand why the change was made without asking.
2. **Audit trail.** Product leadership can review what was shipped and why by reading commit messages.
3. **Incident debugging.** When something breaks, commit history tells you not just _what_ changed but _why_ it seemed like the right change at the time.
4. **Multi-tool coherence.** All tools (Claude Code, Lovable, Antigravity, Gemini CLI) speak the same language.

## Related documents

- [`hooks.md`](./hooks.md) - hook enforcement rules.
- [`AGENTS.md`](../../AGENTS.md) §3 - engineering rules; §5 - the closed documentation loop (git changes must update docs); §6 - never commit without explicit ask.

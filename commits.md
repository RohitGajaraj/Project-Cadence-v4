# commits.md — Commit discipline

> How code lands. Strict because one operator working with a swarm of agents cannot afford ambiguous git state. Operating rules: [`AGENTS.md`](./AGENTS.md).
>
> **Policy vs. enforcement.** This file is the *policy* — what/when/how to commit (human judgment). The mechanical *enforcement* (blocking `--no-verify`, requiring `gstack`, refusing force-push to `main`) runs as a Claude Code `PreToolUse` hook — see [`hooks.md`](./hooks.md). Policy decides intent; the hook guarantees the invariants.

## Use a commit skill — scan first, then act

Before committing, scan available commit and ship skills in your session. Good defaults if available: `gstack-ship`, `commit-commands:commit`. Always pick the best fit from what is installed — do not default to one tool without checking.

If no commit skill is available, use `git commit` directly with the message discipline below.

- **Never** `--no-verify` or `--no-gpg-sign` unless explicitly asked.
- **Never** force-push to `main`. Warn even if asked.
- Co-author trailer on AI-assisted commits as configured for the repo.

The commit discipline (message quality, git WHY rule, no bypass) is what matters — not which skill executes it. Full cross-tool git standard: [`docs/git-discipline.md`](./docs/git-discipline.md).

## When a hook fails
A pre-commit hook failure means the commit did **not** happen. **Do not `--amend`** — that would modify the previous commit and lose work.
1. Read the hook output.
2. Fix the underlying issue.
3. Re-stage and create a **new** commit.

## Branching
- `main` is the primary branch and default PR base.
- For doc-only or scoped changes, ask whether to commit to `main` or a branch.
- **Default for documentation rewrites: stage, do not commit** — confirm with the user first.

## What to stage
- Stage specific files by name when the change is contained.
- Use `git add -A` only after `git status` confirms nothing sensitive (`.env`, credentials, large binaries) is in the tree.

## PRs
- One bundled PR is often right for refactors here — splitting creates churn.
- Title under 70 chars. Body: `## Summary` + `## Test plan`.
- Return the URL after opening.

## Commit messages
Follow the repo's existing style (check `git log`). Conventional-Commits-ish prefixes: `feat(scope)`, `fix(scope)`, `docs(scope)`, `chore(scope)`. Focus on the *why* — the diff shows the *what*.

## Destructive ops — ask first
Deleting branches, `git reset --hard`, force-pushing anywhere (refuse for `main`), `rm -rf` on tracked files outside the change. One past approval does not extend forward.

## Never commit without explicit ask
Only commit when the user requests it. After a long task, default to **stage, do not commit** — surface what is staged and let the user decide. See [`AGENTS.md`](./AGENTS.md), section 6.

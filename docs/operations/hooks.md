# hooks.md — Claude Code hooks (automation & enforcement)

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> How this repo uses Claude Code hooks to _enforce_ policy automatically. Operating rules: [`AGENTS.md`](../../AGENTS.md). Commit policy: [`commits.md`](./commits.md). Tool conventions: [`tools.md`](./tools.md).
>
> **Why this file exists:** the founder asked whether commit discipline should move under "hooks." The decision: **policy decides intent (what/when to commit) — hooks enforce invariants (mechanically block violations).** Keep [`commits.md`](./commits.md) as the policy; use a hook to enforce it. Both, not either.

## What hooks are

Claude Code hooks run a command (or `http` / `mcp_tool` / `prompt` / `agent` handler) automatically on lifecycle events, configured in `.claude/settings.json` (project, committed/shared) or `~/.claude/settings.json` (user). Events fire in three cadences:

- **Per-session:** `SessionStart`, `SessionEnd`.
- **Per-turn:** `UserPromptSubmit`, `Stop`, `SubagentStop`.
- **Per-tool-call:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`.
  Plus `Notification`, `PreCompact`, `TaskCreated`/`TaskCompleted`, `WorktreeCreate`, etc.

Control flow: a `PreToolUse` hook runs _before_ the tool and can **block** it (exit code 2); `PostToolUse` runs after and cannot undo. Matchers narrow by tool name (`Bash`, `Edit|Write`, `mcp__.*`) and an `if` permission rule can narrow further (e.g. `Bash(git *)`). Stdout JSON is parsed on exit 0. Official docs: https://code.claude.com/docs/en/hooks.

## How Cadence uses hooks

**1. Enforce commit discipline (not initiate it).** Auto-committing on `Stop` produces noisy, meaningless commits — hooks fire on machine events, not on the judgment that a logical unit of work is done. So we do **not** auto-commit. Instead, a `PreToolUse` hook on `Bash(git commit *)` enforces [`commits.md`](./commits.md): block `--no-verify`/`--no-gpg-sign`, require use of a commit skill (gstack-ship, commit-commands:commit, or similar — check available skills), refuse force-push to `main`. Policy decides _whether/what_ to commit; the hook guarantees the invariants hold.

**2. Enforce engineering invariants.** Optional `PostToolUse` on `Edit|Write` to run a formatter/linter; a `PreToolUse` guard that blocks edits to `supabase/migrations/*` already applied (never edit migrations in place — see [`architecture/data.md`](../../architecture/data.md)).

**3. Session context.** `SessionStart` can surface `.remember/` ([`memory.md`](./memory.md)) and the active task list so a new session boots with context.

## Configuration home

Hook definitions live in `.claude/settings.json` (shared, committed). Keep them thin and deterministic — enforcement and guardrails, not behavior the model should reason about. Behavior lives in [`AGENTS.md`](../../AGENTS.md); hooks make a few invariants non-bypassable.

## Two different things both called "hooks" (disambiguation)

This matters — they are not the same:

1. **Dev-time hooks (this file):** Claude Code lifecycle hooks in `.claude/settings.json`. Event-triggered (a tool call, a turn ending, a session starting) — _not_ a cron scheduler. They enforce invariants and automate developer-workflow steps while building Cadence.
2. **Product runtime automation (different layer):** Cadence's _own_ scheduled/event automation that runs the product — `pg_cron` → `/api/public/hooks/*` endpoints, plus the orchestration automation engine (triggers → missions). That lives in [`architecture/orchestration.md`](../../architecture/orchestration.md) and [`architecture/runtime.md`](../../architecture/runtime.md), not here. If you mean "run an agent on a schedule for a user," that is the product layer, not Claude Code hooks.

## Hooks this repo configures (actionable spec)

Set these in `.claude/settings.json` (committed). Keep them deterministic — enforcement + workflow automation, not model reasoning.

| Event                   | Matcher / when                                           | Action                                                                                                                                                                     | Purpose                                                                                   |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `PreToolUse`            | `Bash(git commit *)` / `Bash(git push *)`                | Block `--no-verify`/`--no-gpg-sign`; require use of a commit skill (gstack-ship, commit-commands:commit, or similar — check available skills); refuse force-push to `main` | Enforce [`commits.md`](./commits.md) mechanically                                         |
| `PreToolUse`            | `Edit\|Write` on `supabase/migrations/*` already applied | Block                                                                                                                                                                      | Never edit applied migrations in place ([`architecture/data.md`](../../architecture/data.md)) |
| `PostToolUse`           | `Edit\|Write` on source files                            | Run formatter/linter; report                                                                                                                                               | Keep the tree clean automatically                                                         |
| `Stop` / `SubagentStop` | end of a work turn                                       | Remind/verify the **closed documentation loop**: were the relevant docs + the active build log ([`plan.md`](../../plan.md) section 4) updated?                                 | Make [`AGENTS.md`](../../AGENTS.md) section 5 non-optional                                    |
| `SessionStart`          | new session                                              | Surface Project Memory (`.remember/`) + the active task list                                                                                                               | Boot with context ([`memory.md`](./memory.md))                                            |

### Sample `.claude/settings.json` (illustrative shape)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "if": "Bash(git commit *)",
        "command": "scripts/enforce-commit-policy.sh"
      }
    ],
    "PostToolUse": [{ "matcher": "Edit|Write", "command": "scripts/format-and-lint.sh" }],
    "Stop": [{ "command": "scripts/remind-doc-loop.sh" }],
    "SessionStart": [{ "command": "scripts/load-project-memory.sh" }]
  }
}
```

Exact handler shape follows the official schema (https://code.claude.com/docs/en/hooks); the scripts are thin and live in the repo. Where a hook only needs to _remind_ (not block), it prints guidance on exit 0; where it must _enforce_, a `PreToolUse` hook blocks on exit 2.

## Humanized-output guard (`scripts/check-humanized.sh`)

This is the build-time half of the humanized-output convention ([`../conventions/humanized-output.md`](../conventions/humanized-output.md)). The runtime half (the `humanizeText()` sanitizer at the AI chokepoint) already ships in `src/lib/ai/humanize.ts`; this script is the author-side backstop that catches a banned character before it lands in the repo.

**What it does.** It scans the staged diff (`git diff --cached`) and flags, in ADDED lines of staged TEXT files (`*.md`, `*.ts`, `*.tsx`, `*.sql`), any em dash (U+2014), en dash (U+2013), or invisible / look-alike character from the convention set (U+200B, U+200C, U+200D, U+2060, U+FEFF, U+00A0, U+202F, U+00AD, U+200E, U+200F, U+FFFD). It best-effort skips obvious code so a legitimate dash inside a sample is not flagged: fenced triple-backtick (or triple-tilde) blocks, and inline backtick code spans on the same line. Each hit prints as `file:line` with the offending codepoint named and a fix hint. The detection engine is `perl -CSD` (Unicode codepoint matching), chosen because BSD `grep` on macOS has no `-P` / PCRE option.

**Warn-only by default, strict opt-in.** The script always exits 0 and prints a clear warning, so it can never block a commit or a session. Set `STRICT=1` to make it exit non-zero on any hit (for a CI gate or a blocking pre-commit hook). This is deliberate: the founder ruling deferred the full retroactive product sweep to a pre-launch gate, so a hard block now would create churn. The guard surfaces new fingerprints without stopping work.

**Run it manually.**

```bash
# Scan the staged diff (warn-only). Always exits 0.
scripts/check-humanized.sh

# Same, but fail (exit 1) on any hit. Use in CI or a blocking hook.
STRICT=1 scripts/check-humanized.sh

# Scan specific files whole (not a diff), e.g. before staging them.
scripts/check-humanized.sh README.md src/lib/ai/prompts.server.ts
```

**Ready-to-enable Claude Code hook (opt-in, not live).** We do NOT register this as a live blocking hook in `.claude/settings.json` (a hard gate now would conflict with the deferred-sweep ruling, and a warn-only check fits a reminder cadence better than a block). When we are ready to turn it on, add a `PreToolUse` matcher on `Bash(git commit *)`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "if": "Bash(git commit *)",
        "command": "scripts/check-humanized.sh"
      }
    ]
  }
}
```

Left warn-only (no `STRICT=1`), that prints the warning on exit 0 and lets the commit proceed; to make it block, set `STRICT=1` in the command (`STRICT=1 scripts/check-humanized.sh`) so a hit returns exit 1 and the `PreToolUse` hook stops the tool.

**Git pre-commit snippet (alternative, tool-agnostic).** For a plain git hook outside Claude Code, drop this in `.git/hooks/pre-commit` (warn-only shown; prefix `STRICT=1` to block):

```bash
#!/usr/bin/env bash
scripts/check-humanized.sh
# To block instead: STRICT=1 scripts/check-humanized.sh || exit 1
```

The buzzword / template checks from the convention are intentionally NOT in this script. Those need human judgment (a buzzword is sometimes the right word), so they stay a manual review step per the convention's "How to apply" block.

## Cross-tool note

Dev-time hooks are a Claude Code mechanism. The _policies_ they enforce ([`commits.md`](./commits.md), [`AGENTS.md`](../../AGENTS.md)) are tool-agnostic, so Antigravity/Gemini/Lovable honor the same rules by reading those files even without identical hook machinery — and the product runtime automation (above) is tool-independent entirely. See [`GEMINI.md`](../../GEMINI.md) for the multi-tool precedence model.

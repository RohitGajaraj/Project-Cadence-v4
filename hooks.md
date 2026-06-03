# hooks.md — Claude Code hooks (automation & enforcement)

> How this repo uses Claude Code hooks to *enforce* policy automatically. Operating rules: [`AGENTS.md`](./AGENTS.md). Commit policy: [`commits.md`](./commits.md). Tool conventions: [`tools.md`](./tools.md).
>
> **Why this file exists:** the founder asked whether commit discipline should move under "hooks." The decision: **policy decides intent (what/when to commit) — hooks enforce invariants (mechanically block violations).** Keep [`commits.md`](./commits.md) as the policy; use a hook to enforce it. Both, not either.

## What hooks are
Claude Code hooks run a command (or `http` / `mcp_tool` / `prompt` / `agent` handler) automatically on lifecycle events, configured in `.claude/settings.json` (project, committed/shared) or `~/.claude/settings.json` (user). Events fire in three cadences:
- **Per-session:** `SessionStart`, `SessionEnd`.
- **Per-turn:** `UserPromptSubmit`, `Stop`, `SubagentStop`.
- **Per-tool-call:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`.
Plus `Notification`, `PreCompact`, `TaskCreated`/`TaskCompleted`, `WorktreeCreate`, etc.

Control flow: a `PreToolUse` hook runs *before* the tool and can **block** it (exit code 2); `PostToolUse` runs after and cannot undo. Matchers narrow by tool name (`Bash`, `Edit|Write`, `mcp__.*`) and an `if` permission rule can narrow further (e.g. `Bash(git *)`). Stdout JSON is parsed on exit 0. Official docs: https://code.claude.com/docs/en/hooks.

## How Cadence uses hooks

**1. Enforce commit discipline (not initiate it).** Auto-committing on `Stop` produces noisy, meaningless commits — hooks fire on machine events, not on the judgment that a logical unit of work is done. So we do **not** auto-commit. Instead, a `PreToolUse` hook on `Bash(git commit *)` enforces [`commits.md`](./commits.md): block `--no-verify`/`--no-gpg-sign`, require use of a commit skill (gstack-ship, commit-commands:commit, or similar — check available skills), refuse force-push to `main`. Policy decides *whether/what* to commit; the hook guarantees the invariants hold.

**2. Enforce engineering invariants.** Optional `PostToolUse` on `Edit|Write` to run a formatter/linter; a `PreToolUse` guard that blocks edits to `supabase/migrations/*` already applied (never edit migrations in place — see [`architecture/data.md`](./architecture/data.md)).

**3. Session context.** `SessionStart` can surface `.remember/` ([`memory.md`](./memory.md)) and the active task list so a new session boots with context.

## Configuration home
Hook definitions live in `.claude/settings.json` (shared, committed). Keep them thin and deterministic — enforcement and guardrails, not behavior the model should reason about. Behavior lives in [`AGENTS.md`](./AGENTS.md); hooks make a few invariants non-bypassable.

## Two different things both called "hooks" (disambiguation)
This matters — they are not the same:
1. **Dev-time hooks (this file):** Claude Code lifecycle hooks in `.claude/settings.json`. Event-triggered (a tool call, a turn ending, a session starting) — *not* a cron scheduler. They enforce invariants and automate developer-workflow steps while building Cadence.
2. **Product runtime automation (different layer):** Cadence's *own* scheduled/event automation that runs the product — `pg_cron` → `/api/public/hooks/*` endpoints, plus the orchestration automation engine (triggers → missions). That lives in [`architecture/orchestration.md`](./architecture/orchestration.md) and [`architecture/runtime.md`](./architecture/runtime.md), not here. If you mean "run an agent on a schedule for a user," that is the product layer, not Claude Code hooks.

## Hooks this repo configures (actionable spec)
Set these in `.claude/settings.json` (committed). Keep them deterministic — enforcement + workflow automation, not model reasoning.

| Event | Matcher / when | Action | Purpose |
|---|---|---|---|
| `PreToolUse` | `Bash(git commit *)` / `Bash(git push *)` | Block `--no-verify`/`--no-gpg-sign`; require use of a commit skill (gstack-ship, commit-commands:commit, or similar — check available skills); refuse force-push to `main` | Enforce [`commits.md`](./commits.md) mechanically |
| `PreToolUse` | `Edit\|Write` on `supabase/migrations/*` already applied | Block | Never edit applied migrations in place ([`architecture/data.md`](./architecture/data.md)) |
| `PostToolUse` | `Edit\|Write` on source files | Run formatter/linter; report | Keep the tree clean automatically |
| `Stop` / `SubagentStop` | end of a work turn | Remind/verify the **closed documentation loop**: were the relevant docs + the active build log ([`plan.md`](./plan.md) section 4) updated? | Make [`AGENTS.md`](./AGENTS.md) section 5 non-optional |
| `SessionStart` | new session | Surface Project Memory (`.remember/`) + the active task list | Boot with context ([`memory.md`](./memory.md)) |

### Sample `.claude/settings.json` (illustrative shape)
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "if": "Bash(git commit *)",
        "command": "scripts/enforce-commit-policy.sh" }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "command": "scripts/format-and-lint.sh" }
    ],
    "Stop": [
      { "command": "scripts/remind-doc-loop.sh" }
    ],
    "SessionStart": [
      { "command": "scripts/load-project-memory.sh" }
    ]
  }
}
```
Exact handler shape follows the official schema (https://code.claude.com/docs/en/hooks); the scripts are thin and live in the repo. Where a hook only needs to *remind* (not block), it prints guidance on exit 0; where it must *enforce*, a `PreToolUse` hook blocks on exit 2.

## Cross-tool note
Dev-time hooks are a Claude Code mechanism. The *policies* they enforce ([`commits.md`](./commits.md), [`AGENTS.md`](./AGENTS.md)) are tool-agnostic, so Antigravity/Gemini/Lovable honor the same rules by reading those files even without identical hook machinery — and the product runtime automation (above) is tool-independent entirely. See [`GEMINI.md`](./GEMINI.md) for the multi-tool precedence model.

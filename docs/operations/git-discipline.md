# Git Discipline — Cross-Tool Enforcement Standard

> **Canonical, tool-agnostic mandate for all git interactions across Claude Code, Lovable, Antigravity, and Gemini CLI.**
>
> Reference: [`AGENTS.md`](../AGENTS.md) §3, [`commits.md`](../commits.md), [`hooks.md`](../hooks.md).

---

## Core Principle

**Every git interaction must carry a clear, one-line explanation of the WHY — not just the WHAT.** The diff shows the WHAT; the commit/push message explains the WHY and the context.

This rule applies equally to:

- **Commits** (`git commit`, `gstack commit`)
- **Pushes** (`git push`, `gstack push`)
- **Pulls** (`git pull`)
- **Branch operations** (`git checkout`, `git branch`, `git merge`)
- **Resets or rewrites** (never without explicit approval)

---

## The Rule: Every Git Action Needs a One-Line WHY

### Format: `<action> — <why this change matters>`

**Examples:**

| Action            | ✗ Bad                              | ✓ Good                                                                                                                           |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Commit**        | `git commit -m "update design.md"` | `git commit -m "docs(design): add Pantone color guidance for AI selection; allows agents to pick distinct palette autonomously"` |
| **Push**          | `git push`                         | `git push — landing foundation-hardening work from active-task; FND-KILLSWITCH design pass complete"`                            |
| **Pull**          | `git pull`                         | `git pull — sync latest from main before resuming F1.2 Signal card work; check for conflicts in design.md`                       |
| **Merge**         | `git merge origin/main`            | `git merge origin/main — pulling latest auth fixes for security audit; recompute active-task.md after merge"`                    |
| **Branch create** | `git checkout -b feature`          | `git checkout -b feature/fnd-color-audit — preparing isolated work for Pantone palette assessment; will rebase to main"`         |

---

## What Belongs in the WHY

1. **Context** — which feature, epic, or ticket this serves (e.g., "FND-KILLSWITCH 0.6", "F1.2 Signal card")
2. **Goal** — what the change accomplishes (e.g., "add Pantone guidance for AI color selection", "fix multi-tenancy routing in chokepoint")
3. **Risk or consideration** — if relevant (e.g., "breaking change to /api/sync endpoint", "requires design.md review before ship", "blocks Lovable until merged")

---

## Implementation Rules (by Tool)

### Claude Code (CLAUDE.md)

- **Commits:** Use `gstack` (required). Commit message must include WHY as second sentence.

  ```
  gstack commit -m "feat(design): add Pantone color guidance

  Allow AI agents to autonomously select distinct color palettes from Pantone
  reference. Enables design autonomy while maintaining brand coherence."
  ```

- **Pushes:** Include a one-line message explaining what is being pushed and why.
  ```
  git push — landing foundation work: FND-KILLSWITCH design audit complete
  ```
- **Pulls:** Surface the intent before pulling.
  ```
  git pull — syncing latest auth fixes; checking for design.md conflicts
  ```

### Lovable (.lovable-config.txt)

- **Commits:** Every 5–15 min, push immediately. Message must state task ID + what changed + why.
  ```
  feat(components): add SignalCard component — F1.2 Signal discovery surface
  ```
- **Pushes:** Include task ID + completion status.
  ```
  git push — F1.2 SignalCard complete; wired to /api/signals, styled with design.md tokens
  ```

### Antigravity & Gemini (GEMINI.md)

- **Commits & pushes** follow the same discipline as Claude Code (use `gstack` or tool equivalent).
- **Every interaction must include**: task ID + what changed + why it matters.

---

## Hook Enforcement (`.claude/hooks/`)

The following hooks automatically enforce this discipline:

1. **PreToolUse::git-commit** — rejects commits without a message explaining the WHY
   - Checks that message length > 30 chars (ensures thought, not just one word)
   - Rejects `--no-verify` unless explicitly whitelisted
   - Rejects `--no-gpg-sign` unless explicitly whitelisted

2. **PreToolUse::git-push** — requires a comment or one-liner explaining the push
   - On `git push` to `main`, prompts for a one-line reason
   - Logs the reason to `.claude/push-log.txt` for audit

3. **PreToolUse::git-reset** — blocks destructive resets to `main`
   - Refuses `git reset --hard` to `main` without explicit, dated approval
   - Allows resets on local branches

4. **PreToolUse::git-force-push** — blocks force-push to `main`
   - Allows force-push to feature branches with approval
   - Blocks force-push to `main` unconditionally

---

## Specific Scenarios

### Scenario 1: Committing a Code Change

**Rule:** Every commit must explain why the change is needed, not just what changed.

```bash
# ✗ Bad
git commit -m "fix auth bug"

# ✓ Good
git commit -m "fix(auth): prevent session token duplication on concurrent requests

Root cause: stream chokepoint was not deduping in-flight requests. Added
unique requestId tracking to prevent double-auth. Fixes flaky tests in
multi-request auth scenarios. Depends on: foundation tenancy retrofit."
```

**Why it matters:** Next engineer (or agent) can understand the context of the fix without reading the diff.

---

### Scenario 2: Pushing Documentation Updates

**Rule:** Document changes need a one-liner explaining their scope + impact.

```bash
# ✗ Bad
git push

# ✓ Good
git push — docs(design): add Pantone color guidance; enables AI agents to
autonomously select distinct palettes. Updates design.md §Tokens.
```

---

### Scenario 3: Pulling Latest Work

**Rule:** Before pulling, state what you're syncing and why.

```bash
# ✗ Bad
git pull

# ✓ Good
git pull — syncing latest from main; checking for conflicts in
foundation-audit.md before resuming FND-KILLSWITCH work
```

---

### Scenario 4: Merging a Branch

**Rule:** Always explain why the merge is happening + any breaking changes.

```bash
# ✗ Bad
git merge origin/main

# ✓ Good
git merge origin/main — pulling auth middleware fixes; required before
F1.2 Signal card can ship. Tests all passing locally."
```

---

## Cross-Tool Consistency

### Rule for all tools (Claude Code, Lovable, Antigravity, Gemini):

1. **Read [`AGENTS.md`](../AGENTS.md) section 5** — the closed documentation loop.
2. **Apply git discipline to every interaction**, whether you're committing, pushing, or pulling.
3. **Include task context** (ticket ID, epic, feature name) in every message.
4. **When you hand off** (pause or finish work), update `active-task.md` and `docs/feature-backlog.md` with the same rigor — future tools depend on clarity.

---

## Audit & Review

**`.claude/push-log.txt`** (auto-populated by hooks):

```
2026-06-02 14:22 | claude-code | main | docs(design): add Pantone guidance
2026-06-02 14:45 | lovable | main | feat(components): Signal card component
2026-06-02 15:10 | claude-code | main | feat(auth): session dedup; required for tenancy
```

**Audit:** Any line in the log with a one-liner < 20 chars is flagged as potentially unclear.

---

## What This Enables

1. **Asynchronous handoffs.** Future tools can read your commit message and understand why the change was made without asking.
2. **Audit trail.** Product leadership can review what was shipped and why by reading commit messages.
3. **Incident debugging.** When something breaks, commit history tells you not just _what_ changed but _why_ it seemed like the right change at the time.
4. **Multi-tool coherence.** All four tools (Claude Code, Lovable, Antigravity, Gemini) speak the same language.

---

## Related Documents

- [`commits.md`](../commits.md) — detailed commit discipline policy
- [`hooks.md`](../hooks.md) — hook enforcement rules
- [`AGENTS.md`](../AGENTS.md) §5 — the closed documentation loop (git changes must update docs)
- [`.claude/hooks/`](../.claude/hooks/) — hook implementations (read-only reference)

---

## Quick Reference

| Action            | Required              | Format                                                                                |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------- |
| **Commit**        | ✓ Yes                 | `<type>(<scope>): <what>` + newline + `<why this matters>` + newline + `Ticket: <ID>` |
| **Push**          | ✓ Yes                 | `git push — <ticket> · <task summary>`                                                |
| **Pull**          | ✓ Yes                 | `git pull — <reason for sync> · <what to check after>`                                |
| **Merge**         | ✓ Yes                 | `git merge <branch> — <why needed>` + note any breaking changes                       |
| **Branch create** | ✓ Yes                 | `git checkout -b <branch> — <purpose>`                                                |
| **Rebase**        | ✓ Yes (with approval) | Ask first, include reason, document in active-task.md                                 |
| **Force-push**    | ✗ No (to main)        | Refuse. Allow to feature branches with dated approval only.                           |
| **Reset --hard**  | ✗ No (to main)        | Refuse. Allow to local branches with confirmation.                                    |

---

**Last updated:** 2026-06-02  
**Applies to:** Claude Code, Lovable, Antigravity, Gemini CLI  
**Enforcement:** `.claude/hooks/` + hooks.md rules

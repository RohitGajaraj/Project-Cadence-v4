# Permissions policy (how the agent gets hands-off access, safely)

> _Created: 2026-06-18 · Last updated: 2026-06-18_

> The standing rule for how an agent (Claude Code or any tool) runs without a permission prompt on every read, edit, and command, while a hard deny list still blocks destructive actions. This applies to **both** modes: the overnight autonomous loop **and** a regular daytime build. Set it once per machine and it carries forward.

## The two-layer model

Permissions live in two files, by design:

| File | Scope | Holds | Committed? |
| --- | --- | --- | --- |
| `.claude/settings.json` | **Shared** (travels with the repo, every session + tool + machine) | the **allow list** (pre-approved safe commands) + the **deny list** (destructive commands blocked for everyone) | **Yes** (checked in) |
| `.claude/settings.local.json` | **Local** (this machine only) | **`"defaultMode": "bypassPermissions"`** + the same allow/deny as a belt-and-suspenders + `additionalDirectories` | **No** (gitignored) |

**Why the split.** The allow/deny lists are safe to share, so they live in the committed `settings.json` and protect every clone (the deny list holds even under bypass). **`bypassPermissions` is a per-machine, opt-in choice** — it must NEVER be committed, or anyone who clones the repo would silently get a hands-off agent. So bypass lives only in the local, gitignored `settings.local.json`.

With `defaultMode: bypassPermissions` set locally, the agent runs every tool call (read, edit, write, bash, MCP) **without a prompt**, except anything matched by the deny list, which is refused even under bypass. That is "allow everything that is safe; hard-stop what is dangerous."

## The deny list (refused even under bypass) — the safety floor

```
Bash(git push --force*)   Bash(git push -f *)   Bash(git push origin +*)
Bash(git reset --hard *)  Bash(git clean -f*)   Bash(git branch -D *)
Bash(rm -rf *)            Bash(rm -fr *)
```

These are the irreversible / history-destroying / parallel-session-wiping commands. They stay denied no matter the mode. Extend this list (never shrink it) as new footguns surface.

## The allow list (pre-approved, no prompt)

Read/Edit/Write/Glob/Grep on all paths; WebSearch + WebFetch; and the safe shell verbs: `git *`, `bun *`, `bunx *`, `npx *`, `node *`, the read-only/text tools (`grep`, `rg`, `cat`, `sed`, `awk`, `head`, `tail`, `wc`, `find`, `sort`, `uniq`, `diff`, `cut`), and the benign file/dir ops (`mkdir`, `mv`, `cp`, `touch`, `cd`, `pwd`, `echo`, `printf`, `date`, `test`, `timeout`). The exact list is in `.claude/settings.json` → `permissions.allow`. Under `bypassPermissions` the allow list is redundant (everything not denied is allowed), but it keeps the repo usable hands-free even for a session that is NOT in bypass mode.

## Learnings (the gotchas that caused real prompt-storms)

1. **Settings are per the directory the session is LAUNCHED from, not the repo.** A session started in the repo root reads the root's `.claude/settings.local.json`. The overnight loop runs in a **git worktree** (`.claude/worktrees/overnight-build`), so a session launched there reads the *worktree's* settings. **If the loop is driven from a session launched at the repo root, it reads the ROOT settings, not the worktree's.** Real failure (2026-06-18): the bypass config existed only in the worktree's `settings.local.json`, so a root-launched session still prompted on every call. **Fix: the bypass + allow/deny must be in the `settings.local.json` of whatever directory the session is actually launched from** — for safety, set it in BOTH the repo root and the worktree, and list both paths in `additionalDirectories`.
2. **Settings are read at session START.** Editing `settings.local.json` mid-session does **not** retroactively stop prompts in that session; it takes effect on the **next** session. Set it before the run (or restart the session after changing it).
3. **`additionalDirectories` must include every path the session touches** — the repo root AND the worktree path — or operations in the "other" directory prompt.
4. **`settings.local.json` is gitignored on purpose.** Do not try to commit it. The committed, shareable layer is `settings.json` (allow/deny) plus this doc.

## Set it up (any machine, any build mode)

1. In the **repo root** `.claude/settings.local.json` (create if absent), set:
   ```json
   {
     "permissions": {
       "defaultMode": "bypassPermissions",
       "allow": [ "Read(**)", "Edit(**)", "Write(**)", "Glob(**)", "Grep(**)", "Bash(git *)", "Bash(bun *)", "Bash(bunx *)", "..." ],
       "deny": [ "Bash(git push --force*)", "Bash(git reset --hard *)", "Bash(rm -rf *)", "..." ],
       "additionalDirectories": [
         "<repo root absolute path>",
         "<repo root>/.claude/worktrees/overnight-build"
       ]
     },
     "enabledMcpjsonServers": ["supabase", "playwright"]
   }
   ```
   (Copy the full allow/deny from `.claude/settings.json` → `permissions`; add `defaultMode` + `additionalDirectories` here, locally.)
2. If running the overnight loop in the worktree, mirror the same into the worktree's `.claude/settings.local.json` (already done for this repo).
3. The committed `.claude/settings.json` already carries the allow/deny for everyone; nothing to do there unless you are tightening the deny list (then update it + this doc in the same commit).

## Cross-references

- [`autonomous-build-loop.md`](./autonomous-build-loop.md) §11 (how to run the loop hands-off) points here for the permission detail.
- [`hooks.md`](./hooks.md) — the hooks that enforce commit/migration invariants (a separate guard rail from permissions).
- [`git-discipline.md`](./commits.md) — why the deny list blocks force-push / hard-reset (parallel sessions share a working tree).

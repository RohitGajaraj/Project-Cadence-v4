# `.claude/skills/` — project-committed skills

These skills travel with the repo, so **any Claude Code instance** (you on another
machine, a teammate, CI) gets them automatically. They are **Claude-Code-only** —
Antigravity, Gemini, and Lovable do not have a Skill runtime. See `AGENTS.md` §10.

## What belongs here

✅ Skills that encode **this repo's conventions** — patterns a generic skill can't know
(e.g. the two-files-in-lockstep feature pattern, migration safety, the discovery-feed flow).

## What does NOT belong here

- ❌ Your **personal user-level library** (`~/.claude/skills/`, e.g. the gstack suite).
  Leave it at user level — it is how *you* work, it updates globally, and bulk-copying
  it bloats the repo and drifts from upstream. It already works in your Claude Code.
- ❌ **Marketplace plugins** (`ecc:*`, `ruflo-*`, `superpowers:*`, `context7`, …).
  Declare them in `.claude/settings.json` → `enabledPlugins`, never vendor their source.
- ❌ **MCP servers.** Those live in `.mcp.json` (portable to Antigravity too).

## Format

One folder per skill, each with a `SKILL.md` carrying YAML frontmatter (`name`,
`description`). See `cadence-feature-pair/SKILL.md` for the template.

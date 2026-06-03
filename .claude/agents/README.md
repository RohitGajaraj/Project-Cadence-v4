# `.claude/agents/` — project-committed subagents

Project-scoped Claude Code subagents (Markdown files with `name` / `description` /
`tools` frontmatter). Like skills, these are **Claude-Code-only** and travel with the
repo. Antigravity / Gemini / Lovable have no subagent runtime — see `AGENTS.md` §10.

Add a subagent here only when this repo needs a **specialized agent its conventions
imply** (e.g. a migration-reviewer that knows the tenancy/RLS rules, or a
discovery-feed evaluator). For generic roles, prefer the plugin subagents declared via
`.claude/settings.json` → `enabledPlugins` rather than vendoring copies here.

No project subagents are defined yet — this directory documents the policy so the
location is obvious when the first one is needed.

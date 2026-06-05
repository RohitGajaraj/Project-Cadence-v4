# GEMINI.md — Google Antigravity & Gemini CLI entry point

> **Antigravity and the Gemini CLI read this file with the highest precedence. The actual operating rules live in [`AGENTS.md`](./AGENTS.md) — treat it as canonical.** This file holds only Gemini/Antigravity-specific configuration and precedence notes so rules are never duplicated.

## Precedence (how this repo loads context)
Antigravity and Gemini CLI apply rules in this order; later files defer to earlier ones:
1. **System rules** (immutable, set by the tool).
2. **`GEMINI.md`** (this file) — Gemini/Antigravity overrides only.
3. **`AGENTS.md`** — the canonical, tool-agnostic operating manual. **Read this for all real rules.**
4. **`.agent/rules/`** (Antigravity) — additional modular workspace rules, if present.

Keep this file thin. Keep any global `~/.gemini/GEMINI.md` thin too — a fat global file conflicts with project rules.

## Read order
-1. **`git pull origin main`** — before anything else, sync all work from Claude Code, Lovable, Antigravity, and Gemini. The repository is the live source of truth; this file is orientation only.
0. **`active-task.md`** (if present in root) — the current in-progress task list and handoff status. Read this first!
1. [`AGENTS.md`](./AGENTS.md) — pre-action protocol, engineering rules, skill-first protocol, escalation, founding principles.
1.5. [`docs/strategy/v2-positioning-2026-06-02.md`](./docs/strategy/v2-positioning-2026-06-02.md) — strategic source of truth: positioning, three personas, USP, portability stance, feature rationale. Read before any feature, UX, or positioning work.
2. [`README.md`](./README.md) — product thesis, positioning, MOAT.
3. [`plan.md`](./plan.md) — build log + milestone roadmap.
4. Then: [`design.md`](./design.md), [`architecture/`](./architecture/), [`skills.md`](./skills.md), [`subagents.md`](./subagents.md), [`tools.md`](./tools.md).
5. **Demo accounts** (for demos / screen recordings / any flow that needs a working login): [`docs/demo-credentials.md`](./docs/demo-credentials.md) — two pre-provisioned logins + shared password + seeded workspace contents.

## Gemini CLI configuration
- To make Gemini CLI read the canonical file, set `context.fileName` in `.gemini/settings.json` to include `AGENTS.md`, e.g. `["GEMINI.md", "AGENTS.md"]`. The CLI loads these hierarchically (global, project root, subdirectories) and concatenates them.
- **Custom commands:** TOML files in `.gemini/commands/` (project) or `~/.gemini/commands/` (global). Subfolders create namespaces (`git/commit.toml` becomes `/git:commit`).
- **Extensions:** bundle commands plus MCP servers in an extension directory.

## MANDATORY: Scan skills, agents, plugins, and MCPs before every task (all tools, non-negotiable)

**This applies to Antigravity, Gemini CLI, and every tool reading this file. Before every task — code, docs, design, analysis — you MUST:**

1. Scan the full available library of skills, agents, plugins, and MCP servers (session context is the source of truth)
2. Include ALL types equally — skills, agents, plugins, MCPs — shortlist across ALL namespaces with no vendor bias
3. Invoke the best fit before acting from scratch — do not wait for the user to ask

This is a standing order, not a suggestion. Full protocol: [`AGENTS.md`](./AGENTS.md) §2 and the ⚡ standing order at the top of AGENTS.md.

## Antigravity configuration
- Antigravity reads `GEMINI.md` (this file, highest user priority) and `AGENTS.md` (the foundation). Additional modular rules go in `.agent/rules/`. On-demand knowledge packages live in the Antigravity skills directory.
- Do not duplicate `AGENTS.md` content into `.agent/rules/` — reference it.
- **Before any task: scan available skills/agents/plugins. Shortlist candidates across ALL namespaces equally. Pick the best fit.** Full protocol: [`AGENTS.md`](./AGENTS.md) section 2. No vendor bias.

## Git Discipline (Cross-Tool Standard)
**Every git interaction — commit, push, pull, merge — requires a one-line WHY explaining context + impact.** This applies equally to Claude Code, Lovable, Antigravity, and Gemini. Canonical reference: [`docs/git-discipline.md`](./docs/git-discipline.md).
- **Commits:** Include a second sentence explaining why the change matters + ticket context
- **Pushes:** One-liner with task ID + completion status (e.g., `git push — F1.2 Signal card complete; wired to /api/signals`)
- **Pulls:** State sync intent before pulling (e.g., `git pull — syncing latest auth fixes; checking design.md conflicts`)

## Behavioral guidelines (source: AGENTS.md §4)
Before writing code: **Think. State assumptions. Surface tradeoffs.**
While coding: **Surgical changes only — every line traces to the task.**
Goals: **Minimum code. Simplicity first. Nothing speculative.**
Success: **Define success criteria upfront. Verify before declaring done.**

Full detail: [`AGENTS.md`](./AGENTS.md), section 4. These apply equally to Claude Code, Antigravity, Gemini, and Lovable.

## The closed documentation loop (always on)
Every time you build a feature, make a decision, or learn something non-obvious, **update the relevant docs in the same unit of work** — and append to the active build log in [`plan.md`](./plan.md) (section 4). A change is not done until its documentation is true. Full mandate: [`AGENTS.md`](./AGENTS.md) §5.

**Skill-generated documents rule (applies to Antigravity and Gemini CLI too):** When any skill generates new files or folders, do NOT leave them in arbitrary new locations. Check existing docs first — merge into the correct folder. Example: if `/gstack-office-hours` creates `docs/office-hours/`, merge content into `docs/strategy/vN-positioning-YYYY-MM-DD.md` and delete the generated folder. See [`AGENTS.md`](./AGENTS.md) §5.

**Session decisions rule:** When a session produces a major strategic decision, add an entry to [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md) in the same session. Continuous obligation — not one-time.

## Multi-tool consistency rule
This repo is co-developed across Claude Code, Lovable, Antigravity, and Gemini. There is exactly one source of operating rules: [`AGENTS.md`](./AGENTS.md). `CLAUDE.md`, this file, and any tool-native config are thin pointers plus tool-specific overrides only. If you change a rule, change it in `AGENTS.md`.

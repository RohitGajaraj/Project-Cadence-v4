# GEMINI.md — Google Antigravity & Gemini CLI entry point

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> **Antigravity and the Gemini CLI read this file with the highest precedence. The actual operating rules live in [`AGENTS.md`](./AGENTS.md) — treat it as canonical.** This file holds only Gemini/Antigravity-specific configuration and precedence notes so rules are never duplicated.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

---

## Precedence (how this repo loads context)

Antigravity and Gemini CLI apply rules in this order; later files defer to earlier ones:

1. **System rules** (immutable, set by the tool).
2. **`GEMINI.md`** (this file) — Gemini/Antigravity overrides only.
3. **`AGENTS.md`** — the canonical, tool-agnostic operating manual. **Read this for all real rules.**
4. **`.agent/rules/`** (Antigravity) — additional modular workspace rules, if present.

Keep this file thin. Keep any global `~/.gemini/GEMINI.md` thin too — a fat global file conflicts with project rules.

## Read order

-1. **`git pull origin main`** — before anything else, sync all work from Claude Code, Lovable, Antigravity, and Gemini. The repository is the live source of truth; this file is orientation only. 0. **[`docs/planning/SOURCE-OF-TRUTH.md`](./docs/planning/SOURCE-OF-TRUTH.md)** — the single front door for where we are / what is next / what needs the founder. Read this first; **section 0 (the live cursor) is the current in-progress task list and handoff status** (it folded in and replaced the old root `active-task.md`).

0.5. [`Ai_Cofounder.md`](./Ai_Cofounder.md) — the **founding constitution**: co-founder operating posture, north star, agentic-first + model-agnostic (BYOK) mandates, documentation-first development. Its **Repo Concordance** section maps its 13 mandated living docs onto this repo's canon — never create those root files; update the mapped equivalents. For scope/agents/IA/sequencing, the v4 feature map (1.5) governs.

1. [`AGENTS.md`](./AGENTS.md) — pre-action protocol, engineering rules, skill-first protocol, escalation, founding principles.
   1.5. **Strategy canon is layered; [`docs/strategy/README.md`](./docs/strategy/README.md) is the single arbiter of which doc to pick for what.** Current layers: **v10** ([`docs/strategy/v10-master-blueprint.md`](./docs/strategy/v10-master-blueprint.md)) is the CURRENT build/structure canon (what to build next, how it should look/behave, priority, build lanes; execution order in [`docs/planning/v10_implementation-plan.md`](./docs/planning/v10_implementation-plan.md)) - pick this first for build work; **v7** ([`docs/strategy/v7-agentic-product-os.md`](./docs/strategy/v7-agentic-product-os.md)) wins positioning; **v8** ([`docs/strategy/v8-calm-front-deep-engine.md`](./docs/strategy/v8-calm-front-deep-engine.md)) wins structure/IA; **v9** ([`docs/strategy/v9-decision-wedge-and-build-next.md`](./docs/strategy/v9-decision-wedge-and-build-next.md)) wins the wedge / competitor / priority call. Engine / expansion map (7 laws · 6 stations · 19-agent mesh · handoff contract · HITL gates · M1-M5): [`docs/strategy/archive/v4-feature-map.md`](./docs/strategy/archive/v4-feature-map.md). Wedge UX detail: [`docs/strategy/archive/v5-chief-of-staff.md`](./docs/strategy/archive/v5-chief-of-staff.md). Personas: [`docs/strategy/archive/v3-positioning-cadence.md`](./docs/strategy/archive/v3-positioning-cadence.md). Index + archive: [`docs/strategy/README.md`](./docs/strategy/README.md).
   1.55. **Repository map & file-placement policy** — before creating ANY file, follow [`docs/README.md`](./docs/README.md) § "Repository map & file-placement policy": every new doc goes in the right subfolder and is linked from that folder's index in the same commit; nothing new at repo root or `docs/` top level; no duplicates or redirect stubs; screenshots local-only under `docs/screenshots/`.
   1.6. [`docs/conventions/`](./docs/conventions/): durable, cross-tool rules applied automatically on every task. **Top of the list: [`humanized-output.md`](./docs/conventions/humanized-output.md).** Zero AI fingerprints (no em/en dashes, no invisible Unicode, no AI-cliché phrasing) in BOTH what we author AND what the platform generates for users; the runtime sanitizer at the AI chokepoint is the hard gate. Plus UI chrome, voice ([`ui-voice.md`](./docs/conventions/ui-voice.md)), destructive actions, inline management, doc-closure.
   1.65. **Build-in-public brand system: moved to a separate PRIVATE repo** (`RohitGajaraj/build-in-public`), split out 2026-06-15 so the founder's personal brand, voice, drafts, and social tokens never live in this product repo (which may be shared). **Standing rule (one-way insight feed):** when a genuinely postable build insight surfaces here (high bar - only what would make a real social post, not a build log), append it to [`docs/brand-feed.md`](./docs/brand-feed.md) including a **capture cue** (the screenshot, video, link, or handle to tag that would strengthen the post). The engine reads that file, drafts in the founder's voice, and auto-stages Buffer drafts for his review - it never publishes, and never post to his accounts without his explicit approval. Do not recreate `docs/brand/` in this repo.
2. [`README.md`](./README.md) — product thesis, positioning, MOAT.
3. [`plan.md`](./plan.md) — build log + milestone roadmap. **Current build initiative (workspace / accounts / tenancy + monetization), the cross-tool build bible:** [`docs/planning/workspace-tenancy-and-monetization-plan.md`](./docs/planning/workspace-tenancy-and-monetization-plan.md) (live board group G10 in [`docs/planning/feature-dashboard.md`](./docs/planning/feature-dashboard.md)). **Moat / competition / positioning canon (lead with the decision layer):** [`docs/strategy/moat.md`](./docs/strategy/moat.md).
4. Then: [`design.md`](./design.md), [`architecture/`](./architecture/), [`docs/operations/skills.md`](./docs/operations/skills.md), [`docs/operations/subagents.md`](./docs/operations/subagents.md), [`docs/operations/tools.md`](./docs/operations/tools.md).
5. **Demo accounts** (for demos / screen recordings / any flow that needs a working login): [`docs/operations/demo-credentials.md`](./docs/operations/demo-credentials.md) — two pre-provisioned logins + shared password + seeded workspace contents.

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

**Every git interaction — commit, push, pull, merge — requires a one-line WHY explaining context + impact.** This applies equally to Claude Code, Lovable, Antigravity, and Gemini. Canonical reference: [`docs/operations/git-discipline.md`](./docs/operations/commits.md).

- **Commits:** Include a second sentence explaining why the change matters + ticket context
- **Pushes:** One-liner with task ID + completion status (e.g., `git push — F1.2 Signal card complete; wired to /api/signals`)
- **Pulls:** State sync intent before pulling (e.g., `git pull — syncing latest auth fixes; checking design.md conflicts`)

## Behavioral guidelines (source: AGENTS.md §4)

Before writing code: **Think. State assumptions. Surface tradeoffs.**
While coding: **Surgical changes only — every line traces to the task.**
Goals: **Minimum code. Simplicity first. Nothing speculative.**
Success: **Define success criteria upfront. Verify before declaring done.**

Full detail: [`AGENTS.md`](./AGENTS.md), section 4. These apply equally to Claude Code, Antigravity, and Gemini.

## The closed documentation loop (always on)

Every time you build a feature, make a decision, or learn something non-obvious, **update the relevant docs in the same unit of work** — and append to the active build log in [`plan.md`](./plan.md) (section 4). A change is not done until its documentation is true. Full mandate: [`AGENTS.md`](./AGENTS.md) §5.

**Skill-generated documents rule (applies to Antigravity and Gemini CLI too):** When any skill generates new files or folders, do NOT leave them in arbitrary new locations. Check existing docs first — merge into the correct folder. Example: if `/gstack-office-hours` creates `docs/office-hours/`, merge content into `docs/strategy/vN-positioning-YYYY-MM-DD.md` and delete the generated folder. See [`AGENTS.md`](./AGENTS.md) §5.

**Session decisions rule:** When a session produces a major strategic decision, add an entry to [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md) in the same session. Continuous obligation — not one-time.

## Multi-tool consistency rule

This repo is co-developed across Claude Code, Lovable, Antigravity, and Gemini. There is exactly one source of operating rules: [`AGENTS.md`](./AGENTS.md). `CLAUDE.md`, this file, and any tool-native config are thin pointers plus tool-specific overrides only. If you change a rule, change it in `AGENTS.md`.

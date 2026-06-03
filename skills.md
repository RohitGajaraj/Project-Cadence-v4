# skills.md — Working with skills

> How to discover, pick, and invoke skills. The active list appears in the session reminder — **always scan it before invoking from memory.** Skill names from training are stale. Operating rules: [`AGENTS.md`](./AGENTS.md). Subagents: [`subagents.md`](./subagents.md). Tools + hooks: [`tools.md`](./tools.md) · [`hooks.md`](./hooks.md).

## First principle: scan the whole library, prefer a skill over doing it yourself
There are 700+ skills/agents/plugins/hooks installed. **Before any non-trivial task, scan the installed library and the project folder and pick the best-fit skill — do not default to one namespace, and do not reason from scratch when a skill exists.** All namespaces (GStack, ecc, superpowers, ruflo, design, context7, pr-review-toolkit, user-installed, etc.) have equal priority. Pick the skill that best fits the task, regardless of namespace. **No bias. No tiebreaker. Best fit wins.**

## The layers (all in scope) — REFERENCE ONLY, NOT PRESCRIPTIVE

**IMPORTANT:** The skill layers below are examples and references. They are NOT exhaustive. They are NOT prescriptive. You MUST scan the full library and search for skills outside these categories. These are great tools worth knowing about, but always look beyond the examples to find the absolute best fit for your task.

| Layer | Examples | When to use (equal priority to others) |
|---|---|---|
| **Superpowers** (`superpowers:*`) | brainstorming, debugging, frontend-design, writing-clear-docs, TDD, systematic-debugging | Process discipline. Use *before* implementation — shapes how you work. |
| **Engineering / review** (`ecc:*`, `pr-review-toolkit:*`) | typescript-reviewer, python-reviewer, rust-reviewer, database-reviewer, security-reviewer, a11y-architect, performance-optimizer, build-fix | Language-specific or domain-specific review. Often better than generic. |
| **GStack** (`gstack:*`) | office-hours, ship, review, design-review, qa, land-and-deploy, cso, benchmark-models, plan-ceo/eng-review, context-save/restore | Ship/commit workflows, framing, reviews, QA, deploy. Equal priority to other namespaces. |
| **Design** (`design-taste-frontend`, `/emil-design-eng`, `/impeccable`, `/frontend-design-direction`, design-system, Figma skills) | UI/UX, motion, design systems, visual polish | Any visual/UX work. See [`design.md`](./design.md). |
| **Docs / context** (`context7-plugin`, doc skills, `ecc:update-docs`) | Library lookups, documentation, knowledge bases | Learning the current state of a library or framework. |
| **Data & ML** (`ruflo-migrations`, `ruflo-neural-trader`, `ecc:mle-workflow`) | Database migrations, ML pipelines, feature stores | Database design, ML ops, data architecture. |
| **Workflow & domain** (`to-prd`, `to-issues`, `prototype`, user-installed) | Project-local shortcuts, domain-specific tasks | Custom workflows, one-off tasks, specialized domains. |

## Selection priority (all namespaces equal — no bias)
1. **User instructions win.** If [`AGENTS.md`](./AGENTS.md), the current message, or [`CLAUDE.md`](./CLAUDE.md)/[`GEMINI.md`](./GEMINI.md) says "use X," use X.
2. **Scan the full installed set + project folders** and shortlist candidates across ALL namespaces equally.
3. **Best fit wins.** Pick the skill that best solves the task. No namespace gets priority.
4. **Process before implementation.** `superpowers:brainstorming`/`debugging` before building — shapes how you work.
5. **Specific over general.** `ecc:typescript-reviewer` for TypeScript beats a generic reviewer; `ecc:database-reviewer` for migrations; `ecc:security-reviewer` for security.
6. **Repo-local convention** beats cross-repo default — see [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md).
7. **When in doubt, ask.** A 10-second clarification beats a 10-minute wrong path.

## When to invoke
If there is even a 1% chance a skill applies, invoke it **before** any other response — including clarifying questions. Running it then discarding it is cheap. Never invoke a skill already running, one not in the active list, or `using-superpowers` if dispatched as a subagent.

## Anti-patterns
- Defaulting to GStack without scanning the rest of the library.
- Invoking five overlapping skills "for completeness." Pick the smallest set and justify it.
- Re-running `superpowers:debugging` after every failed attempt. Run once, follow its discipline.
- Skipping the scan because "this is simple." Simple things become complex. Check.
- Guessing skill names from training, or naming a skill in prose without invoking it.

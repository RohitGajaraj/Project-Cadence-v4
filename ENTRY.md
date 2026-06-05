# ENTRY.md — Where do I start?

> You just opened Cadence. This file routes you. Cadence is the **autonomous product OS** — a swarm of specialist agents runs the entire product lifecycle (discover → define → plan → build → test → ship → launch → support → learn) and a human governs the calls that matter. Agents do. Humans govern. Full thesis: [`README.md`](./README.md). Strategic positioning: [`docs/strategy/`](./docs/strategy/) — always read the latest version file there before any positioning, feature, or UX work.

---

## The doc system (one source of rules, thin tool pointers)

```text
                         ┌──────────────────┐
                         │     ENTRY.md     │  <- you are here (repo index)
                         └────────┬─────────┘
                                  │
     ┌────────────────────────────┼────────────────────────────┐
     │                            │                            │
 ┌───▼────────┐          ┌────────▼────────┐          ┌────────▼────────┐
 │ README.md  │          │   AGENTS.md     │          │   design.md     │
 │ product:   │          │  operating &    │          │  visual / AI    │
 │ what + why │          │  eng rules      │          │  UI contract    │
 └───┬────────┘          │ (CANONICAL)     │          └─────────────────┘
     │                   └───┬─────────┬───┘
     │                       │         │
     │            tool pointers      guidance docs
     │            CLAUDE.md          subagents.md
     │            GEMINI.md          skills.md / tools.md
     │            .lovable-config    memory.md / commits.md
 ┌───▼────────┐
 │  plan.md   │   architecture/ : runtime.md . data.md . frontend.md . integrations.md
 │ build log  │   docs/strategy/: v1, v2, ... (latest = current positioning truth)
 │ + roadmap  │   docs/         : decisions/ . references/ . feature-backlog . foundation-audit
 └────────────┘
```

**One rule of rules:** operating rules live once, in [`AGENTS.md`](./AGENTS.md). `CLAUDE.md` (Claude Code) and `GEMINI.md` (Antigravity + Gemini CLI) are thin pointers + tool-specific overrides only. Change a rule in `AGENTS.md`.

---

## Pick your entry point

| If you are… | Read first |
|---|---|
| Asking "what is Cadence?" | [`README.md`](./README.md) |
| About to build (any agent or human) | [`AGENTS.md`](./AGENTS.md). Claude Code: [`CLAUDE.md`](./CLAUDE.md). Antigravity/Gemini: [`GEMINI.md`](./GEMINI.md). |
| Designing UI / motion / tokens | [`design.md`](./design.md) |
| Modifying the AI runtime | [`architecture/runtime.md`](./architecture/runtime.md) |
| Building the autonomous orchestration layer | [`architecture/orchestration.md`](./architecture/orchestration.md) |
| Auth, tenancy, governance, secrets | [`architecture/security.md`](./architecture/security.md) |
| Touching data (migrations, RLS, pgvector) | [`architecture/data.md`](./architecture/data.md) |
| Adding a route / server fn / surface | [`architecture/frontend.md`](./architecture/frontend.md) |
| Adding a connector / BYO key / MCP / A2A | [`architecture/integrations.md`](./architecture/integrations.md) |
| Feature scope + build order + build log | [`plan.md`](./plan.md) |
| **Asking "what should I build next / where did we stop?"** | [`docs/feature-backlog.md`](./docs/feature-backlog.md) — **Live status board** (top) + Build-order rollup (bottom). Resolution rule: [`AGENTS.md`](./AGENTS.md) §1. |
| Picking a subagent / skill; tool + hook conventions | [`subagents.md`](./subagents.md) · [`skills.md`](./skills.md) · [`tools.md`](./tools.md) · [`hooks.md`](./hooks.md) |
| Cross-cutting gaps an enterprise build needs | [`docs/considerations.md`](./docs/considerations.md) |
| Deciding the stack or the name | [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md) · [`docs/decisions/naming.md`](./docs/decisions/naming.md) |
| Strategic positioning (current + history) | [`docs/strategy/`](./docs/strategy/) — read the latest version file before any feature, UX, or positioning work |
| Market research, competitive analysis, idea origins | [`docs/references/`](./docs/references/) — competitive-reference.md, idea-origination-inputs.md, research-references-aakash-gupta.md |
| Signing in for a demo / recording / customer walkthrough | [`docs/demo-credentials.md`](./docs/demo-credentials.md) — two pre-provisioned logins + shared password + seeded Demo workspace contents |

---

## The thirty-second pitch
Building software is no longer the bottleneck — product judgment under fragmented context is. Signals live in 6 places, reasoning in 4 more, planning in 3, execution in 5. The cost of switching, reconciling, and re-explaining now exceeds the cost of the work. Cadence collapses the lifecycle into one queryable substrate where agents cite their evidence, prove their reasoning, and act behind approval gates. **Agent-first, not a PM tool with AI bolted on.** Full thesis: [`README.md`](./README.md).

---

## First steps for a contributor

```bash
bun install      # canonical runtime
bun run dev       # dev server
# open http://localhost:5173
```
Environment is auto-provisioned by the cloud project (Supabase URL/key + AI gateway key injected). Migrations live in `supabase/migrations/` — author new ones via the migration tool; never edit existing migrations in place. Commits go through `gstack` ([`commits.md`](./commits.md)).

---

## The first golden rule
**Scan skills, agents, plugins, and MCPs first — then act.** Before any task: surface candidates across all four categories from the session context; pick the best fit across all namespaces with no vendor bias; invoke before acting from scratch. Also read the latest positioning file in [`docs/strategy/`](./docs/strategy/) before any feature, UX, or positioning decision. Full protocol: [`AGENTS.md`](./AGENTS.md) §1 and §2.

---

## Repo navigation

```text
Cadence/
├── ENTRY.md              <- repo index (here)
├── README.md             <- product: what + why
├── AGENTS.md             <- CANONICAL operating & engineering rules
├── CLAUDE.md             <- Claude Code pointer to AGENTS.md
├── GEMINI.md             <- Antigravity + Gemini CLI pointer to AGENTS.md
├── plan.md               <- feature scope + granular catalog + build order + logs
├── design.md             <- design system + AI UI contract
├── subagents.md          <- engineering-subagent guidance
├── skills.md             <- skill selection
├── tools.md              <- tool conventions
├── hooks.md              <- Claude Code hooks (automation + policy enforcement)
├── memory.md             <- memory layers
├── commits.md            <- commit discipline (enforced via hooks.md)
├── TASKS.md              <- live task tracker
├── architecture/
│   ├── runtime.md        <- AI chokepoint contract
│   ├── orchestration.md  <- missions, parallel agents/sessions, automation, multi-product
│   ├── security.md       <- auth, tenancy, governance, secrets
│   ├── data.md           <- Supabase + RLS + pgvector contract
│   ├── frontend.md       <- TanStack Start patterns
│   └── integrations.md   <- connectors, BYO, MCP/A2A
├── docs/
│   ├── considerations.md            <- holistic enterprise-architect gap review
│   ├── decisions/tech-stack.md      <- stack decision, HyperAgent ref, OSS posture
│   ├── decisions/naming.md          <- product-name shortlist + recommendation
│   ├── decisions/tenancy-retrofit.md <- tenancy architecture decision
│   ├── strategy/                    <- versioned positioning history (always read latest)
│   │   ├── README.md               <- index + cascade rule + when to create new version
│   │   ├── v1-positioning-2026-05-26.md  <- archived (superseded by v2)
│   │   └── v2-positioning-2026-06-02.md  <- CURRENT: autonomous OS, 3 personas, USP
│   ├── references/                  <- market research + competitive + idea inputs
│   │   ├── competitive-reference.md      <- competitor landscape
│   │   ├── idea-origination-inputs.md    <- original idea sources
│   │   └── research-references-aakash-gupta.md  <- PM research inputs
│   ├── feature-backlog.md           <- granular feature list + live status board
│   ├── foundation-audit.md          <- technical gap audit (step 1 tickets)
│   ├── git-discipline.md            <- cross-tool git WHY mandate
│   ├── demo-credentials.md          <- demo logins + seeded workspace + re-seed SQL
│   └── considerations.md            <- enterprise-architect cross-cutting gaps
├── .gemini/              <- (optional) settings.json, commands/  for Gemini/Antigravity
├── .claude/              <- (optional) Claude Code settings/hooks
├── .remember/            <- project-local session memory
├── src/                  <- app (routes, lib/ai chokepoint, components, integrations)
└── supabase/migrations/  <- schema source of truth
```

---

## When you ship a change
Update the right docs — matrix in [`AGENTS.md`](./AGENTS.md), section 5. Headline: **change capability scope without updating both `README.md` and `plan.md` and you have created drift.**

> **Last word.** One repo, one canonical rules file, one runtime chokepoint, one design system, one operating model. If a change does not fit that picture, the change is probably wrong. If the picture does not fit the change, evolve the picture — in the docs, openly, before the code lands.

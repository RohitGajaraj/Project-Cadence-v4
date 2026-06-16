# ENTRY.md — Where do I start?

> You just opened Cadence. This file routes you. Cadence is the **B2B Enterprise Product Cockpit** — an agent-native system of record and action where a swarm of specialist agents runs the entire product lifecycle (discover → definition → plan → build → test → ship → GTM launch → support → cohort analytics → learning loop) and a human governs the calls that matter. Agents execute. Humans govern. Full thesis: [`README.md`](./README.md). Strategic positioning: [`docs/strategy/`](./docs/strategy/) — always read the latest version file there before any positioning, feature, or UX work.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

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
     │            CLAUDE.md          docs/operations/subagents.md
     │            GEMINI.md          docs/operations/skills.md / tools.md
     │            .lovable-config    docs/operations/memory.md / commits.md
 ┌───▼────────┐
 │  plan.md   │   architecture/ : runtime.md . data.md . frontend.md . integrations.md
 │ build log  │   docs/strategy/: v1, v2, ... (latest = current positioning truth)
 │ + roadmap  │   docs/         : decisions/ . references/ . planning/ . operations/ . features/
 └────────────┘
```

**One rule of rules:** operating rules live once, in [`AGENTS.md`](./AGENTS.md). `CLAUDE.md` (Claude Code) and `GEMINI.md` (Antigravity + Gemini CLI) are thin pointers + tool-specific overrides only. Change a rule in `AGENTS.md`.

---

## Pick your entry point

| If you are…                                                | Read first                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asking "what is Cadence?"                                  | [`README.md`](./README.md)                                                                                                                                                                                                                          |
| The founding constitution (AI co-founder role + mandates)  | [`Ai_Cofounder.md`](./Ai_Cofounder.md) — posture, north star, mandates; its **Repo Concordance** maps its 13 mandated docs onto this doc system                                                                                                     |
| About to build (any agent or human)                        | [`AGENTS.md`](./AGENTS.md). Claude Code: [`CLAUDE.md`](./CLAUDE.md). Antigravity/Gemini: [`GEMINI.md`](./GEMINI.md).                                                                                                                                |
| Designing UI / motion / tokens                             | [`design.md`](./design.md)                                                                                                                                                                                                                          |
| Modifying the AI runtime                                   | [`architecture/runtime.md`](./architecture/runtime.md)                                                                                                                                                                                              |
| Building the autonomous orchestration layer                | [`architecture/orchestration.md`](./architecture/orchestration.md)                                                                                                                                                                                  |
| Auth, tenancy, governance, secrets                         | [`architecture/security.md`](./architecture/security.md)                                                                                                                                                                                            |
| Touching data (migrations, RLS, pgvector)                  | [`architecture/data.md`](./architecture/data.md)                                                                                                                                                                                                    |
| Adding a route / server fn / surface                       | [`architecture/frontend.md`](./architecture/frontend.md)                                                                                                                                                                                            |
| Adding a connector / BYO key / MCP / A2A                   | [`architecture/integrations.md`](./architecture/integrations.md)                                                                                                                                                                                    |
| Feature scope + build order + build log                    | [`plan.md`](./plan.md)                                                                                                                                                                                                                              |
| **Asking "what should I build next / where did we stop?"** | [`docs/planning/feature-backlog.md`](./docs/planning/feature-backlog.md) — **Live status board** (top) + Build-order rollup (bottom). Resolution rule: [`AGENTS.md`](./AGENTS.md) §1.                                                               |
| Picking a subagent / skill; tool + hook conventions        | [`docs/operations/subagents.md`](./docs/operations/subagents.md) · [`docs/operations/skills.md`](./docs/operations/skills.md) · [`docs/operations/tools.md`](./docs/operations/tools.md) · [`docs/operations/hooks.md`](./docs/operations/hooks.md) |
| Cross-cutting gaps an enterprise build needs               | [`docs/planning/considerations.md`](./docs/planning/considerations.md)                                                                                                                                                                              |
| Deciding the stack or the name                             | [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md) · [`docs/decisions/naming.md`](./docs/decisions/naming.md)                                                                                                                         |
| Strategic positioning (current + history)                  | [`docs/strategy/`](./docs/strategy/) — read the latest version file before any feature, UX, or positioning work                                                                                                                                     |
| Market research, competitive analysis, idea origins        | [`docs/references/`](./docs/references/) — competitive-reference.md, idea-origination-inputs.md, research-references-aakash-gupta.md                                                                                                                |
| Signing in for a demo / recording / customer walkthrough   | [`docs/operations/demo-credentials.md`](./docs/operations/demo-credentials.md) — two pre-provisioned logins + shared password + seeded Demo workspace contents                                                                                      |

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

Environment is auto-provisioned by the cloud project (Supabase URL/key + AI gateway key injected). Migrations live in `supabase/migrations/` — author new ones via the migration tool; never edit existing migrations in place. Commits go through `gstack` ([`docs/operations/commits.md`](./docs/operations/commits.md)).

---

## The first golden rule

**Scan skills, agents, plugins, and MCPs first — then act.** Before any task: surface candidates across all four categories from the session context; pick the best fit across all namespaces with no vendor bias; invoke before acting from scratch. Also read the latest positioning file in [`docs/strategy/`](./docs/strategy/) before any feature, UX, or positioning decision. Full protocol: [`AGENTS.md`](./AGENTS.md) §1 and §2.

---

## Repo navigation

```text
Cadence/
├── ENTRY.md              <- repo index (here)
├── Ai_Cofounder.md       <- founding constitution (co-founder posture + mandates; see its Repo Concordance)
├── README.md             <- product: what + why
├── AGENTS.md             <- CANONICAL operating & engineering rules
├── CLAUDE.md             <- Claude Code pointer to AGENTS.md
├── GEMINI.md             <- Antigravity + Gemini CLI pointer to AGENTS.md
├── plan.md               <- feature scope + granular catalog + build order + logs
├── design.md             <- design system + AI UI contract
├── active-task.md        <- active in-flight task tracker (if present)
├── architecture/
│   ├── runtime.md        <- AI chokepoint contract
│   ├── orchestration.md  <- missions, parallel agents/sessions, automation, multi-product
│   ├── security.md       <- auth, tenancy, governance, secrets
│   ├── data.md           <- Supabase + RLS + pgvector contract
│   ├── frontend.md       <- TanStack Start patterns
│   └── integrations.md   <- connectors, BYO, MCP/A2A
└── docs/
    ├── README.md         <- index of everything under docs/
    ├── conventions/      <- durable cross-tool rules
    │   ├── README.md
    │   ├── destructive-actions.md
    │   ├── doc-closure-checklist.md
    │   ├── inline-management.md
    │   ├── ui-chrome.md
    │   └── ui-voice.md
    ├── decisions/        <- ADRs (naming, tech-stack, tenancy, etc.)
    ├── features/         <- operator guides per feature
    │   ├── a2a-handoff.md
    │   ├── agent-ecosystem-plan.md
    │   ├── auth-flows.md
    │   ├── github-issue-approval-flow.md
    │   ├── trust-and-autonomy.md
    │   └── web-access.md
    ├── operations/       <- operational guides & models
    │   ├── commits.md
    │   ├── demo-credentials.md
    │   ├── fnd-runtime-restart-playbook.md
    │   ├── git-discipline.md
    │   ├── hooks.md
    │   ├── memory.md
    │   ├── skills.md
    │   ├── subagents.md
    │   └── tools.md
    ├── planning/         <- backlog & roadmap trackers
    │   ├── considerations.md
    │   ├── feature-backlog.md
    │   ├── foundation-audit.md
    │   ├── known-issues.md
    │   └── archive/  (superseded docs: strategic-tasks, v7 maps, v4-rebuild-handoff; see v10 blueprint)
    ├── references/       <- market research & competitive inputs
    └── strategy/         <- versioned strategic positioning
```

---

## When you ship a change

Update the right docs — matrix in [`AGENTS.md`](./AGENTS.md), section 5. Headline: **change capability scope without updating both `README.md` and `plan.md` and you have created drift.**

> **Last word.** One repo, one canonical rules file, one runtime chokepoint, one design system, one operating model. If a change does not fit that picture, the change is probably wrong. If the picture does not fit the change, evolve the picture — in the docs, openly, before the code lands.

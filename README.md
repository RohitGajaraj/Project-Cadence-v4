# Cadence

> **The autonomous product OS.** A swarm of specialist agents runs your entire product lifecycle — discover, define, plan, build, test, ship, launch, support, and learn — continuously, in parallel, under your governance. You set strategy. Agents run the org.
>
> One-line: **your product company, running itself.**

> **Working name.** "Cadence" is a placeholder pending a rename — shortlist and recommendation in [`docs/decisions/naming.md`](./docs/decisions/naming.md). All docs use "Cadence" until you pick; the swap is one find-replace.

---

## What this is, in one paragraph

Building software is no longer the bottleneck. The bottleneck is running the *whole* product lifecycle as one coherent, governed, autonomous loop — not a dozen disconnected tools held together by a human doing glue work. Cadence is that loop. A swarm of specialist agents takes an intent — "turn this customer pain into a shipped, launched feature" — and carries it end to end: discovers the signal, defines the spec, plans the work, writes and tests the code, ships the release, drafts the launch and pricing, handles support, and feeds what it learned back into the next decision cycle. Every action is cited, observable in a live trace, and reversible; the human governs at the gates that require judgment. **Agents do. Humans govern.** The platform is never "done" — it runs continuously, learning and compounding with every mission.

Operating rules for anyone (human or agent) building this: [`AGENTS.md`](./AGENTS.md). Full feature scope + build log: [`plan.md`](./plan.md). Design contract: [`design.md`](./design.md). Architecture: [`architecture/`](./architecture/). Strategic positioning rationale: [`docs/strategy/v2-positioning-2026-06-02.md`](./docs/strategy/v2-positioning-2026-06-02.md).

---

## The problem

A product operator today doesn't just do discovery and specs. They own the whole arc: talk to users, decide what's worth building, write the spec, get it built, tested, and shipped, launch it, position and price it, drive distribution, handle support, and learn from the result. That arc is smeared across 10-15 tools — Intercom, Gong, Notion, Linear, Jira, Figma, GitHub, CI, Vercel, Slack, Mixpanel, a CRM, a help desk, and a stack of AI chat tabs — with a human manually carrying context across every seam.

**The cost of switching, reconciling, re-explaining, and hand-holding the work across those seams now exceeds the cost of the work itself.** Point AI tools make one seam faster (a better spec, a faster PR) but leave the operator as the glue across the full lifecycle. To remove the glue, the *substrate* has to own the whole lifecycle — and agents have to *run* it, not just assist it.

**The deeper problem:** even AI tools that claim "automation" still put the human in the middle of every step. That is not automation — that is a faster typewriter. The autonomous shift means agents carry the mission from start to finish; the human appears only at governance gates.

**Cadence is that substrate.** One data model, one autonomous agent runtime, one orchestration layer, one governance/trust layer — spanning the entire lifecycle, running continuously.

---

## Positioning — autonomous, end-to-end, governed, continuous

Four statements that should never drift:

1. **Agents do. Humans govern.** Cadence agents don't suggest — they *execute*: multi-step missions across discovery, build, test, ship, and launch, in parallel, and report back. Humans set intent, approve governance gates, and make judgment calls. Everything else: agents own.
2. **End-to-end, not a point tool.** Cadence owns the whole loop. factory.ai/Devin/Replit own autonomous *engineering*; Linear owns the product *system of record*. None owns discover → build → ship → launch → support → learn as one governed autonomous loop. That whole-lifecycle ownership is the position.
3. **Governed autonomy.** Every autonomous action is cited, observable in a live trace, approval-gated where it touches the outside world, and reversible. Autonomy without governance is a liability; Cadence ships both.
4. **Continuous, not project-based.** Products never finish — they discover, iterate, and learn in a closed loop. Cadence is the OS that runs that loop indefinitely. It is not a build tool you close when the product ships; it is the operating layer that runs the product org.

### The USP
> **Cadence is the autonomous product OS where a swarm of specialist agents runs your entire product lifecycle — discover, build, ship, launch, support, learn — continuously and in parallel, governed by you at the calls that matter. Not a tool you use. An operating system that runs your product org.**

Not "stop switching tabs." That's a symptom. The product is an autonomous, governed product org you operate from one surface.

### The portability commitment
> **Your data is always yours.** Export everything — decisions, memory, signals, agent configs — in open formats, anytime. We earn your trust through value, not friction.

Cadence gets more valuable the longer it runs — not because it traps you, but because Product Memory compounds: the agents learn your users, your domain, your decisions, and your patterns. Switching away means starting from zero memory. The cost of leaving is the accumulated intelligence — not a contract or a locked export. See the full portability feature in [`docs/feature-backlog.md`](./docs/feature-backlog.md) (Epic U).

---

## The MOAT — why a frontier-model launch (or "Claude for PMs") does not kill us

The model is **not** the moat. Neither is raw data. Everyone — including us — uses the same frontier models (Cadence is model-agnostic by contract). When a lab ships a horizontal "PM agent" or a better coding agent, that is a *capability we plug in*, not a competitor. The defensibility is five things a model release cannot replicate:

1. **End-to-end lifecycle orchestration.** Owning *and reliably orchestrating* the entire loop — discover → define → plan → build → test → ship → launch → support → learn — as one governed system. A model gives you a capability; it does not give you the orchestrated, integrated, cross-stage system that turns an intent into a launched, supported, and learned-from feature.
2. **The trust & governance layer.** Approval gates, full audit trail, citations, evals, guardrails, budgets, and reversibility — the part enterprises require before they let agents touch real systems, and the part labs do not ship as a product.
3. **System of record *and* system of action.** Once a product org runs its decisions, code, releases, and institutional context through Cadence, Cadence becomes the operating layer. Ripping it out means re-gluing the lifecycle by hand.
4. **Compounding Product Memory.** The longer Cadence runs, the better the agents know your product, your users, your decisions, and your domain. This intelligence is genuinely hard to rebuild — and genuinely valuable. The switching cost is the accumulated knowledge, not a contract.
5. **Agent-native interop.** Cadence speaks MCP and A2A both ways — it is the place other agents (and the labs' own agents) plug in to act inside a governed product org.

Positioning rule: **"Cadence orchestrates the models; it does not compete with them."** Built for the agentic systems of tomorrow, not just today's humans.

---

## Who Cadence is for

Three equal primary personas. The wedge language differs; the product value is the same.

### P1 — Solo / Lead PM at AI-native B2B SaaS
*(10-200 person company, PM owns discovery through roadmap and increasingly build/metrics)*

**Pain:** Mechanical work — spec writing, ticket triage, stakeholder updates, status reports — crowds out real product judgment. Discovery is shallow because synthesis takes time the PM doesn't have. Context switching across 10 tools burns more time than the work itself.

**What they need Cadence for:** "Give me back the hours I spend on process so I can spend them on judgment."

**Cadence promise:** Your agents handle the process. You handle the judgment.

### P2 — Founder Operating as the Whole Product Org
*(Pre-seed to Series A, 1-10 people, founder IS the PM)*

**Pain:** Discovery + specs + roadmap + build coordination + GTM + pricing + support — all on one person, across a fragmented tool stack, with no team to hand off to. The glue work exceeds the judgment work.

**What they need Cadence for:** "Run the product org I can't afford to hire."

**Cadence promise:** One operator. A full autonomous product org.

### P3 — Technical Founder / Indie Hacker
*(Bootstrapped to seed, wants to stay in the build or step away from it)*

**Pain:** Everything that isn't coding falls on them. Discovery, GTM, support, pricing — non-technical work they don't have time for or strong expertise in. They want to build; the product lifecycle demands more.

**What they need Cadence for:** "Agents run the product lifecycle so I can stay focused on what I'm good at."

**Cadence promise:** Your product org, running itself.

### P4 — Expansion (validate as the core personas scale)
Engineering leads, sales, support, CEOs sharing one queryable lifecycle. Near-term expansion, validated as we go — not a reason to narrow the core.

**Not for:** teams wanting only a Jira replacement; orgs that forbid AI on internal data; operators who prefer doing every step by hand to governing agents.

---

## The operating model — you govern, agents execute

**Not a copilot. Not an assistant. An autonomous product org.**

| The human (governor) | The autonomous agents |
|---|---|
| Sets intent, strategy, priorities | Discover, synthesize, define, plan |
| Approves what touches the outside world | Write code, run tests, open PRs, deploy |
| Strategic and ethical judgment | Draft launch, pricing, positioning, distribution |
| Naming, framing, narrative | Handle support, follow-ups, scheduling |
| Override and accountability | Score, cite, watch drift, run the closed loop |

Every agent run is tagged `auto | confirm | review`. The Decision Queue surfaces runs awaiting governance with one-click resume from checkpoint. **The human governs only where judgment, taste, or accountability is non-delegable** — everything else, agents own.

### The trust journey (explicit, designed, rewarding)

Trust with autonomous agents is earned through observation, not promised upfront. Cadence makes this journey visible:

```
Week 1:   Define agents, set context once → watch closely, approve frequently
Month 1:  Agents demonstrating value → approval gates narrow → govern less
Month 3:  Trust established → agents run autonomously → outcomes + exceptions only
Month 6+: Cadence IS your product org. Set strategy quarterly. Agents run everything else.
```

The Agent Trust Score (visible per agent) tracks performance and unlocks autonomy progressively. You explicitly dial autonomy up as confidence is established — governance feels like policy, not micromanagement.

---

## The closed product loop (run by autonomous agents, continuously)

Cadence is one closed loop spanning the whole lifecycle. Agents move work through every stage; the human governs at the gates.

```text
        ┌──────────── intent / governance (human) ───────────┐
        v                                                     │
   (1) DISCOVER → (2) DEFINE → (3) PLAN → (4) BUILD → (5) TEST → (6) SHIP
        ^                                                               │
        │                                                               v
   (9) LEARN  ←──────  (8) OPERATE/SUPPORT  ←──────  (7) LAUNCH / GTM / PRICE
        └──────────── every stage cites evidence, writes to memory,
                       and re-scores the loop (autonomous, continuously) ─────────┘
```

- **Discover** — ingest signals (support, churn, usage, sales, reviews); cluster into themes → scored opportunities.
- **Define** — opportunity → PRD/spec, retrieval-grounded, cited.
- **Plan** — spec → dependency-aware task graph; roadmap; schedule.
- **Build** — agents scaffold and write code in Studio, across files, in parallel sessions; you watch it happen live.
- **Test** — agents generate and run tests, evals, and QA; gate on results.
- **Ship** — agents open PRs, deploy, and draft release notes, behind governance approval.
- **Launch / GTM / Price** — agents draft launch assets, positioning, pricing pages, and distribution plans.
- **Operate / Support** — agents triage tickets, answer, and route; support themes flow back into Discover.
- **Learn** — outcomes update decisions (`supersedes`), re-score opportunities, and feed the next loop.

**This loop never stops.** Cadence is not a project tool you close when the product ships. It is the operating layer that runs the product org — the platform gets more valuable as every cycle adds to Product Memory.

---

## Capability surface (the full intended product)

This is the scope Cadence is built to ship. Full feature list and build state: [`plan.md`](./plan.md). Strategic feature reasoning: [`docs/strategy/v2-positioning-2026-06-02.md`](./docs/strategy/v2-positioning-2026-06-02.md).

| Layer | What it does |
|---|---|
| **Discover** | Multi-source signal ingest; agent clustering → themes → ICE-scored opportunities; continuous synthesis. |
| **Define & Plan** | Cited PRD/spec generation; dependency-aware task graphs; roadmap; scheduling. |
| **Build & Ship** | In-product multi-file agent coding (Studio); autonomous test generation + runs; PR/deploy/release-notes behind governance; **a live "watch the agents build" surface** showing what each agent is doing right now. |
| **Launch & Grow** | Agent-drafted launch assets, positioning, pricing pages, distribution plans, customer-facing pages, support replies. |
| **Orchestration** | Workflow + automation engine: event/schedule triggers, multi-step agent workflows, **many sub-agents and many agent sessions running in parallel**, with a live orchestration view. |
| **Multi-product** | **Multiple products in flight (Product A/B/C) grouped under Workspaces (A/B/C)**, each with isolated data, agents, memory, and budgets. |
| **Agents** | A curated roster of autonomous specialists across the whole lifecycle; each with tools, model, governance mode, memory, and an earned Trust Score; planner/executor loop with replay-and-branch. |
| **Strategic Briefing** | Set product north star, goals, and constraints once; all agents read it as their operating context. The "brief the team" mechanism. |
| **Trust stack** | Per-call telemetry, LLM-as-judge scoring, guardrails, RAG with citations, prompt versioning + A/B, eval harness, drift watch, budgets, live trace viewer, Agent Trust Scores. |
| **Product Memory** | The queryable graph of signals → decisions → outcomes with lineage; the institutional context agents reason over; exportable in open formats. |
| **Data portability** | Export all signals, decisions, memory, agent configs in open formats anytime. Your data is always yours. |
| **Interop** | MCP + A2A both directions — Cadence as a tool surface other agents call, and a consumer of external agents. |

---

## Architecture at a glance

Read top to bottom: a request enters at the **client**, passes the **auth/tenancy** gate, is planned by the **orchestration layer**, every model call funnels through the **AI chokepoint**, and state lives in one **database**. Two hard invariants make the whole thing governable: **one chokepoint for every AI call**, and **one orchestration layer for every autonomous mission**.

```text
╔════════════════════════════════════════════════════════════════════════════════╗
║  1. CLIENT  (the light, calm, fast surface)                                    ║
║     Command Center · Code Studio · live "watch-the-agents" view · Trace viewer ║
║     Stack: TanStack Start (React 19 + Vite) · Tailwind v4 · shadcn/ui ·       ║
║            Framer Motion · Tiptap · Lucide                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝
        │                                                  │
   server functions (typed RPC)                  /api/public/hooks/*  (cron + event triggers)
        │                                                  │
╔═══════▼══════════════════════════════════════════════════▼═════════════════════╗
║  2. AUTH & TENANCY  (the isolation gate — every request passes here)           ║
║     Supabase Auth (email + Google OAuth)  ->  RLS scoped by                   ║
║     user_id + workspace_id + product_id.  Secrets via pgsodium.               ║
║     Contract: architecture/security.md                                         ║
╠════════════════════════════════════════════════════════════════════════════════╣
║  3. ORCHESTRATION LAYER  (runs autonomous missions)                            ║
║     workflow + automation engine · event/schedule triggers ·                   ║
║     MANY sub-agents in parallel · MANY sessions in parallel ·                  ║
║     per-product/workspace isolation · governance gates · checkpoints           ║
║     Contract: architecture/orchestration.md                                    ║
╠════════════════════════════════════════════════════════════════════════════════╣
║  4. AI CHOKEPOINT  (src/lib/ai/runtime.server.ts — EVERY model call)           ║
║     budget -> cache -> pre-guard -> retrieve(RAG) -> PROVIDER ->               ║
║     post-guard -> persist(trace) -> async eval -> fallback                     ║
║     Contract: architecture/runtime.md                                          ║
╚═══════╤══════════════════════════════════════════════════╤═════════════════════╝
        │                                                  │
╔═══════▼═══════════════════════════╗      ╔═══════════════▼════════════════════╗
║  5a. MODELS (model-agnostic)      ║      ║  5b. DATA (one store)              ║
║      Gateway (no key) + BYO keys: ║      ║      Supabase Postgres:            ║
║      Claude · Gemini · GPT ·      ║      ║      RLS · pgvector (RAG) · pg_cron║
║      DeepSeek · Grok · Ollama     ║      ║      Contract: architecture/data.md║
╚═══════════════════════════════════╝      ╚════════════════════════════════════╝
```

Where each layer lives in detail: [`architecture/`](./architecture/). Stack rationale and the open-source posture: [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md).

---

## Status

The current code covers discovery, specs, planning, a code studio, integrations, and the trust stack. **The intended product is larger** — the autonomous build/test/ship/launch loop, the orchestration layer, parallel agents/sessions, multi-product/workspace, Strategic Briefing, and Agent Trust Scores are the core of what we build next. The full feature list, active build log, and build sequence: [`plan.md`](./plan.md).

---

## Documentation map

| If you are… | Read |
|---|---|
| Evaluating Cadence | **README.md** (here) |
| Understanding strategic positioning | [`docs/strategy/v2-positioning-2026-06-02.md`](./docs/strategy/v2-positioning-2026-06-02.md) |
| Navigating the repo | [`ENTRY.md`](./ENTRY.md) |
| Building (human or agent) | [`AGENTS.md`](./AGENTS.md) (Claude Code: [`CLAUDE.md`](./CLAUDE.md); Antigravity/Gemini: [`GEMINI.md`](./GEMINI.md); Lovable: [`.lovable-config.txt`](./.lovable-config.txt)) |
| Feature scope + build log | [`plan.md`](./plan.md) |
| Design / UI / motion | [`design.md`](./design.md) |
| Architecture (runtime, orchestration, data, auth, frontend, integrations) | [`architecture/`](./architecture/) |
| Subagents / skills / tools / hooks | [`subagents.md`](./subagents.md) · [`skills.md`](./skills.md) · [`tools.md`](./tools.md) · [`hooks.md`](./hooks.md) |
| Memory / commits / git discipline | [`memory.md`](./memory.md) · [`commits.md`](./commits.md) · [`docs/git-discipline.md`](./docs/git-discipline.md) |
| Stack + name decisions | [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md) · [`docs/decisions/naming.md`](./docs/decisions/naming.md) |

Every doc cross-references the others. **Do not let them drift** — update protocol in [`AGENTS.md`](./AGENTS.md), section 5.

---

## License
To be set; permissive intent. Until chosen: all rights reserved, © Cadence contributors.

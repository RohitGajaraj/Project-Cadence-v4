# Cadence ⚡

> **Run your entire product lifecycle end to end on Cadence.** The product operating system for the whole arc, discover, decide, define, build, ship, launch, and learn, as one governed, continuously-learning loop. The **moat is the decision layer** (what to build, and whether the call was right, the part with no fast oracle) plus the compounding memory; the build is a governed station within the loop (Cadence's own engine, or dispatched to Lovable / Cursor / Devin under the same governance). Vibe-coding is one station; **Cadence is the whole loop, with the decision layer as its brain.** You set intent and own the calls that matter; agents run the arc.
>
> One-line: **the end-to-end product OS; the decision layer is the moat.**

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

---

## What this is, in one paragraph

Cadence runs your **entire product lifecycle end to end**, discover to decide to define to build to ship to launch to learn, as one coherent, governed, closed loop, not a dozen disconnected tools held together by a human doing manual glue work. And here is why it is defensible, not just another tool: building software is no longer the bottleneck; **deciding what to build is.** Code has a fast oracle (it compiles or it does not, in seconds), so building commoditizes; "what to build, and was it right" has no fast oracle (the feedback lands in weeks to quarters), so it does not. **That decision layer, plus the compounding memory, is the moat.** A swarm of specialist agents takes an intent ("turn this customer signal into the right shipped outcome") and carries it end to end: ingests feedback, transcribes syncs, ranks and red-teams the opportunity (the Critic), defines the cited spec, **builds it** (Cadence's own engine, or dispatched to Lovable / Cursor / Devin under the same governance), drafts GTM copy, triages support, evaluates the outcome, and feeds the result back into the next decision. Every action is cited, observable in a live trace, and reversible; the human sets intent and owns the calls that matter. **Agents execute; the human decides and is accountable.** The platform runs continuously, and the judgment compounds with every outcome. The moat: [`docs/strategy/moat.md`](./docs/strategy/moat.md).

Operating rules for anyone (human or agent) building this: [`AGENTS.md`](./AGENTS.md). **The felt product / wedge (v5): [`docs/strategy/v5-chief-of-staff-2026-06-11.md`](./docs/strategy/v5-chief-of-staff-2026-06-11.md). Cadence lands as the senior PM's Chief of Staff (the daily evidence-to-decision ritual); the cockpit below is the expansion.** Expansion scope, agent mesh, and milestones: [`docs/strategy/v4-feature-map-2026-06-11.md`](./docs/strategy/v4-feature-map-2026-06-11.md). Build order + build log: [`plan.md`](./plan.md). Design contract: [`design.md`](./design.md). Architecture: [`architecture/`](./architecture/). Market evidence: [`docs/references/competitive-landscape-2026-06-11.md`](./docs/references/competitive-landscape-2026-06-11.md). Founding constitution (AI co-founder role, north star, mandates): [`Ai_Cofounder.md`](./Ai_Cofounder.md).

> **Standing rule: humanized output, zero AI fingerprints.** No em/en dashes, no invisible Unicode, no AI-cliche phrasing in what we build OR what the platform generates for users. Applies to every co-dev tool and to every AI feature's output. Full rule: [`docs/conventions/humanized-output.md`](./docs/conventions/humanized-output.md).

---

## Try it: demo accounts

Two pre-provisioned demo logins ship with the database. Both land in a fully populated Demo workspace (Lumen project, themes, signals, opportunities, PRDs, missions, traces, evals, briefs) so every surface is real on first sign-in.

| #   | Email                  | Password           |
| --- | ---------------------- | ------------------ |
| 1   | `demo@redcadence.app`  | `Cadence!Demo2026` |
| 2   | `demo2@redcadence.app` | `Cadence!Demo2026` |

_Note: Database credentials retain the legacy email domains and passwords to prevent auth session disruption during co-development._ Full details: [`docs/operations/demo-credentials.md`](./docs/operations/demo-credentials.md).

---

## The problem

A product operator today doesn't just do discovery and specs. They own the whole arc: talk to users, decide what's worth building, write the spec, get it built, tested, and shipped, launch it, position and price it, drive distribution, handle support, and learn from the result. That arc is smeared across 15 tools (Intercom, Gong, Notion, Linear, Jira, Figma, GitHub, CI, Vercel, Slack, Mixpanel, and a stack of AI chat tabs) with a human manually carrying context across every seam.

**The cost of switching, reconciling, re-explaining, and hand-holding the work across those seams now exceeds the cost of the work itself.** Point AI tools make one seam faster (a better spec, a faster PR) but leave the operator as the glue. To remove the glue, the _substrate_ has to own the whole lifecycle, and agents must _run_ it, not just assist it.

**The deeper problem:** the scarce skill is no longer building; it is deciding what to build and knowing whether you were right. AI build tools make the cheap part cheaper and leave the operator as the glue and the sole keeper of undocumented, unaccountable judgment. Cadence removes the glue by running the whole arc end to end AND makes the judgment compound, defensible, and governed, so it out-scopes the point tools (the whole loop) rather than racing them on any single seam.

**Cadence is that substrate, the end-to-end product OS, with the decision layer as its moat.** One data model, one governed agent runtime, one orchestration layer that runs the whole loop (and drives the build tools), one trust layer, spanning sense to decide to define to build to ship to learn, running continuously. The decision layer plus the compounding memory is the moat; the build is one governed station within the loop (own engine or dispatched), not a standalone race against vibe-coding.

---

## Positioning: the closed product loop

Five statements that should never drift:

1. **The moat is the decision layer.** Cadence owns "what to build, and was it right" (no fast oracle, does not commoditize); vibe-coding owns "how to build" (racing to zero). We sit above the build tools and dispatch them. Memory is one layer of the moat, not the headline. Full canon: [`docs/strategy/moat.md`](./docs/strategy/moat.md).
2. **Agents execute; the human decides and is accountable.** Cadence agents don't just suggest; they _execute_ multi-step missions and report back. The human sets intent, approves the gates, and owns the call. Accountability is structurally human; it does not automate away.
3. **The closed, end-to-end loop.** Cadence runs the whole arc: customer signal $\rightarrow$ ranked + red-teamed decision $\rightarrow$ cited spec $\rightarrow$ build (own engine or dispatched) $\rightarrow$ ship $\rightarrow$ launch $\rightarrow$ outcome $\rightarrow$ learning, as one governed loop. factory.ai/Devin own autonomous _engineering_; Linear/Jira own _issues_; Notion owns _docs_; Lovable/Cursor own _building_, one station each. None owns the end-to-end loop, or the decision layer + the record of whether the call was right (the moat).
4. **Governed autonomy.** Every autonomous action is cited, observable in a live trace, approval-gated where it touches the outside world, and reversible. Autonomy without governance is a liability; Cadence ships both, which is what makes autonomy sellable to an enterprise.
5. **Continuous, and a force-multiplier, not a replacement.** Products never finish. Cadence makes one PM operate like a team and their judgment compound; it does not replace the PM. It gets more valuable the longer it runs (the decision memory compounds), and we monetize the decision work (credits), so we grow as decisioning gets cheaper.

### The USP

> **Cadence is the end-to-end product operating system: a swarm of specialist agents runs your whole product lifecycle, discover, decide, define, build, ship, launch, learn, as one governed loop, governed by you at the calls that matter. The moat is the decision layer (what to build, and whether the call was right) plus the compounding memory; the build is a governed station within the loop (own engine or dispatched). Vibe-coding is one station; Cadence is the whole loop, and makes the decision right.**

### The portability commitment

> **Your data is always yours.** Export everything (decisions, memory, signals, agent configs) in open formats, anytime. We earn your trust through value, not friction. See Epic U in [`docs/planning/feature-backlog.md`](./docs/planning/feature-backlog.md).

---

## The MOAT: why a frontier-model launch does not kill us

**The moat is the decision layer: what to build, and whether the call was right.** Vibe-coding tools (Lovable, Cursor) own the build layer, how to build, which is racing to zero; we own the decision layer, which has no fast oracle and does not commoditize, and we dispatch the build to them (Lovable builds the wrong thing beautifully; Cadence decides and proves). The model is **not** the moat; neither is raw data; Cadence is model-agnostic, so a lab's horizontal "PM agent" is a _capability we plug in_. **Memory is one layer of the moat, not the headline.** Full articulation, competition map (integrate / absorb / race / ignore), the PM/two-phase positioning, and the YC objection Q&A: **[`docs/strategy/moat.md`](./docs/strategy/moat.md)**. The defensibility is five layers a model release cannot replicate:

1. **End-to-end lifecycle orchestration.** Owning and orchestrating the entire loop, discover $\rightarrow$ build $\rightarrow$ ship $\rightarrow$ launch $\rightarrow$ support $\rightarrow$ learn, as one governed system.
2. **The trust & governance layer.** Approval gates, full audit trail, citations, evals, guardrails, budgets, and reversibility: the part enterprises require before they let agents touch real systems.
3. **System of record _and_ system of action.** Once a product org runs its decisions, code, releases, and institutional context through Cadence, it becomes the operating layer. Ripping it out means re-gluing the lifecycle by hand.
4. **Compounding Product Memory.** The longer Cadence runs, the better the agents know your product, your users, your decisions, and your domain. This intelligence is genuinely hard to rebuild.
5. **Agent-native interop.** Cadence speaks MCP and A2A both ways. It is the place other agents plug in to act inside a governed product org.

Positioning rule: **"Cadence orchestrates the models; it does not compete with them."**

---

## Who Cadence is for

We serve B2B Enterprise product organizations, establishing a collaborative environment for cross-functional stakeholders while onboarding individual PMs as grassroots evangelists:

- **P1, Enterprise Director / VP of Product (The Portfolio Governor):** Cares about security compliance, role scopes, budget caps, and swarm telemetry.
- **P2, Lead / Senior PM (The Daily Cockpit Operator):** Cares about eliminating boilerplate process (writing PRDs, triaging alerts, planning sprints) to focus on judgment.
- **P3, Engineering Lead / Tech Architect (The Code Gatekeeper):** Reviews Builder-generated code and verifies sandboxed PRs and CI status.
- **P4, UX/UI Designer (The Visual Validator):** Validates generated layouts, mockups, and UI changes in the interactive preview sandbox.
- **P5, GTM Lead / Product Marketer:** Monitors releases, refines auto-drafted changelogs, and schedules distribution announcements.
- **P6, Customer Support Lead:** Triage feedback, loops bug signals back into the discovery system.
- **P7, Grassroots Evangelist (Solo PM / Indie Hacker):** Individual adopters who seed Cadence in their respective orgs.

---

## Six stations, one loop (the platform offering)

Cadence delivers all six stations end to end. The engine runs a 12-stage loop internally; the operator sees **six stations**, each run by named specialist agents (full mesh: 19 agents, sub-agents, handoff contract, HITL gates, in [`docs/strategy/v4-feature-map-2026-06-11.md`](./docs/strategy/v4-feature-map-2026-06-11.md)). **BUILD is a governed station** (own engine, or dispatched to Lovable / Cursor / Devin under the same governance); the un-commoditizable ends (SENSE, DECIDE, LEARN) are where the moat lives:

1. **SENSE:** Scout, Listener, Researcher, Quant ingest everything users feel, say, and do (support, meetings, reviews, analytics, competitor moves) into one cited signal stream.
2. **DECIDE:** Strategist keeps a living, re-scored opportunity queue; Critic red-teams every candidate before the human ever sees it.
3. **DEFINE:** Scribe drafts cited specs; Designer scaffolds mockups checked against design tokens; Critic stress-tests the spec.
4. **BUILD:** Planner graphs the work; Builder codes on isolated branches with CI self-correction, or delegates to Devin/Cursor/Factory-class agents under the same governance; Inspector gates quality; Releaser ships safely.
5. **LAUNCH:** Marketer drafts the full launch kit in brand voice; Pricer analyzes packaging; everything customer-visible is approval-gated.
6. **LEARN:** Support triages tickets back into signals; Quant reads outcomes; Historian writes what we learned into Product Memory, which re-ranks everything upstream.

The user-facing app is **seven surfaces** (Home · Chat · Missions · Product · Knowledge · Learn · Govern + Settings); the engine never appears as navigation. IA contract: [`design.md`](./design.md) § Information architecture.

### GTM posture (decided 2026-06-11)

**PLG wedge → enterprise.** Land with the individual senior PM via the **Critic teardown** (the 10-minute wow: point Cadence at a feature you believe in, get an evidence-backed red-team, "why your pet feature is wrong, with receipts"), then expand team → org. Self-serve is **credits-only** (managed AI credits + capped top-ups; BYOK is enterprise-only); pricing is **account-level** and gates the **decision layer** (persistent memory, Critic everywhere, governance), never the build. Credits and billing pool at the **account**, not per-workspace, the market-standard pattern for products whose value compounds with usage (Anthropic, OpenAI, Vercel, Bolt, and Replit all pool at the org/account and treat the sub-container as cost attribution); per-workspace billing would tax the very behavior that deepens our moat. Enterprise governance (SSO, audit, roles, budgets) is built into the architecture from day 1. Pain-point-first; investor framing secondary. Full model: [`docs/strategy/moat.md`](./docs/strategy/moat.md) §7 + [`docs/planning/workspace-tenancy-and-monetization-plan.md`](./docs/planning/workspace-tenancy-and-monetization-plan.md) (§2.4 the tier matrix; §4.2.1 the credit engine).

---

## Pluggable Multi-Model Substrate

To maintain high reasoning quality while optimizing cost, Cadence’s **AI Chokepoint** (`runtime.server.ts`) acts as a router that selects the best model for each task:

| Model Category                  | Primary Models                        | In Cadence                                                                  |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| **High-Context Audio/Ingest**   | Gemini 1.5 Pro                        | Ingesting 1M+ token audio logs (WhisperFlow) and support dumps without loss |
| **High-Reasoning & Spec Draft** | Claude 3.5 Sonnet / GPT-4o            | Spec drafting, roadmap dependency generation, and strategic briefs          |
| **Surgical Code Generation**    | DeepSeek-Coder-V2 / Claude 3.5 Sonnet | Executing branch code changes and self-correcting compile errors            |
| **Fast Intent Classification**  | Gemini 1.5 Flash / GPT-4o-mini        | Chat intent routing and real-time dashboard updates                         |

- **BYO Key Protocol:** Securely encrypts client keys in Supabase (`pgsodium`), allowing enterprises to use their custom endpoints and VPC configurations. _(Positioning update 2026-06-19: BYOK is removed from self-serve and is an enterprise-only negotiated option; managed AI credits are the only self-serve path. Model-agnostic routing across providers with our keys is preserved. See [`docs/strategy/moat.md`](./docs/strategy/moat.md) §7 and [`docs/planning/workspace-tenancy-and-monetization-plan.md`](./docs/planning/workspace-tenancy-and-monetization-plan.md) §2.6.)_

---

## Architecture at a glance

A request enters at the **client**, passes the **account / workspace / product tenancy** gate (where decision memory pools at the account, the compounding moat), is planned by the **orchestration layer** (which dispatches the build), every model call funnels through the **AI chokepoint** (credits-metered), and state lives in one **database**.

```text
1. CLIENT  (calm front; the decision loop is the hero)
   Home · Chat · Missions · Product · Knowledge · Learn · Govern + Settings
   Stack: TanStack Start (React 19 + Vite) · Tailwind v4 · shadcn/ui
        |  server functions (typed RPC)        |  /api/public/hooks/*
        v                                      v
2. ACCOUNT / WORKSPACE / PRODUCT TENANCY  (isolation gate + the moat)
   Supabase Auth -> RLS scoped by account + workspace + product
   decision memory pools at the account (the compounding moat)
   Contract: architecture/security.md, architecture/data.md
        |
        v
3. ORCHESTRATION  (runs the sense -> decide -> learn loop)
   workflow engine · parallel sub-agents · the Critic · governance gates
   dispatches the BUILD (own engine, or Lovable / Cursor / Devin)
   Contract: architecture/orchestration.md
        |
        v
4. AI CHOKEPOINT  (src/lib/ai/runtime.server.ts; EVERY model call)
   budget -> credits -> cache -> pre-guard -> RAG -> PROVIDER -> post-guard
   Contract: architecture/runtime.md
        |
        v
5a. MODELS (model-agnostic): Claude · Gemini · GPT · DeepSeek
    our keys, credits-metered (BYOK is enterprise-only)
5b. DATA (one store): Supabase Postgres; RLS · pgvector (RAG) · pg_cron
    Contract: architecture/data.md
```

Where each layer lives in detail: [`architecture/`](./architecture/). Stack rationale and the open-source posture: [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md).

---

## Documentation map

| If you are…                                                               | Read                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evaluating Cadence                                                        | **README.md** (here)                                                                                                                                                                                                                                |
| **What to build next + how it should look and behave (CURRENT, pick first)** | **[`docs/strategy/v10-master-blueprint-2026-06-17.md`](./docs/strategy/v10-master-blueprint-2026-06-17.md)** (the master blueprint: every feature with pain + how it functions, IA, screen-by-screen, the analytical engine, priority + disjoint lanes) · execution order: [`docs/planning/v10_implementation-plan.md`](./docs/planning/v10_implementation-plan.md) · live status: [`docs/planning/feature-dashboard.md`](./docs/planning/feature-dashboard.md) · which-doc-to-pick role map: [`docs/strategy/README.md`](./docs/strategy/README.md) · **current build initiative:** [`docs/planning/workspace-tenancy-and-monetization-plan.md`](./docs/planning/workspace-tenancy-and-monetization-plan.md) (workspace / accounts / tenancy + monetization, the cross-tool build bible; live board group G10 in feature-dashboard) |
| Understanding positioning (CURRENT source of truth)                       | **[`docs/strategy/v7-agentic-product-os-2026-06-14.md`](./docs/strategy/v7-agentic-product-os-2026-06-14.md)** (positioning + market) · **[`v8-calm-front-deep-engine-2026-06-16.md`](./docs/strategy/v8-calm-front-deep-engine-2026-06-16.md)** (structure + hybrid Build spine) · **[`v9-decision-wedge-and-build-next-2026-06-17.md`](./docs/strategy/v9-decision-wedge-and-build-next-2026-06-17.md)** (decision lens: Critic-teardown wedge, competitor posture, own-the-autonomous-engine, build-next) · engine/expansion: [`v4-feature-map-2026-06-11.md`](./docs/strategy/v4-feature-map-2026-06-11.md) · wedge UX: [`v5-chief-of-staff-2026-06-11.md`](./docs/strategy/v5-chief-of-staff-2026-06-11.md) · personas: [`v3-positioning-cadence-2026-06-10.md`](./docs/strategy/v3-positioning-cadence-2026-06-10.md) · index+archive: [`docs/strategy/README.md`](./docs/strategy/README.md) |
| Strategy reasoning + fundraising source narrative (YC / investor)         | [`docs/strategy/strategic-inputs-log.md`](./docs/strategy/strategic-inputs-log.md): the raw brainstorm reasoning + evidence behind the canon (operator/PM/investor/marketer lenses), the source narrative for accelerator/investor applications · decisions: [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md) · **moat / competition / defensibility (YC + interview prep):** [`docs/strategy/moat.md`](./docs/strategy/moat.md) |
| Founding constitution (AI co-founder posture, north star, mandates)       | [`Ai_Cofounder.md`](./Ai_Cofounder.md): its Repo Concordance maps its 13 mandated docs onto this repo's canon                                                                                                                                      |
| Market & competitor evidence                                              | [`docs/references/competitive-landscape-2026-06-11.md`](./docs/references/competitive-landscape-2026-06-11.md)                                                                                                                                      |
| Resuming the v4 rebuild session                                           | [`docs/planning/archive/v4-rebuild-handoff-2026-06-11.md`](./docs/planning/archive/v4-rebuild-handoff-2026-06-11.md)                                                                                                                                                |
| Navigating the repo                                                       | [`ENTRY.md`](./ENTRY.md)                                                                                                                                                                                                                            |
| Building (human or agent)                                                 | [`AGENTS.md`](./AGENTS.md). Claude Code: [`CLAUDE.md`](./CLAUDE.md). Antigravity/Gemini: [`GEMINI.md`](./GEMINI.md).                                                                                                                                |
| Feature scope + build order + build log                                   | [`plan.md`](./plan.md)                                                                                                                                                                                                                              |
| Design / UI / motion                                                      | [`design.md`](./design.md)                                                                                                                                                                                                                          |
| Architecture (runtime, orchestration, data, auth, frontend, integrations) | [`architecture/`](./architecture/)                                                                                                                                                                                                                  |
| Subagents / skills / tools / hooks                                        | [`docs/operations/subagents.md`](./docs/operations/subagents.md) · [`docs/operations/skills.md`](./docs/operations/skills.md) · [`docs/operations/tools.md`](./docs/operations/tools.md) · [`docs/operations/hooks.md`](./docs/operations/hooks.md) |
| Memory / commits / git discipline                                         | [`docs/operations/memory.md`](./docs/operations/memory.md) · [`docs/operations/commits.md`](./docs/operations/commits.md) · [`docs/operations/git-discipline.md`](./docs/operations/git-discipline.md)                                              |
| Stack + name decisions                                                    | [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md) · [`docs/decisions/naming.md`](./docs/decisions/naming.md)                                                                                                                         |

Every doc cross-references the others. **Do not let them drift.** Update protocol in [`AGENTS.md`](./AGENTS.md), section 5. **Before creating any new file, follow the repository map + file-placement policy in [`docs/README.md`](./docs/README.md)** (right subfolder + index link, same commit; never repo root or `docs/` top level; no duplicates/stubs).

---

## License

Permissive intent. Until chosen: all rights reserved, © Cadence contributors.

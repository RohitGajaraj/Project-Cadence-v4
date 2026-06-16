# v4 Feature Map: The Agent-Run Product Lifecycle, End to End (2026-06-11)

> **What this is.** The canonical, stress-tested feature scope for Cadence (interim name, see [`../decisions/naming.md`](../decisions/naming.md)): every lifecycle station, every agent, every handoff, every human gate, decomposed L0→L5 and sequenced into milestones. **This supersedes [`v3-positioning-cadence-2026-06-10.md`](./v3-positioning-cadence-2026-06-10.md) for feature scope and IA.** Personas and the closed-loop metaphor from v3 remain valid.
>
> **Who reads this.** Any human or AI session (Claude Code / Lovable / Antigravity) before building any feature. Build order lives in [`../../plan.md`](../../plan.md) §3; ticket-level F-IDs in [`../planning/feature-backlog.md`](../planning/feature-backlog.md); why this map exists in [`v4-stress-test-2026-06-11.md`](./v4-stress-test-2026-06-11.md); market evidence in [`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md).
>
> **Decisions baked in (founder-confirmed 2026-06-11):** PLG wedge → enterprise; pain-point-first; naming deferred; no V1/V2 gating, full scope, milestone-sequenced; frontier-absorption designed in at every node.

---

## 0. L0: The platform in one sentence, and the laws it obeys

**One unified platform where a swarm of specialist agents runs the entire product lifecycle: sense → decide → define → build → launch → learn, continuously, with the human appearing only at the calls that matter.**

Seven laws (every feature must satisfy all seven; if it can't, it doesn't ship):

1. **Agents run it.** Every station has a named agent that *executes* the work, not a form the human fills. The human's verbs are: set intent, approve, redirect, override.
2. **One loop, no seams.** Every artifact links to its upstream evidence and downstream consequence (signal → opportunity → spec → tasks → PR → release → outcome → learning → re-score). A seam requiring manual transport is a defect.
3. **Trust is the UI.** Every agent output carries citations, cost, model, trace link, and an undo/rollback path. Approval gates wherever the outside world is touched.
4. **Simple front, powerful engine.** ≤7 user-facing surfaces (§7). The engine (orchestration, evals, guardrails, prompts, drift, budgets) lives behind them, visible on demand, never as primary navigation.
5. **Frontier-absorption at every node.** Each station declares: native agents · pluggable external-agent slots (MCP/A2A) · what happens when a frontier lab ships a better brain (answer: it routes through the chokepoint and the station gets better for free). We orchestrate models; we never compete with them.
6. **Memory compounds.** Every mission consults Product Memory before acting and writes a learning after. The platform must be measurably better at month 6 than week 1 for the same customer.
7. **Cost is a feature.** Every mission and artifact shows what it cost. Small-model routing by default; budget-aware degradation, never surprise bills.

---

## 1. L1: Six stations over the 12-stage engine

The engine keeps the v3 12-stage loop (S1 to S12) internally. The user sees **six stations**, the engine stages map beneath them:

| Station (user-facing) | Engine stages | Job statement (the pain it kills) |
| --- | --- | --- |
| **SENSE** | S1 Signal Capture · S2 Audio/Meeting Intake · S11 Cohort Analytics (inbound) | "I never have the full picture of what users feel, say, and do: it's smeared across 10 inboxes." |
| **DECIDE** | S3 Prioritization · S12 Learn & Reflect (re-score) | "I can't defend why this is on the roadmap, and yesterday's lessons don't change today's ranking." |
| **DEFINE** | S4 Spec Definition · S7 Visual QA (design intent) | "Specs take days, drift from evidence, and designers/engineers read them differently." |
| **BUILD** | S5 Sprint Planning · S6 Agentic Build · S7 Visual QA (validation) · S8 Safe Release | "Handing off to delivery is where context dies; I become the human status-poller." |
| **LAUNCH** | S9 GTM Launch | "Every release needs changelogs, posts, enablement, pricing thought, done by hand at 6pm." |
| **LEARN** | S10 Support Triage · S11 Cohort Analytics (outcomes) · S12 Learn & Reflect | "We ship and never honestly check whether it worked; support knows things product never hears." |

Two spines run beneath all six stations: the **Orchestrator** (goal → mission DAG → dispatch → finalize, exists) and the **Reactor** (event → subscribed pipeline, exists). They are engine, not navigation.

---

## 2. L2: The agent mesh (native roster, sub-agents, external slots)

### 2.1 Native roster: 17 specialists + 2 spine agents

Out-of-the-box, zero configuration. Each row: what it runs, its sub-agents (spawned ephemerally), its external plug-in slot, and its frontier-absorption path.

| # | Agent | Station | Executes (not assists) | Spawnable sub-agents | External slot (MCP/A2A) | Frontier-absorption |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Scout** | SENSE | Ingests every connected source; dedupes, classifies, clusters signals → themes; sentiment + severity | per-source ingest workers; cluster-refiner | Enterpret/Dovetail MCP as alternative ingest brains | Better embedding/clustering models drop in via chokepoint |
| 2 | **Listener** | SENSE | Records/transcribes meetings + interviews; extracts decisions, asks, pains → signals; voice-memo → structured note | diarization worker; extraction worker | Gong/Granola/Fireflies via MCP | Speech models swap freely (Whisper-class → better) |
| 3 | **Researcher** | SENSE | Continuous competitor/market watch: release notes, pricing pages, reviews, job posts → briefs with citations | crawl workers per competitor | Perplexity-style research APIs; Apify actors | A research-tuned frontier model = better briefs, same governance |
| 4 | **Quant** | SENSE+LEARN | Watches product analytics: anomalies, funnels, cohort shifts → signals with evidence | metric-watcher per KPI | Amplitude/Mixpanel/PostHog MCP | Reasoning models improve causal reads; data stays ours |
| 5 | **Strategist** | DECIDE | Maintains the ranked opportunity queue (ICE/RICE); re-scores on every new signal/outcome; drafts strategy briefs; flags vision drift | scoring worker; tradeoff-analyst | external scoring/OKR tools | A "CPO-model" becomes its brain; ranking data + lineage stay ours |
| 6 | **Critic** | DECIDE+DEFINE | Red-teams every opportunity and spec before human review: weak evidence, hidden costs, cannibalization, "what would kill this" | none | external eval agents | Adversarial models make it sharper, pure upgrade |
| 7 | **Scribe** | DEFINE | Drafts PRDs/specs from opportunities, fully cited; acceptance criteria, non-goals, risks, metrics; versioned diffs; inline `/ai` edits | section workers (parallel spec sections) | ChatPRD-style agents could slot here | The most commoditized step, by design a swappable brain |
| 8 | **Designer** | DEFINE | Generates wireframes/mockups/clickable scaffolds from specs; checks design-token + a11y compliance; produces design-handoff notes | layout worker; a11y auditor | Figma MCP; v0/Lovable for hi-fi scaffolds | Image/UI models improve free; token-compliance rules are ours |
| 9 | **Planner** | BUILD | Spec → dependency-aware task graph with estimates + risk; syncs to Linear/Jira/GitHub Issues bidirectionally | estimation worker | Linear for Agents (delegate out) | Planning-tuned models = better graphs, same sync contract |
| 10 | **Studio** (display name; slug `builder`, terminology ruling 2026-06-12, see [`../features/studio.md`](../features/studio.md)) | BUILD | Multi-file coding on isolated `studio/*` branches, file-lock claims, DB-staged changesets, PRs, CI read, self-correct loop, in-platform merge (shipped, F-STUDIO, supersedes Bundle 9) | per-file workers; fix workers | **Devin/Factory/Cursor/Codegen via Linear-style delegation. Studio is our default, never a lock-in** | Coding agents are the most replaceable node, that's deliberate |
| 11 | **Inspector** | BUILD | Authors + runs tests (unit/integration/E2E), evals for AI features; sandbox preview deploys; visual regression vs design tokens; gates merge | test-writer; preview-deployer | external QA agents/BrowserStack-class tools | Better test-gen models drop in |
| 12 | **Releaser** | BUILD | Merge → deploy checklist → staged rollout → monitors health → auto-rollback proposal; drafts release notes | canary watcher | CI/CD via GitHub/MCP | Ops-tuned models improve judgment; runbook + gates are ours |
| 13 | **Marketer** | LAUNCH | Changelogs, launch posts, emails, social drafts, docs updates, positioning briefs, from the diff + spec + memory, in brand voice | per-channel copy workers | brand-voice agents; Canva/CMS MCP | Writing models are interchangeable; voice memory + approval flow are ours |
| 14 | **Pricer** | LAUNCH | Packaging/pricing analysis on every major launch: willingness-to-pay signals, competitor pricing deltas, margin impact | none | external pricing data tools | Niche analyst models slot in |
| 15 | **Support** | LEARN | Triages inbound tickets; drafts replies (approval-gated); detects bug clusters → files signals + issues; updates help docs | per-queue triage workers | Intercom/Zendesk MCP; Decagon-class agents could replace the reply half, triage→signal loop stays ours | Support models swap in freely |
| 16 | **Historian** | LEARN | Writes the outcome review per shipped spec (predicted vs actual); maintains decision lineage (`supersedes`); publishes learning briefs; keeps Product Memory current, flags stale facts | none | none | Memory is the moat, never outsourced; better models just read/write it better |
| 17 | **Concierge** | ALL | The chat front-door: intent classification → answers from memory with citations, or proposes a mission plan; the "Perplexity for your product" surface | none | none | IS mostly model, thinnest wrapper by design, upgraded every model release |
| 18 | **Orchestrator** *(spine)* | all | Goal → mission DAG → dispatch → observe → finalize (exists) | any specialist | A2A delegate-out to external agents | Planner-tuned frontier models = better decomposition |
| 19 | **Reactor** *(spine)* | all | Event subscriptions → auto-pipelines behind governance (exists) | none | inbound webhooks/MCP events | none |

**Roster law:** new-user default shows the *stations working*, not 19 configs. Agents are met through their output ("Scout found 3 themes overnight"), configured only via progressive disclosure in Settings → Staff.

### 2.2 A2A handoff contract (the seam-killer)

Every handoff between agents is a typed message (exists as `agent_messages` + `mission_steps`; v4 formalizes the payload):

```
HandoffEnvelope {
  mission_id, from_agent, to_agent,
  artifact: { type: signal|theme|opportunity|spec|task_graph|pr|release|ticket|outcome_review, id, version },
  context_bundle: { evidence_ids[], memory_refs[], constraints[], prior_attempts[] },
  acceptance: { criteria[], approval_mode: auto|confirm|review, budget_cap_usd },
  provenance: { trace_id, cost_so_far }
}
```

Rules: (a) a handoff without `evidence_ids` is rejected by the runtime; (b) the receiving agent must emit `accepted | rejected(reason) | needs_human` within its first step; (c) every envelope renders in the Mission view as a graph edge a human can click. **This is the platform's circulatory system and the #1 thing competitors don't have.**

### 2.3 Human-in-the-loop gate matrix (canonical)

| Action class | Default mode | Rationale |
| --- | --- | --- |
| Read/ingest/cluster/score/draft (internal artifacts) | `auto` | Reversible, internal, cited |
| Writing to connected externals (Linear issues, GitHub PRs, calendar) | `confirm` | Touches the org's systems; one-click approve in queue |
| Merge to main, deploy, rollback | `review` | Code gatekeeper persona (or solo PM) must look |
| Anything customer-visible (support replies, posts, emails, changelogs publish) | `review` | Brand + legal blast radius |
| Spend above per-mission budget cap; new connector scopes | `review` + owner only | Money + security |
| Kill-switch, roster changes, guardrail edits | owner only | Governance of the governors |

Per-workspace overrides per agent (exists). M3 adds per-*role* lanes (designer approves design artifacts; GTM approves launch copy; eng lead approves merges).

---

## 3. L3: Feature catalog by station

Format: **F-ID · feature, what ships.** `[E]` exists/extend (per current src), `[N]` new. Sub-feature decomposition (L4) and agent actions (L5) live in [`../planning/feature-backlog.md`](../planning/feature-backlog.md); the golden path is decomposed to L5 in §9 here.

### SENSE

- **SEN-01 · Connector dock:** first-class ingest connectors: Slack channels, Intercom/Zendesk, GitHub issues, app-store reviews, NPS imports, CSV/paste `[E: paste/CSV only]`. *M1: Slack + GitHub + one support tool.*
- **SEN-02 · Continuous Scout feed:** always-fresh themes with evidence pills, severity, novelty vs memory `[E]`.
- **SEN-03 · Meeting/interview intake:** record/upload → transcript → extracted pains/asks/decisions → signals; voice memo capture `[E: meetings partial]`.
- **SEN-04 · Researcher watchtower:** competitor set per product; scheduled crawls; diffed briefs with citations `[N]`.
- **SEN-05 · Quant inbound:** analytics connector (PostHog/Amplitude/Mixpanel) → anomaly/funnel signals `[N]`.
- **SEN-06 · Unified signal inbox:** one stream, source-agnostic, with "promote to opportunity" as agent suggestion, not manual chore `[E]`.

### DECIDE

- **DEC-01 · Living opportunity queue:** ICE/RICE ranked, re-scored on every signal/outcome; "what changed since yesterday" diff `[E: scoring exists; live re-score partial]`.
- **DEC-02 · Critic pass:** every opportunity above threshold gets an adversarial review attached before human sees it `[N]`.
- **DEC-03 · Strategy brief:** per-product vision/strategy doc the Strategist keeps current; drift alerts when the queue diverges from stated strategy `[E: briefing exists, static]`.
- **DEC-04 · Decision log with lineage:** every promote/kill/defer is a decision node with `supersedes` chain `[E]`.
- **DEC-05 · Portfolio view:** cross-product queue for multi-product operators `[N, M4]`.

### DEFINE

- **DEF-01 · Cited spec generation:** opportunity → full PRD with acceptance criteria, non-goals, risks, metrics; every claim cited to signals/memory `[E]`.
- **DEF-02 · Spec editor:** Tiptap + inline `/ai`, version diffs, comment threads `[E; comments N]`.
- **DEF-03 · Critic-on-spec:** pre-review red-team: ambiguity, untestable criteria, scope creep `[N]`.
- **DEF-04 · Design scaffold:** spec → wireframe/mockup set → clickable scaffold in sandbox; design-token + a11y check `[N — the "Lovable for PMs" pillar, currently placeholder]`.
- **DEF-05 · Design handoff pack:** tokens, states, breakpoints, edge cases auto-derived from the scaffold `[N, M3]`.

### BUILD

- **BLD-01 · Task graph + estimates:** spec → dependency DAG with risk flags `[E]`.
- **BLD-02 · Two-way tracker sync:** Linear/Jira/GitHub Issues, agent-as-contributor pattern `[E: partial]`.
- **BLD-03 · Builder missions:** branch-isolated multi-file coding, file-lock claims, PR + CI self-correct loop `[E — Bundle 9]`.
- **BLD-04 · Delegate-out:** same task graph dispatchable to external coding agents (Devin/Factory/Cursor via Linear or A2A); identical governance + trace `[N — strategic: we orchestrate, never lock in]`.
- **BLD-05 · Inspector gate:** agent-authored tests must pass + sandbox preview link before merge is proposed `[N: partial CI read exists]`.
- **BLD-06 · Visual validation:** preview screenshot diffs vs design scaffold for the Designer/PM to approve `[N, M3]`.
- **BLD-07 · Safe release:** deploy checklist, staged rollout, health watch, rollback proposal `[N: release notes partial]`.

### LAUNCH

- **LCH-01 · Launch kit generation:** changelog, blog draft, email, social, docs update, one mission from the merged diff + spec, brand-voice aware `[N: drafts partial]`.
- **LCH-02 · Launch calendar + checklist:** gated publishing to connected channels (Slack announce, email tool, CMS) `[N]`.
- **LCH-03 · Pricing/packaging brief:** Pricer analysis on launches flagged "monetizable" `[N, M4]`.
- **LCH-04 · Enablement notes:** sales/support-facing "what changed, what to say" cards `[N, M3]`.

### LEARN

- **LRN-01 · Support triage loop:** inbound tickets classified, replies drafted (gated), bug clusters → signals + issues `[N: thin read exists]`.
- **LRN-02 · Outcome reviews:** N days post-release, Historian compares spec's predicted metrics vs actuals; verdict: worked / partial / failed / unknown `[N]`.
- **LRN-03 · Learning briefs → re-score:** outcomes feed Strategist re-ranking; visible "this learning moved these 3 priorities" `[N: partial]`.
- **LRN-04 · Product Memory graph:** queryable signals→decisions→outcomes graph; consulted by every mission (visible in trace); stale-fact flags `[N: tables exist, consultation loop missing — the moat]`.
- **LRN-05 · Skill packs:** exportable, versioned bundles of product knowledge usable by external agents over MCP `[N, M4]`.

### Cross-cutting (the engine, behind the curtain)

- **ENG-01 · Orchestrator + mission DAG** `[E]` · **ENG-02 · Reactor auto-pipelines** `[E]` · **ENG-03 · Trust stack** (traces, evals, guardrails, drift, budgets, approvals) `[E]` · **ENG-04 · Chokepoint multi-model routing + BYOK** `[E]` · **ENG-05 · Memory runtime** (consult/write API for all agents) `[N]` · **ENG-06 · Cost-per-artifact telemetry** `[N]` · **ENG-07 · MCP server + client, A2A cards/scopes/audit** `[N]` · **ENG-08 · Roles + per-persona approval lanes** `[N, M3]` · **ENG-09 · SSO/SAML, audit export, data residency** `[N, M4]` · **ENG-10 · Prompt-injection defense on all ingested content** `[E: partial — mandatory before SEN connectors widen]`.

### Operator comfort (small, deliberate, human)

- **OPS-01 · Flow mode:** optional subtle ambient soundscape + focus timer on Home; mutes non-critical notifications during focus blocks `[N, P3 — founder's wish, kept small]`.
- **OPS-02 · Daily brief:** morning narrative: what agents did overnight, what needs you, top 3 calls today `[E: Today partial]`.
- **OPS-03 · Command palette everywhere** `[E]`.

---

## 4. Stakeholder value map (every seat, agent-served)

| Stakeholder | Primary surfaces | What agents do for them | Their gates |
| --- | --- | --- | --- |
| **PM (core operator)** | Home, Chat, Missions, Product | The whole loop: sense→learn busywork eliminated; they set intent + judge | opportunity promote, spec approve |
| **VP/Director (exec)** | Home (portfolio), Govern | Portfolio pulse, budget/spend telemetry, audit trail, kill-switch | budgets, roster, guardrails |
| **Engineering lead** | Missions (build lane) | Reviews agent PRs with CI status + claims; delegates to preferred coding agent | merge/deploy |
| **Designer** | Product (specs/scaffolds) | Scaffolds + token/a11y checks generated; they validate visually | design artifact approval |
| **QA/Tester** | Missions (inspector lane) | Tests authored/run by Inspector; they audit coverage + edge cases | release gate co-sign |
| **GTM/Marketer** | Launch kit queue | Launch kits drafted in brand voice; they edit + approve | anything customer-visible |
| **Support lead** | Learn (triage) | Triage + drafted replies; bug clusters auto-filed | outbound replies |
| **Growth/Analyst** | Learn (outcomes) | Cohort/funnel reads, anomaly alerts, outcome reviews | experiment launches |
| **Researcher** | Sense (interviews/watchtower) | Transcription, extraction, synthesis, competitor briefs | publishing research claims to memory |

PLG note: in M1 the **solo PM plays all seats**, the same gates exist, all routed to one person. Roles (M3) split the lanes without changing the model.

---

## 5. Pluggable multi-model substrate (unchanged contract, v4 routing table)

All calls through `runtime.server.ts` (the chokepoint). Routing is **task-class → best available brain**, never hardcoded to a vendor; BYOK + private endpoints for enterprise.

| Task class | Route to (June 2026) | Swap trigger |
| --- | --- | --- |
| Long-context ingest (transcripts, dumps) | Gemini-class 1M+ ctx | any longer/cheaper ctx |
| High-reasoning (strategy, spec, critic, planning) | Claude/GPT frontier tier | any reasoning jump, incl. a future "PM-tuned" frontier model, which routes here and upgrades DECIDE/DEFINE for free |
| Code gen + repair | Claude/DeepSeek coder tier | benchmark-driven |
| Fast classify/route (intent, triage, dedupe) | small fast tier (Flash/mini) | cost-driven |
| Embeddings/clustering | dedicated embed models | quality-driven |

**Frontier-absorption restated as policy:** model improvements are upgrades, *external PM agents* are delegate-out targets, and our defensibility lives only in: the loop, the governance, the memory, the connectors, and the system-of-record gravity. Anything else is rented intelligence.

---

## 6. Vocabulary (one language, enforced everywhere)

**Mission** (a goal agents are running) · **Agent** (a named specialist) · **Approval** (a human gate) · **Trace** (the auditable record of one AI action) · **Signal → Theme → Opportunity → Spec → Task → Release → Outcome → Learning** (the artifact chain). Banned: Swarm HUD, Run/Trajectory (use Mission/Trace), Inbox-as-approvals, "AI Ops", "Eval Harness" in user-facing copy. (Per v3 language audit; now binding.)

---

## 7. The IA: seven surfaces, one storyline

> The founder's complaint and the stress-test F1 verdict resolve here. Navigation is the *story of the loop*, not the anatomy of the engine. Detailed UI contract: [`../../design.md`](../../design.md).

| # | Surface | Contains (tabs/sections) | Absorbs current routes |
| --- | --- | --- | --- |
| 1 | **Home** | Daily brief · needs-you queue (approvals inline) · loop pulse · Flow mode | index, briefing, inbox(badge) |
| 2 | **Chat** | Concierge: ask-the-product (cited) or launch missions in natural language; inline mission progress | chat |
| 3 | **Missions** | Live mission list + DAG view; build lane (Builder/Inspector detail); agent activity feed | cockpit, missions, swarm, build, agents(view) |
| 4 | **Product** | The system of record as lifecycle tabs: Signals · Opportunities · Specs · Roadmap · Releases | discovery, opportunities, prds, roadmap, outcome(part) |
| 5 | **Knowledge** | Memory graph · decisions · docs · calendar/meetings | docs, decisions, calendar, meetings |
| 6 | **Learn** | Support triage · outcomes · learnings | outcome(part), analytics(user-facing) |
| 7 | **Govern** | Approvals policy · budgets · guardrails · traces · evals · drift · prompts, tabbed engine room | governance, guardrails, budgets, observe, traces, evals, drift, prompts |
|  | **Settings** | workspace/products · staff (agent roster config) · connectors · models/BYOK · profile | settings, integrations, sync, agents(config) |

Rules: pinned rail = Home · Chat · Missions. Tasks fold into Product→Roadmap. Every absorbed route becomes a `beforeLoad` redirect (established pattern). **No new top-level routes without a session decision.**

---

## 8. GTM & pricing posture (PLG wedge → enterprise)

- **Wedge:** solo senior PM, self-serve. Free tier: 1 product, capped agent-hours/month, all stations visible. **10-minute wow:** connect one source → Scout finds themes → one click → cited spec + task graph. That moment is M1's definition of done.
- **Pro (individual/team):** per-seat + metered agent usage with hard caps and cost-per-artifact visibility (attack the suites' opaque credits).
- **Enterprise (M4):** governance plane (SSO, audit export, roles, budgets, BYOK/VPC), priced on outcomes/missions, not seats, where possible.
- Positioning sentence: **"Your product org, running itself, under your command."**

---

## 9. Milestones (no versions, each milestone is demo-able and shippable)

### M1: The Golden Path (demo-ready definition)
The single continuous run, watchable end-to-end in <10 min, polished:
**connect Slack/GitHub → Scout themes → Strategist ranks (Critic attached) → approve → Scribe spec (cited) → approve → Planner task graph → Builder PR + CI green (or delegate-out) → release notes draft → outcome card seeded.**
Includes: IA collapse to §7 (F-IA-V4), vocabulary enforcement, cost-per-mission chip, OPS-02 daily brief, empty states that narrate the loop. **Excludes:** roles, portfolio, marketplace anything.
*L4/L5 exemplar for one hop (Scout→Strategist), the pattern every hop follows:* L4: SEN-02.3 "theme promotion suggestion", Scout emits HandoffEnvelope(artifact=theme, evidence≥3 signals, acceptance=confirm). L5 agent actions: `signals.fetch_new` → `embed.batch` → `cluster.assign` → `theme.upsert` → `memory.consult(similar_themes)` → `handoff.emit(strategist)`; human sees one card: "New theme: export failures (12 signals) → propose opportunity?" [Approve] [Tweak] [Dismiss]. Every other hop is decomposed to this grain in the backlog, not here.

### M2: The Loop Closes (the differentiator)
Right half becomes real: LRN-01 support triage loop, SEN-05 Quant inbound, LCH-01 launch kits, LRN-02 outcome reviews, LRN-03 re-score visible, ENG-05 memory consult/write on every mission (+ trace visibility), ENG-06 cost-per-artifact. Reactor default pipelines on. **Proof: a support ticket cluster measurably re-ranks the opportunity queue with zero human transport.**

### M3: The Team Arrives
ENG-08 roles + persona approval lanes; DEF-04/05 design scaffolds + handoff; BLD-06 visual validation; LCH-04 enablement; comments on specs; multi-seat workspaces. **Proof: designer, eng lead, and GTM each complete their gate in their own lane on one mission.**

### M4: The Org Runs Itself
Portfolio view, budgets enforcement UX, ENG-07 MCP server/client + A2A delegate-out (BLD-04), LRN-05 skill packs, ENG-09 enterprise plane, LCH-03 pricing briefs. **Proof: an external agent completes a Cadence mission step under our governance, fully traced.**

### M5: Compounding
Memory-graph querying as a product surface, stale-fact drift, cross-product learnings, connector breadth, outcome-priced enterprise plans. **Proof: same-customer month-6 metrics beat week-1 (spec acceptance rate, mission cost, re-score precision).**

---

## 10. What we deliberately do NOT build

Our own foundation models; a general-purpose chat assistant; a Notion-class docs suite (docs exist only as lifecycle artifacts); a full ticketing system (we sync with Linear/Jira, we don't replace them in M1 to M3); generic workflow automation (Zapier-class); separate mobile app before M3 (mobile-web capture only).

---

*Update protocol: this file changes only with a session-decision entry ([`session-decisions.md`](./session-decisions.md)). Feature status lives in the backlog, not here. Keep the map stable; keep the backlog moving.*

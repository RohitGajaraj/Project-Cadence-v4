# v11: The Guiding Star

> _Created: 2026-06-23 · Status: **CURRENT standing canon (the guiding star).** This is the single document to read first for direction. It consolidates the whole strategy stack (v7 positioning, v8 structure, v9 wedge, v10 blueprint, moat.md) with a fresh, code-and-live-database-verified ground-truth audit, an outsider pressure-test, the core-user lens, the agent operating model, the consumer-grade design layer, the orchestration economics, and the full reasoning behind every decision in the 2026-06-23 strategy session. **When this doc and an older strategy doc disagree on direction, v11 wins.** The older docs remain valid for their detailed reference role._

> **For agents and future sessions:** the build items live in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (the ranked register; the v11 front is #1-18). The front-door cursor is [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md). This doc carries the *why*; the dashboard carries the *what/when*. The doc map is §0.3.

---

## 0. How to use this document

### 0.1 What this is and why it exists
On 2026-06-23 the founder asked for a brutally honest, outsider strategic teardown of Cadence (market and product), grounded in what is actually wired versus what the docs claim, and a single standing document that captures the whole conversation: every input, every decision, and the reasoning. This is that document. It is the guiding star for direction; it is meant to be re-read and to answer "why did we decide this" without re-deriving.

### 0.2 The reading order
1. The executive summary (§1) for the thesis in one page.
2. The ground truth (§2) for what is actually built.
3. Then any section you need; the table of contents is below.
4. For *what to build next*, read the [feature dashboard](../planning/feature-dashboard.md) (v11 front is #1-18). For *why each item*, the dashboard now carries a one-line **Why** per row plus a link back here.

### 0.3 The doc map (so any agent knows where everything lives, even if the founder does not open them)
| Need | Doc |
| --- | --- |
| Direction, moat, defense, the reasoning (THIS) | [v11-guiding-star.md](./v11-guiding-star.md) |
| What to build next, ranked, with a Why per row | [feature-dashboard.md](../planning/feature-dashboard.md) |
| The live cursor / front door | [SOURCE-OF-TRUTH.md](../planning/SOURCE-OF-TRUTH.md) |
| Why a past decision was made (the log) | [session-decisions.md](./session-decisions.md) |
| The moat stack + competition + YC Q&A (detail) | [moat.md](./moat.md) |
| Build vs buy vs integrate (the gate) | [build-buy-integrate.md](./build-buy-integrate.md) + [sourcing-map.md](./sourcing-map.md) |
| Positioning argument + course-corrections (detail) | [v7](./v7-agentic-product-os.md) |
| IA / structure / Engine-Room doctrine | [v8](./v8-calm-front-deep-engine.md) + [../conventions/engine-room-doctrine.md](../conventions/engine-room-doctrine.md) |
| The Critic-teardown wedge + competitor posture | [v9](./v9-decision-wedge-and-build-next.md) |
| The file-grounded blueprint (detail) | [v10](./v10-master-blueprint.md) |
| The role map (arbiter of which doc to pick) | [strategy/README.md](./README.md) |
| Operating rules for all tools | [../../AGENTS.md](../../AGENTS.md) |

### 0.4 Table of contents
1. Executive summary · 2. Ground truth · 3. The corrected North Star (ambient self-initiation) · 4. The agent operating model · 5. Positioning · 6. The core user (felt experience, pains, the future) · 7. The Brain · 8. The moat · 9. The villain and the defense · 10. Market · 11. Business model and pricing · 12. The Playbook Registry (embed-skills verdict) · 13. Orchestrate the builders (mechanics + BBI + economics) · 14. Consumer-grade: IA, the design layer, the landing page, connectors · 15. Scope: reuse, reposition, club, flag · 16. Missing capabilities and adjacent markets · 17. Extended stakeholders · 18. PMF and founder-market fit · 19. Risk register · 20. The agentic doctrine · 21. The build plan (to consumer-ready) · 22. The pitch · 23. Metrics and gates · 24. Session inputs and decisions (2026-06-23) · 25. Provenance · **26. Appendix: the full research record (the groundwork)**.

> **If any section above feels too brief, its full-depth version is in the Appendix (§26):** A1 the complete villain/defense, A2-A6 the five ground-truth probes (strategy-doc, build-state, technical, live-app, market), A7-A8 the core-user research (felt experience + pains + future of PM), A9 the Playbook Registry, A10 market/pricing, A11 orchestration economics, A12 the IA audit, A13 the reference images, A14 the raw artifacts, **A15 the full session narrative** (every founder steer and how it shaped the work), and **A16 the decision rationale** (the how-we-decided behind every call). Agents: read the appendix for full context before building a v11 item.

---

## 1. Executive summary

**The reframe (the headline).** The founder's fear is that Cadence is "fragmented bits and pieces, no interlinking, no automation." At the engine level that is **verifiably false**, and that is the good news. At the data-and-visibility level it is **true**, and that is the real, fixable problem.

- **What is real (code and live-DB verified):** a governed, end-to-end autonomous engine. A `pg_cron` job fires every minute and auto-advances missions through a station-ordered DAG (Sense to Decide to Define to Build to Ship to Learn). A goal typed into Ask is auto-classified into a mission, planned, dispatched to specialist agents that hand structured payloads to each other (A2A), and carried forward with no human re-invocation, pausing only at the approval gates the operator configured. The live DB proves it runs: 31 missions (27 completed), 37 agent runs (32 in missions, 30 completed), 22 handoff messages all consumed, about 490K tokens through one governed chokepoint. RLS on all 111 tables, prompt-injection hardening, a cross-tenant credential guard. The bi-temporal decision/supersession graph is real, tested IP. Most competitors are "co-pilot, not autopilot"; Cadence built the action system they describe in slides.
- **What is the real problem:** the moat is wired but **cold**. Zero outcome memories, zero supersession edges, one learning. The supersession flag is ON in production but the flywheel has never turned (only about two outcomes ever recorded). The loop does not close on real data (Sense is webhook-only with zero connectors bound; Learn's outcome reviews barely exercised). And the demo seed writes no lineage edges, so the provenance, memory, and trust panels **render empty** in any demo. That empty render is the single thing most likely to make an investor conclude "bits and pieces" while sitting in front of a built engine. The core-user research confirms it: **not a design problem, a proof and trust-timing problem.**

**The three-pillar moat (each corroborated by the founder's reference images and the independent PM-AI literature):**
1. **Own the loop** (an AI operating system that collects context, decides, acts, keeps the log; not an AI feature, not a chatbot). Verified real.
2. **Sense continuously** (self-initiating autonomy at every phase, from live signals; the dormant push-half of the engine). Scaffolded, must be lit.
3. **Keep the receipts** (the Trust Ledger: what changed, why, on what evidence, who approved, and was it later proven right or superseded; trust is the thing people pay for). Built in schema, must become the hero.

**The build doctrine for the pitch window (15 to 20 days):** do not add surface area (that is what makes it *feel* fragmented). **Light up and fuel the engine you already built, then make the Trust Ledger the hero, then stitch and design it to consumer-grade.** The journey is build → stitch → wire → design → ship, and the rich showcase content comes last (founder ruling). The v11 build front is ranked #1-18 in the dashboard, capabilities-first.

**One sentence for the pitch:** *Cadence is the decision and outcome operating system for product teams: it senses what is happening, decides what is worth building, executes the work autonomously, keeps a trustworthy record of every call and whether it was right, and gets smarter about your product with every outcome, in the one layer frontier models and single-suite incumbents structurally will not own.*

---

## 2. Ground truth: what is built vs what the docs claim

Every claim here is grounded in a read of the code and the live Supabase database, not the documentation's self-report.

### 2.1 Genuinely real (verified)
- **The autonomous engine is wired end-to-end.** The `pg_cron` `resume-runs` job (every minute) drives `advanceMissionCore` (a deterministic, model-free DAG reflector: reflect child status, dispatch ready steps cap 10/tick, skip-cascade failures, finalize). Stations are real and ordered (`agent-vocabulary.ts`: Sense/Decide/Define/Build/Ship/Learn + crew). A2A handoff is a typed payload (task/context/artifacts/memory_refs/evidence), claimed compare-and-set, injected into the receiver's prompt. The loop runs from Ask, Today/Missions buttons, and the cron. Approval modes (`auto`/`confirm`/`review`) compose with an earned autonomy arc under non-overridable safety floors (merge always `review`).
- **The live app** is at `cadence-flow-beta.lovable.app`, branded ("AGENTS EXECUTE · YOU GOVERN"), with real seed/founder usage (about 90 to 103 visitors/month, mostly direct, India + US), 490K tokens logged, missions completing end-to-end.
- **The decision-graph IP** (`supersession.ts`, `governing-decision.ts`, `artifact_lineage`) is bi-temporal, invalidate-don't-delete, multi-hop to the current governing decision (16-hop cap, cycle-guarded, confidence-tiered); the headline query "given this precedent, what is the current belief, not the similar old one" is something flat RAG cannot answer, and the code answers it correctly. 25 test files in `src/lib/ai/`. The four-lens Critic fuses precedent + contradiction + governing-decision + shared-premise.
- **Security** is strong: RLS on all 111 tables, service-role-only secret vaults, `<untrusted_tool_output>` injection hardening, a cross-tenant credential guard.

### 2.2 Cold, empty, or missing (the real problem)
- **The moat is empty.** `agent_memory` 23 rows all reflections, zero outcome; `artifact_lineage` 20 rows all derivation, zero supersedes/contradicts; `learnings` 1. The supersession flag is ON in prod but produced zero edges (only about two outcomes ever recorded). The whole Decision-Brain layer was committed 2026-06-20 to 22: new, tested, armed, unproven.
- **The loop does not close on real data.** Sense is webhook-only, `connections` = 0. Learn's outcome reviews barely exercised.
- **The ambient path is cold.** `event_queue` = 1 row.
- **The demo renders empty.** No lineage edges seeded; the moat panels are blank.
- **Most agentic plumbing is commoditizing.** The loop shape, registry, chokepoint, approval queue, even the Critic prompt (minus graph retrieval) are weekend-replicable with a frontier model.

### 2.3 Strategy-doc drift (the `POS-V11` reconciliation)
The role map names v7 as the positioning arbiter, but newer docs rewrote the thesis without updating it. v11 resolves: **the moat is the decision-and-outcome layer (own the loop, sense, keep the receipts); memory is one component, not the headline.** Persona drift (7 vs 2 vs 1) resolves to one front-of-funnel persona (§5). v7's "ambient + governed, NOT autonomous" vs v9's "say the autonomous loop out loud" resolves via §3 (autonomy is real and self-initiating, governed by reversibility). Dated specifics (Claude 3.5, GPT-4o, Gemini 1.5, `pgsodium`) get refreshed. The cascade (README, AGENTS §0, moat.md) is part of `POS-V11`.

---

## 3. The corrected North Star: ambient, self-initiating autonomy at every phase

**Founder steer (2026-06-23):** the system should not need a PM to *initiate*. In an agentic world it should sense the market and signals from many channels and **self-originate work at every phase**, running autonomously, with humans only where genuinely needed.

This upgrades the North Star from *pull-based* autonomy (a human pulls the trigger) to *push-based / ambient* autonomy (signals push work in, agents triage and act, at every station). The good news: the ambient layer is the **dormant half of the engine that is already scaffolded** (the `event_subscriptions` / `event_queue` reactor, the Sense station, a Reactor crew agent), simply un-fed and un-lit.

**The target: the self-driving product organization.**
```
CONTINUOUS SENSING        SELF-INITIATION              GOVERNED EXECUTION        ACCOUNTABILITY
(push, always on)         (policy-triggered)           (autonomous, reversible)  (the receipts)
support / analytics /     threshold crossed -> DECIDE   plan -> dispatch ->       what changed / why /
CRM / sales calls /  -->  outcome recorded -> LEARN -->  handoff -> advance  -->   evidence / who approved /
reviews / market          competitor move -> CRITIC      (cron) -> finalize        was-it-right / superseded
                                                              ^
                                                         HITL only at irreversible
                                                         boundaries (merge/deploy/spend/publish)
```
Every station can be triggered by an upstream event, not only a human handoff. Governed by reversibility: act autonomously on reversible work; gate only at irreversible boundaries. The elegant synthesis: the more autonomous the system becomes, the more the Trust Ledger matters; accountability is what makes ambient autonomy *sellable*. Build items: `EVENT-REACTOR-LIVE`, `AMBIENT-SENSE`, `AMBIENT-TRIGGER` (#2-4).

---

## 4. The agent operating model (where agents live, how they are triggered, how they are reached)

The founder's question: "we say a native AI agent ecosystem that acts autonomously, but where does this get utilized, how is it triggered, does it happen automatically?" This section makes the agent ecosystem legible. It was asserted but not made explicit; that is itself a gap (`STITCH-LOOP` + this doc fix it).

**Where the agents live (the roster, by station).** Sense, Decide, Define, Build, Ship, Learn, plus Reactor and Archivist crew (`agent-vocabulary.ts`). The "5 agents" a user sees (Scout/Strategist/Critic/Scribe/Chief of Staff) are a display relabel of the internal slugs; the "19-agent mesh" is a map, not all wired. Specialists are PM-domain-specific and the roster is intentionally small.

**Where each is utilized (the surface).** Today (the approval queue + brief), Ask (type a goal -> a mission), Product (signals -> opportunities -> roadmap), PRD (Critic + AI assist), Build/Missions (the DAG executing), Brain (the memory + decisions the agents read/write), Engine Room (the governance the operator uses to watch and tune them).

**How each is triggered (three modes):**
1. **Human-initiated (pull):** a goal in Ask, a button on Today/Missions, a "request AI assist" in a PRD. Wired today.
2. **System-continued (auto):** the `resume-runs` cron advances any running mission every minute with no human. Wired today.
3. **Ambient (push, self-initiated):** a signal cluster, a recorded outcome, a competitor move, or a brain-derived insight crosses a threshold and self-originates a mission at the right station. Scaffolded, lit by `EVENT-REACTOR-LIVE` + `AMBIENT-SENSE` + `AMBIENT-TRIGGER`. This is the North Star (§3).

**How agents and platforms reach Cadence (inbound interop, `INTEROP-V11`).** An agentic platform must be reachable *by* others, not just reach out. Three doors, all scope-gated and audited: (a) a **read-only MCP server** so external agents (Claude, ChatGPT, Cursor) can query the decision brain, specs, and roadmap (buildable now, on the `mcp_tokens` infra + A2A card); (b) **A2A Agent Cards + scoped tokens** so peer agents can call governed actions; (c) a **scoped API** for platforms. The outward *write* surface (`Q2`) is founder-gated on the scopes/audit posture. This is also a platform/moat play: Cadence as the governed layer other agents plug into.

**How Cadence reaches the world (outbound).** Inbound signal via connectors (`CONNECTORS-V11`, §14); execution via orchestrate-the-builders (§13). Two directions, one governed system.

---

## 5. Positioning (repositioned)

**Category:** the decision and outcome operating system for product teams. Internally the "Agentic Product OS"; publicly lead with the felt outcome.

**One-sentence positioning (see §1).**

**What Cadence is NOT (straight from the founder's reference images):** not an **AI feature** added to an app (drafts, waits, copyable); not a **chatbot** that hands back text and leaves the work yours; not a **codegen tool** competing with Lovable/Cursor/Devin (it sits one layer above and orchestrates them).

**The persona ladder (resolves 7-vs-2-vs-1):** front of funnel = the individual PM / founding PM (entry via the Critic teardown, self-serve, viral); expansion = the product team (the decision system of record, governance, the >$150/team/month price); buyer = VP/Head of Product for the team motion; later = the org (extended stakeholders, §17). "We are for everyone" is what pre-PMF companies say; we narrow to one.

**The wedge:** the Critic teardown ("point Cadence at your pet feature, get an evidence-backed red-team in ten minutes"). The cheapest, most viral, single-player entry, and already real in code.

---

## 6. The core user: how it actually feels, the pains, and the future

The founder's correction: the most important stakeholder is the **daily power user** of the platform, the one every other stakeholder depends on. Two parallel research passes (felt experience; pains + the future of the role) ground this section.

### 6.1 The felt experience (the trust-timing problem)
**Cadence does not have a design problem; it has a PROOF problem and a TRUST-TIMING problem.** The bones are genuinely better than most PM tools ship (the DecisionCard, the Critic teardown, the consequence-first gates, the calm shell). But the product asks the PM to govern a machine before showing them anything worth trusting, and its most differentiated surfaces render empty on the accounts a new PM judges it on. It would win a 10-minute demo and quietly lose the PM by week two.
- **First-run aha is real** (the Critic teardown, under 10 minutes, zero setup), but the path immediately after is downhill: data plumbing, then a jargon wall (missions/stations/Engine Room), then empty proof-panels.
- **The daily loop's risk is the babysitting tax:** the approval queue fills with low-level tool-call gates ("Scout wants web_fetch"), which is intern-supervision, not leverage. The cost curve is backwards: governance work front-loaded, trust payoff deferred.
- **The dominant negative emotion is deflation:** "What changed", memory, provenance, mission compounding all render empty on cold/seeded accounts. The product keeps gesturing at an intelligence the user cannot see.
- **The fixes** (build items `CORE-UX-TRUST`, `CORE-UX-FELT`, `STITCH-LOOP`, plus the seed): per-agent track record on the decision itself, auto-clear reversible gates (only ever ask about consequential ones), visible rejection-learning, a chief-of-staff brief with stakes (not counts), de-jargon the front for the non-founder PM, harden the teardown's cold path, and stitch the surfaces into one continuous loop.

### 6.2 The pains (what PMs most wish were autonomous)
Grounded in the 2025 State of B2B PM survey and the Productboard AI report. PMs are buried in the low-judgment half of the job and starved of the high-judgment half. Top pains: writing PRDs/tickets (the documentation tax), status updates scattered across tools, deck-building for leadership, chasing/synthesizing data across 15+ tools, context-switching, stakeholder alignment, prioritization debates, meeting overload, pseudo-PM work.
- **Autonomously solvable now:** status updates, first-draft PRDs, feedback triage/clustering, task breakdown, deck assembly. **Soon:** continuous discovery, autonomous build (has a fast oracle), roadmap re-ranking, decision defense. **Human judgment (the moat):** the prioritization *call* / saying no, taste, stakeholder politics, owning the consequence.
- **The asymmetry the market confirms:** autonomy where truth is checkable (build/QA/ship), governance where it is not (decide).
- **The emotional/career pains, under-served and high-leverage:** fear of the wrong call with no evidence to defend it; being seen as a "ticket writer" not a strategist (the survey's #1 org problem: delivery over strategy, 49%); the anxiety of outcomes they cannot prove (only 40% measure outcomes); and **decision amnesia** (the org forgets why it decided things) which validates the receipts pillar more directly than anything else found.

### 6.3 The future of the role (build for 2028, not 2026)
The 2026 PM-AI literature converges with unusual precision on Cadence's exact thesis: execution commoditizes, judgment becomes the whole job, the PM becomes an orchestrator of agent fleets, smaller teams ship more, the eng/PM/design boundary blurs, discovery and delivery run continuously in one loop, and the durable moat is the org-specific, compounding record of decisions, evidence, and outcomes. The threat is not extinction but polarization: the translator/ticket-writer PM is at risk, the judgment/taste/domain PM is more valuable. **Build for the PM who survives, not the one who is automated:** elevate them into orchestrator and judge work; a tool that just does grunt work faster accelerates the user's own obsolescence.

### 6.4 The new opportunities this surfaced (now on the board)
- **`PM-IMPACT-LEDGER`** (the strongest un-named opportunity): the individual PM's portable record of the calls they made and the outcomes they drove, for performance reviews and their next role. Turns the receipts pillar into a career asset, a retention and virality hook, and salves the top career pain.
- **`STAKEHOLDER-PACK`:** audience-tuned alignment/persuasion artifacts from a decision + its receipts (attacks the deck-building pain and the influence gap at once). Cadence produces evidence; this helps the PM win the room.
- **`EVALS-PRIMITIVE`** (future-of-PM, post-pitch): evaluations as a first-class PM primitive, "the defining skill" of the 2028 PM; elevate the existing eval surface.
- **`AGENT-FLEET-VIEW`** (future-of-PM, post-pitch): the air-traffic-control surface where the PM defines intent, dispatches a fleet, and supervises by exception.
- **Survival warning the market flags:** hollow autonomy is *the* way agentic products die in this exact market. Claim-never-outruns-wiring is not internal discipline; it is survival.

---

## 7. The Brain (the decision/memory graph, made useful, and made to act)

The founder asked: how is all this information shown graphically, what useful decisions are derived, how is it useful to me ("how it was done the past three months"), do we build the memory/graph/vector layer or integrate one. Three parts.

### 7.1 The Brain UX: the four lenses are the floor, not the ceiling (`BRAIN-UX-V11`)
A raw node graph is how the *agent* sees it, not how a PM derives value. The floor is four human lenses on the same data: a **temporal/narrative** view ("how your decisions evolved the past 3 months, what superseded what, what landed"), **proactive insight + patterns**, a **plain-language** answer ("why did we decide X / what is the current belief / what is unresolved"), and the **compounding story** ("what Cadence has learned about your product since you started").

But the founder's steer (2026-06-23) is to keep horizons wide: the lenses are the floor; the **open ceiling** is the agent *volunteering whatever useful intelligence the data supports*, flagged proactively, because that is the whole point of putting intelligence on the graph. Examples: predictions ("this bet is likely to miss based on your patterns"), contradiction/risk alerts ("this contradicts a still-governing precedent"), next-best-action ("three unresolved decisions block the roadmap; resolve X first"), self-knowledge ("your team underestimates infra work"), cost-of-inaction ("you deferred this twice; here is the cost"), and hidden connections ("these three features share a premise that already failed"). The Brain is an analyst that volunteers insight, not a set of static views.

### 7.2 The Brain must drive action, not just be read (the discover -> derive -> act loop)
The second founder steer (2026-06-23): the Brain should not be only useful content for the human and the agent to *read*; the agent must **take action** out of what it discovers. The Brain is a closed loop: **discover** (a pattern, contradiction, or signal in the graph) -> **derive** (what it means) -> **act** (re-open a decision, propose a step, self-initiate a mission). So `BRAIN-UX-V11` (discover/derive) and `AMBIENT-TRIGGER` (act) are one loop, and the Brain's derived intelligence is itself a trigger source. This is the platform capability, not a read surface.

### 7.3 The infrastructure verdict (build the intelligence, self-host the substrate, integrate only the viz)
- **BUILD in-house, forever:** the ontology, the supersession engine, the Critic, the salience ranker. This is the moat. Never rent the brain's reasoning to a memory-as-a-service (Mem0/Zep); that turns the moat into a wrapper around someone else's product.
- **SELF-HOST the substrate:** Postgres + pgvector (you own the data, no per-token graph bill). The founder's instinct ("build it ourselves like Obsidian") is right for the substrate and the local-graph metaphor.
- **INTEGRATE only:** a visualization library for the Obsidian-style view (do not build a render engine); and, much later, a graph engine (Graphiti/Neo4j) behind a `GraphStore` seam **only if** traversal at scale outgrows Postgres recursive CTEs (it has not). Embeddings and inference are BUY via the chokepoint. This matches the existing [build-buy-integrate.md](./build-buy-integrate.md) canon.

---

## 8. The moat: three pillars and the deeper asymmetries

The three pillars (§1) over a set of structural asymmetries:
1. **No fast oracle.** Code commoditized because it has a fast oracle (compiles/passes in seconds). "What to build" has none (feedback takes weeks to quarters). The thing the labs are best at is the thing this domain has least of; the decision layer does not commoditize like codegen.
2. **The labs decline the vertical.** They ship the substrate (personal memory, search, connectors, computer-use) and are walking away from accountability (OpenAI is removing its memory audit trail; Google killed Project Mariner; OpenAI retired Operator). Team-shared, permissioned, auditable product-decision state is a different data model they show no intent to build.
3. **Single-suite incumbents cannot be neutral.** Atlassian will never read Linear and Figma and decide *against* Jira. The neutral cross-tool decision layer is a seat only an independent can hold. Their 150B-object graph answers "what is connected," not "what did we decide and was it right."
4. **The outcome ledger cannot be backfilled.** A competitor with all your raw data cannot reconstruct decision-to-evidence-to-outcome-to-was-it-right accrued over calendar time.
5. **It is an NRR-expansion engine.** Compounding memory, rising switching cost, seats-plus-credits expansion separate 120%+ system-of-record retention from the roughly 48% median of AI wrappers; that retention spread is the valuation case.

**The honest caveat:** the asymmetries are structural, but the *accrued* moat is empty today and compounds over calendar time. The investment is in the mechanism and the team's execution, plus a credible plan to fill the ledger. That honesty is an asset in diligence.

---

## 9. The villain and the defense

The founder asked to play the villain who wants to kill Cadence, then mount the strongest defense, then show the action that makes the defense true.

**The villains (five masks, real numbers).** (1) The Frontier Lab CTO: "you are a `{thought,action}` JSON loop with a 6-step cap; your moat is 23 memory rows; the rising tide reaches your floor." (2) The Incumbent: "we own the workspace, the data, the distribution, and bundle AI free; you have 8 workspaces and 90 visitors; we ship 'decision tracking' next quarter." (3) The Seed Investor: "AI-PM is a graveyard (Kraftful, Cycle, Zeda, Reforge in 18 months); your moat is a promise about data that does not exist; your docs contradict each other; acqui-hire at best." (4) The churned Head of Product: "it generated a PRD I rewrote, ran busywork I did not trust, the memory panel was empty, and 'you govern' means I babysit an intern and do my own job." (5) The Build Realist: "ticket-to-PR is Lovable's/Cursor's slide, not yours."

**The defense doctrine (one sentence):** Cadence is not selling the current *size* of the moat; it is selling the only architecture that can *accrue* it, a wired action system that owns the product-decision loop, and a trust ledger that makes every autonomous act accountable, in the one vertical the labs decline and single-suite incumbents cannot neutrally own.

**Per villain (with the action that makes it true):** (1) the model is the engine, nobody sells the engine as the car; the product is the governed, accountable system, and the labs are walking *away* from accountability; stay model-agnostic and make the Trust Ledger the hero. (2) their graph is *context* not *decision*; a single suite cannot be neutral; win beside Jira via the wedge, not by ripping it out. (3) the graveyard is the proof (the casualties were narrow slices; the full-lifecycle SoR slot is empty); pitch the flywheel turning on real data and the NRR contrast; reconcile the doc drift. (4) reframe: the agent does the 214-job-posts of PM work and hands you a *decision* pre-loaded with evidence and precedent; the churn was the empty demo, fixable with the seed and the Trust Ledger. (5) conceded; orchestrate the builders, do not become one.

**The defense gap is the build plan.** Three of five defenses are true only if something is built, and four of those are activation and visibility, not new construction. That gap is the 15-to-20-day plan (§21). **Full version (each villain's complete attack + the complete defense + the build item that earns it): Appendix A1.**

---

## 10. Market: TAM, SAM, SOM

Flags: [V] verified, [E] estimated, [A] assumption. **Bottom-up TAM:** about 1.8M addressable PM seats [A] x about $550/seat/year [A] = about **$1.0B direct PM-seat TAM** [E] (lead with this honest number; the expansion is the buyer growing beyond the PM to about $3-5B [E], and credits-not-seats scaling revenue with decision throughput not headcount). **Top-down:** PM software about **$8.4B (2025) at about 12% CAGR** [V], cluster consensus 10-14% [V]; the work-management envelope it raids is about **$45-55B** [E]. **SAM** (AI-forward B2B product teams): about **$2.5-3.5B** [E]. **SOM** (3-year seed entrant): about **$15-40M ARR** by Year 3 [E], modeled on the Notion SoR curve ($13M->$31M->$67M, 2020-22 [V]), not the vibe-coding curve. Sources are in §25.

---

## 11. Business model, pricing, margin, comparables

**Pricing (price the layer, meter the throughput).** Free (the wedge + limited decaying memory) -> **Pro about $39-49/seat/month** (persistent + cross-workspace memory, Critic everywhere, the outcome loop) -> **Team lands above $150/team/month** (about $45-59/seat x 4-5 seats; org-scoped SoR, governance/audit, shared compounding memory; account-level credit pooling, not per-workspace) -> Enterprise (negotiated; SSO/audit/residency; BYOK and BYO-coding-agent-key as negotiated options; outcome-based pricing pilots). Do **not** price autonomy per seat (you shrink as PMs are automated); price decision *work* (credits) so revenue grows as decisioning gets cheaper and volume expands. Beat "Jira already includes AI": different layer not a better feature; no fast oracle so it does not commoditize; the outcome ledger cannot be backfilled; reframe the buyer's question ("what does it cost to make the wrong bet for a quarter?").

**Margin.** Agentic workloads are 5-30x more token-intensive than chat, so model **45-60% blended gross margin** [V-anchored], not 75%+. Levers: small-model routing (the patterned 80% cheap, frontier for the novel 20%), aggressive caching, grant-sizing, capped top-ups. BYOK is an **enterprise-only** escape valve, not a self-serve margin strategy (keep model-agnostic routing on your keys as the real lever).

**Unit economics that must be true:** GM at least 55-60% at scale; **NRR at least 120%** (AI-wrapper median is about 48%; a 15-point NRR spread is roughly a 5x valuation spread); GRR at least 85-90%; CAC payback under 15 months. The proof metric: outcome-accuracy-lift per account rising as memory grows (the `MOAT-METRIC`).

**Comparables (two axes).** Category axis (what Cadence is): the $1-1.7B PM/work-record tier (Linear about $1.25B [V], Productboard about $1.7B 2022 [E], Notion's early arc [V]); the Reforge-to-Miro and Maze trajectories prove a strategic-acquisition floor. AI-premium axis (what it could trade at): borrow the *multiple environment* (Lovable $6.6B at about 33x, Cursor $29.3B at about 15x [V]), not the tier. Deck sentence: "we are not the next Cursor; we are the decision layer that sits above every Cursor."

---

## 12. The Playbook Registry (the embed-skills verdict)

**The founder's hypothesis:** embed the large Claude-Code library of PM-specific skills/agents/MCP/prompts into the product for built-in intelligence. **Verdict: strong YES on the idea, NO on the literal framing.** Embedding skill markdown verbatim is cosmetic (any frontier model recites generic PM method). The defensible version is a **Cadence Playbook Registry** that does for *every* station what the Critic already does: bind opinionated PM method to live workspace decision-memory and per-outcome learning.

**The exact line:** method text is commodity; **method x (decision graph + outcome memory + approval history + per-workspace playbook-performance ranking) is the moat.** A playbook the system has run 40 times in *your* workspace, learned which variant correlates with validated outcomes, and applies with your precedents pre-loaded, is institutional judgment as software.

**The pitch line:** "Cadence ships with institutional product judgment as software, a library of expert PM playbooks the agents apply autonomously, and it compounds twice: smarter per workspace as it learns your decisions, and smarter per outcome as it learns which judgment worked." **Architecture:** a versioned `Playbook { slug, station, version, method, rubric, requiredInputs, outputContract, bindMemory }` in `src/lib/ai/playbooks/registry.server.ts`; `bindMemory` reuses the Critic's four memory loaders generalized into `bindWorkspaceContext(station, focusIds)`; a `playbook_runs` table ranks playbooks by validated-outcome rate. **Timing:** pitch-narrative pillar now (the Critic is the live proof), thin slice post-pitch, library grown slowly. Build item `PLAYBOOK-REGISTRY`.

---

## 13. Orchestrate the builders (mechanics, BBI, and B2B economics)

The founder's questions: if we do not build codegen, how do we pass work to Cursor or an equivalent, what does it cost and license at B2B scale, what is the cost-efficiency model, and how does it consolidate into our credits. This is build/buy/integrate beyond just coding agents.

**The mechanics (verified).** Four of six candidates expose a genuine programmatic/headless dispatch path: **Devin** (REST `POST /v3/.../sessions` with a built-in `max_acu_limit` cap and PR-as-result), **Claude Agent SDK / Codex SDK** (headless/CLI, API-key-metered, you drive the loop), **Cursor Cloud Agents API** (service-account keys exist, so it *does* fit programmatic dispatch, but the ToS for third-party orchestration is unverified), and **OpenHands** (self-host, $0 external license, BYO-LLM). v0 is niche (text-to-UI). The seat-license trap dissolves if you dispatch through the cloud/SDK/self-host surface, not the editor. Cadence already has the exact seams: `DelegateProvider` (BLD-04, dormant) and `ExecProvider` (SANDBOX, the $0 GitHub-Actions CI floor that decides if the result may merge).

**The recommended architecture.** OpenHands self-host as the **$0 floor** (cost flows through your existing AI-credit chokepoint) -> **Devin** and **Claude Agent SDK** as the two premium adapters behind the same interface -> Codex -> Cursor (BYO-key only until ToS cleared) -> v0 (niche). Governance is where the moat lives: **human-approves-before-dispatch** (a `review`-mode tool), the external agent returns a **PR that cannot bypass your merge gate**, and the result folds back as a mission step with full trace.

**Credit consolidation and economics.** Meter external compute as Cadence credits, two postures: **(A) passthrough + markup** (a credit pre-authorization holds, then debits actual cost; OpenHands floor is highest-margin since it is just your marked-up LLM/compute; premium providers convert ACU/token cost at a 1.3-1.6x markup [E], always capped per task via `max_acu_limit` or a token budget). **(B) enterprise BYO-coding-agent-key** (mirrors BYOK; the customer binds their own Devin/Cursor/Codex contract via the existing `resolveProviderAuth` chain; the heaviest, spikiest compute is billed to *their* account, removing your COGS and resolving the Cursor ToS and data-residency objections at once). **Net business model: price the orchestration + governance + decision-memory (near-software margins), meter the compute, cap every task, BYO-key to enterprise.** The expensive variable thing is either capped-and-marked-up or pushed to the customer's key; the thing Cadence sells has software margins.

---

## 14. Consumer-grade: IA, the design layer, the landing page, connectors

**Consumer-grade defined (founder, 2026-06-23):** not just look and feel, but the features, the capability, the solution, and the pain point it solves. The whole platform must clear this bar.

### 14.1 The IA reality and my recommendation
The route layer is already consolidated (about 24 redirect stubs fold into 6 real surfaces). The "too complicated" feeling is **felt density and four competing nav metaphors at once**, a 13-tab Engine Room, and an 11-tab Settings with no grouping. The app violates its own engine-room doctrine in fixable ways. This is a tightening job, not a rebuild.

**My recommended IA (not just relaying the audit; this is the call).** Left nav = **five calm, outcome-named destinations + one recessed Engine Room door**:
- **Today** (what needs me), **Ask** (ask the brain anything), **Product** (signals to specs to roadmap to releases), **Build** (autonomous build sessions; Missions folds in here), **Brain** (memory, decisions, the analyst, docs). Then **Engine Room** recessed at the bottom (one door, the approvals badge on it). Kill the "Loop" and "Trust" mechanism-labels, delete the floating Calendar dock (Calendar lives in Brain), demote the Products list into the workspace switcher (a product is a *filter*, not a destination), and lean on the ⌘K palette (already built, already indexes the deep surfaces) for everything else. Engine Room's 13 tabs group into three bands: **Needs you** (Approvals, Spend), **Trust and safety** (Controls, Safety, Team, Incidents, Attention), **Quality and insight** (Quality checks, Prompts, Analytics, Activity, Trends, Loop health). Build items `IA-NAV-V11` (#11), `IA-DEPTH-V11`.
- **One home per artifact.** The same content rendering in several forms across the platform (Calendar, Approvals/Spend in multiple places) is the duplicate-homes violation; one canonical home each, the rest reach via ⌘K.

### 14.2 Settings (the most overloaded surface) -> five groups (`SETTINGS-SEGREGATE`, #12)
From 11 flat tabs to **Account** (Profile, Notifications) · **Workspace** (the Strategic Brief, Voice Anchor, Members, the agent roster) · **Connections** (one home for Accounts/Integrations/`/sync`, killing the three-places confusion) · **AI and keys** (default model + BYO keys) · **Billing** (Plan + Credits), with **Advanced** (Health, Data/compliance) recessed. **Promote the Strategic Brief out of Settings**: it is injected into every agent's prompt (a steering wheel), yet buried as tab 4; surface it on Today/Brain with Settings holding only the edit form.

### 14.3 The landing page (`LANDING-PAGE-V11`)
The founder's verdict: the current landing page is cluttered and does not communicate what Cadence is. The refinement: **not a dump of whatever we build; only what a visiting PM actually wants to see**, researched against how the best platforms do it, designed from the user's lens. My recommended content, in order:
1. **Hero = the outcome, one line:** "Cadence senses what is happening, decides what is worth building, runs the work autonomously, and keeps the receipts." A single calm visual of the loop running (not a feature grid).
2. **The one contrast that lands:** AI feature/chatbot (drafts, waits) vs AI operating system/action system (owns the loop, the work is done). This is the founder's reference-image insight and it is the clearest way to say what Cadence is.
3. **Proof, not claims:** the live loop, the Trust Ledger (what changed/why/evidence/who/was-it-right), one believable artifact. Trust is the thing people pay for, so show it.
4. **One CTA:** the Critic teardown ("point Cadence at your pet feature, see why it might be wrong, in 10 minutes"). One door, not five.
5. **Who it is for + the durable promise:** the PM who wants to be a judge and orchestrator, not a ticket-writer; the platform that compounds your decisions into a moat no model can backfill.
Strip everything else. The landing page is **sequenced after the capabilities it showcases** (it is #18-ish, after the v11 build front), per the logical-sequencing principle (§21).

### 14.4 Connectors (`CONNECTORS-V11`)
The loop needs real input from **day one** or it works in a silo. Today connectors are scattered across three places and presented repetitively (the duplicate-homes problem again). Consolidate into one Connections home, present the available sources cleanly (de-dup the repetitive lists, and audit *why* each of the six-plus is really required against the product's scope), and make at least one source bind-able on day one. The connector *platform* (`F-CONN`) and a second live source (`SEN-01`) are founder-gated on an OAuth registration; the consolidation and day-one-readiness layer is ours.

---

## 15. Scope: reuse, reposition, club, flag (the honest opinion)

The founder's instruction: do not trim blindly; give an honest outsider opinion on what is built but mis-placed, where we can re-use it, where it should be re-positioned or clubbed, and flag only what genuinely is not earning its place, with reasoning, for the founder's call.
- **Reuse (built, valuable, just under-surfaced):** the Strategic Brief (steering wheel buried in Settings -> promote to Today/Brain); the ⌘K palette (the correct progressive-disclosure escape hatch -> lean on it instead of duplicating nav); the DecisionCard and consequence-first gates (the best-designed components -> extend with track record); the credit/billing engine (built + gate-green, dormant -> the founder's go-live config only).
- **Reposition:** Missions (its own top-level item -> fold into Build, it is the same felt thing); the connectors (three places -> one home); the public-share routes (`d.$slug`/`t.$slug` -> reuse as the Trust Ledger share).
- **Club / merge:** the 13 Engine Room tabs -> three bands; Plan + Credits -> one Billing parent; Accounts/Integrations/sync -> one Connections.
- **Flag for the founder's call (built but barely earning its place today):** the drift surface (`drift_incidents` = 0 live), prototypes (`prototypes` = 0), studio_changesets (= 0) and the lightly-used evals are present in schema but unexercised; the Command Canvas (H2) is parked; the BYO repo lane is gated and early; audio features and the showcase/onboarding-concierge are deferred. My honest read: none of these should be *deleted* (they are cheap to keep and several are future bets), but they should be **recessed** (out of the front, into the Engine Room or behind ⌘K) and **not invested in** until the core loop is proven, so they stop adding to the felt density. The one genuine "do not build now" is anything that adds front-of-house surface area before the loop closes on real data.

---

## 16. Missing capabilities and adjacent markets

**Missing capabilities (now on the board, grouped by the loop):** Sense (`CONNECTORS-V11`, `AMBIENT-SENSE`, `SEN-01`); Decide/self-initiate (`AMBIENT-TRIGGER`, `EVENT-REACTOR-LIVE`); Learn/fill-the-moat (`LOOP-PROVE`, and the built-but-cold `LRN-02`/`W1-AUTO`/`MOAT-METRIC`); Trust (`TRUST-LEDGER`, `TRUST-SHARE`); Brain (`BRAIN-UX-V11`); Build-as-orchestration (`ORCH-DELEGATE`); Interop (`INTEROP-V11`); the career/stakeholder gaps (`PM-IMPACT-LEDGER`, `STAKEHOLDER-PACK`); the consumer-grade layer (`IA-NAV-V11`, `SETTINGS-SEGREGATE`, `IA-DEPTH-V11`, `LANDING-PAGE-V11`); the narrative (`POS-V11`); the capability (`PLAYBOOK-REGISTRY`).

**Adjacent markets / horizon bets (parked, not scheduled):** the decision OS beyond PM (any team making consequential, no-fast-oracle decisions; regulated/compliance buyers, for whom provenance is a purchase requirement); signal-intelligence as a product (the ambient layer pointed at the market); the Playbook marketplace (expert-authored, outcome-ranked playbooks as a network effect); and the A2A governance platform (Cadence as the governed layer other agents plug into, monetizing the Trust Ledger and orchestration).

---

## 17. Extended stakeholders
The decision and outcome record is naturally consumed beyond the PM: sales/marketing/GTM get the "why we are building this" narrative and launch kits; leadership gets a portfolio-of-decisions-and-outcomes view (a second buyer and the enterprise expansion). The principle: do not build new systems for them; *project* the existing decision and outcome record into their language (`STAKEHOLDER-VIEWS`, post-pitch).

---

## 18. PMF and founder-market fit
**PMF: pre-PMF, honestly.** Founder-and-seed usage, an unproven wedge, a moat that has not begun to compound. The Critic teardown is the PMF probe; the metric is single-player retention and the teardown share rate. **FMF: genuinely strong.** An AI-native founder building a sophisticated governed multi-agent system largely solo, dogfooding the autonomous build process (the product is built the way the product says product should be built), with build-in-public as live evidence. The founder is both the target user and the proof case.

---

## 19. Risk register
| Risk | Severity | Mitigation / build item |
| --- | --- | --- |
| No distribution | High | The viral wedge (`WEDGE`, `TRUST-SHARE`); cross-tool neutrality; adopt beside incumbents |
| The moat is empty | High | Close the loop + seed it (`LOOP-PROVE`, `TEST-SEED`, then the built `LRN-02`/`W1-AUTO`/`MOAT-METRIC`) |
| Frontier-model encroachment | High | Own the vertical schema + cross-tool write-back; make the Trust Ledger the hero; stay model-agnostic |
| Build commoditized | Medium | Orchestrate, do not compete (`ORCH-DELEGATE`, §13) |
| Margin under agentic load | Medium | Routing, caching, grant-sizing, capped top-ups, enterprise BYO-keys |
| Doc drift / narrative | Medium | `POS-V11` reconciliation + the cascade |
| Single-backend + embedder lock-in | Medium | Keep the `GraphStore` + embedder behind seams; Tier-3 |
| Trust / adoption friction | Medium | Beside-not-instead adoption; the Trust Ledger as the PM's own defensibility artifact |
| Consumer-grade not ready | Medium | The IA + design + landing + connectors layer (§14) |
| Hollow-autonomy death (market punishes it) | High | Claim-never-outruns-wiring; fuel the moat before claiming it |

---

## 20. The agentic doctrine (every build deepens autonomy)
1. **Claim never outruns wiring.** Do not say it unless it is wired and demonstrable; this is survival in this market, not just discipline.
2. **Governed by reversibility.** Act on reversible work; gate only at irreversible boundaries.
3. **Sense, decide, act, log, at every phase.** Self-initiation is not a phase-one feature; every station can be triggered.
4. **Memory and outcome compound, or it is not the moat.** Every autonomous action writes to the record; every outcome feeds supersession and playbook ranking.
5. **The Brain drives action, not just reading.** Discover -> derive -> act; the Brain's intelligence is a trigger source.
6. **Accountability scales with autonomy.** The more it does on its own, the more the Trust Ledger records why.
7. **Orchestrate commodities, build the moat.** Buy inference/embeddings via the chokepoint; integrate heavy substrates behind seams; build the decision ontology, supersession, Critic, signal-to-ontology, and outcome-to-memory in-house, forever.
8. **Logical sequencing.** Build the capability, stitch it into the loop, then the surfaces that present it (landing page, rich showcase seed) come after, even within a tier.

---

## 21. The build plan (the journey to consumer-ready)
The plan is not "ship features"; it is **build the capability -> stitch and wire it into one loop -> design it to consumer-grade -> ship it user-ready -> showcase it last.** The ranked items live in the [feature dashboard](../planning/feature-dashboard.md) (each with a Why). The phases:

- **Phase 0, the pitch sprint (Tier 1, #1-18), capabilities-first:** `TEST-SEED` (minimal dev data) -> `EVENT-REACTOR-LIVE` -> `AMBIENT-SENSE` -> `AMBIENT-TRIGGER` (the self-initiating loop) -> `LOOP-PROVE` (the moat fills on real data) -> `TRUST-LEDGER` -> `TRUST-SHARE` -> `BRAIN-UX-V11` (the analyst) -> `STITCH-LOOP` (one continuous loop) -> `CORE-UX-TRUST` -> `CORE-UX-FELT` -> `IA-NAV-V11` -> `SETTINGS-SEGREGATE` -> `CONNECTORS-V11` -> `ORCH-DELEGATE` -> `INTEROP-V11` -> `PLAYBOOK-REGISTRY` -> `PM-IMPACT-LEDGER` -> `STAKEHOLDER-PACK` -> `POS-V11`, then `LANDING-PAGE-V11` (after the capabilities it showcases).
- **Phase 1, design + depth (Tier 2):** `DESIGN-V11` (consumer-grade design relook), `IA-DEPTH-V11` (the deeper IA refinements).
- **Phase 2, future bets (Tier 3):** `EVALS-PRIMITIVE`, `AGENT-FLEET-VIEW`, plus `STAKEHOLDER-VIEWS`.
- **Phase 3, closure (Tier 4, LAST):** `DEMO-SEED-RICH` (the rich external-showcase content) and `SHIP-V11` (QA the full loop, the humanization sweep, performance/accessibility, the go-live config, a final content re-clean before external showcase) + `HUMAN-SWEEP`.

**The rich-seed sequencing (founder ruling).** A minimal `TEST-SEED` early (to build/test the data surfaces); the *rich* showcase seed is **last** (only once the capabilities are built does rich seeding reflect a real product, not a faked one). Showcase/dependent surfaces (landing page, rich seed) sequence after the features they present.

The founder-gated items (need an OAuth/secret/spend/taste call) are `SEN-01`/`F-CONN` (connector OAuth), the external-coding-agent half of `ORCH-DELEGATE` (provider + spend), the outward write half of `INTEROP-V11`/`Q2` (scopes/audit), Stripe go-live, and the design/taste calls. These are marked Gated and surfaced in SOURCE-OF-TRUTH §4.

---

## 22. The pitch
**Narrative arc:** (1) product management has not been reinvented in decades, and AI is collapsing the *build* layer, moving all the value and risk to the *decide* layer. (2) Everyone ships AI features and chatbots that draft and wait; Cadence is an AI operating system that owns the loop and an action system where the work is done. (3) It senses, decides, executes, and keeps the receipts (show the engine running). (4) The moat is the one thing no model and no single-suite incumbent can backfill or neutrally own; trust is the thing people pay for. (5) Here is the flywheel turning on real data, the wedge going viral, the market raiding the about $50B work-management envelope, and the NRR-expansion economics.

**The demo (ordered for impact):** (1) self-initiation (a signal arrives, no one presses go, Cadence senses and opens a decision); (2) the action system (the mission plans, dispatches, hands off, advances to a *decision*, pausing at one gate, the work done); (3) the Critic teardown (the wedge); (4) the Trust Ledger (the closer: what changed, why, evidence, who approved, and the moment it was superseded by a real outcome). The demo depends on the build plan: without the seed, the ambient trigger, and the Trust Ledger, steps 1 and 4 render empty.

---

## 23. Metrics and gates
**Pitch-readiness gate:** the four-step demo runs end-to-end on real (seeded-then-live) data with no empty panels; the decision graph has real supersession edges; one live signal self-initiates a mission; the Trust Ledger renders the full record; the narrative is reconciled. **Leading product metrics:** wedge retention, teardown share rate, outcome-capture rate, supersession-edge growth per workspace, the moat metric (accuracy-lift as memory grows). **Business gates:** first paying team; team-tier NRR toward 120%+; gross margin held 45-60%.

---

## 24. Session inputs and decisions (2026-06-23)
This is the documentation the founder asked for: a record of every input given and every decision made this session, so both can re-reference what was discussed and why. Decisions are also logged in [session-decisions.md](./session-decisions.md).

| # | Founder input | Decision / output |
| --- | --- | --- |
| 1 | Do an honest outsider teardown (market + product); do not just agree; use the full toolset | Ran 5 ground-truth probes + 2 deep dives + a villain/defense pass + 4 core-user/IA/orchestration researches; produced this doc |
| 2 | The product feels fragmented, no end-to-end autonomy | Found the opposite at the engine level (it is wired); the real problem is the cold moat + empty demo + felt density (§2, §6) |
| 3 | Autonomy should not need a human to initiate; self-initiate at every phase | The corrected North Star (§3); `EVENT-REACTOR-LIVE`/`AMBIENT-SENSE`/`AMBIENT-TRIGGER` |
| 4 | Play villain, then defend strongly | §9, and the defense gap becomes the build plan |
| 5 | Should we embed the skills/agents into the product? | Yes as the Playbook Registry, not literal skill-text (§12) |
| 6 | The core user (daily PM) is the most important stakeholder | §6 (felt experience + pains + future); `CORE-UX-*`, `PM-IMPACT-LEDGER`, `STAKEHOLDER-PACK` |
| 7 | No new implementation-plan doc; put build items in the dashboard with top priority | Deleted the separate plan; the v11 front is ranked #1-18 in the dashboard; this doc carries the why |
| 8 | The agent ecosystem: where, how triggered, automatic? Plus inbound access (MCP) | §4 the agent operating model; `INTEROP-V11` |
| 9 | Don't go by my words on IA; form your own opinion; the app is too complex; settings overloaded | §14 (my recommended IA + settings); `IA-NAV-V11`, `SETTINGS-SEGREGATE`, `IA-DEPTH-V11` |
| 10 | How do we pass work to Cursor/equivalent; cost/license at B2B; credit consolidation; BBI beyond coding | §13 (mechanics + economics + BBI); `ORCH-DELEGATE` |
| 11 | Scope-trim is reuse/reposition/club/flag, not blind deletion; honest opinion | §15 |
| 12 | The landing page is bad; think what a visiting PM wants to see, research others | §14.3 (the recommended content); `LANDING-PAGE-V11`, sequenced after the capabilities |
| 13 | Rich demo seeding is LAST, not first; minimal test seed as needed | `DEMO-SEED-RICH` demoted to Tier 4; `TEST-SEED` added at #1 (§21) |
| 14 | Add a one-line Why to dashboard rows | Done for all v11 rows; standing convention for new rows |
| 15 | Logical sequencing: build the feature, then the surface that showcases it | §20.8; landing page + rich seed sequenced last |
| 16 | Cascade the v11 positioning into README/AGENTS/moat | `POS-V11`; moat.md pointed; README + AGENTS §0 updated |
| 17 | The Brain: graphical, interconnections, derived decisions, "past 3 months", build vs integrate the layer | §7 (UX + open-horizon intelligence + drive-action + infra verdict); `BRAIN-UX-V11` |
| 18 | Connectors not fully there; day-one input; de-dup the repetitive presentation | §14.4; `CONNECTORS-V11` |
| 19 | The Brain's intelligence is open-ended (not 4 static lenses) and must DRIVE agent action | §7.1-7.2 (lenses = floor; discover -> derive -> act) |
| 20 | Document everything at depth so we both know what we discussed and why | This section + the whole doc + the decisions log |

---

## 25. Provenance and sources
Produced 2026-06-23 from: 5 ground-truth probes (strategy-doc audit, build-state audit, technical-defensibility audit on code + live DB, live-app inspection, market/competitor map); 2 deep dives (the embed-skills verdict; market sizing + pricing); a villain/defense pass; 4 further researches (core-user felt experience; PM pains + future of PM; consumer-grade IA/settings; orchestration economics + BBI); and 7 founder reference images that independently corroborated the three-pillar moat (AI operating system that owns the loop; action system where the work is done; the coding pipeline to orchestrate not compete; the useful market questions; opportunity signals tagged across 373 companies; and "regulated buyers want proof, trust is the thing people pay for").

Market/pricing sources (flagged [V]/[E]/[A] in §10-11): PM population (llcbuddy, Retail Logistics); market size (datainsightsmarket $8.4B 2025, growthmarketreports, Fortune Business Insights PLM); pricing (Productboard, Atlassian Rovo, Asana, ClickUp, Notion); margin/NRR (saasmag, TechTimes, ICONIQ State of AI 2026, digitalapplied); comparables (Miro/Reforge, Tracxn $81M, TechCrunch Maze $60M, Sacra Linear $1.25B, getlatka Notion, Lovable $6.6B, Cursor $29.3B, Replit $3B). PM-future sources: 2025 State of B2B PM survey, Productboard AI report, Reforge, Lenny's analysis, The Last Product Manager, Marty Cagan/SVPG, Teresa Torres. Orchestration sources: OpenAI Codex SDK, Devin v3 API, Cursor Cloud Agents API, Claude Agent SDK, v0 Platform API, OpenHands. Full URLs are preserved in the 2026-06-23 research threads and should be reproduced in the deck's appendix.

**Related canon:** [v7](./v7-agentic-product-os.md) · [v8](./v8-calm-front-deep-engine.md) · [v9](./v9-decision-wedge-and-build-next.md) · [v10](./v10-master-blueprint.md) · [moat.md](./moat.md) · [build-buy-integrate.md](./build-buy-integrate.md) · [sourcing-map.md](./sourcing-map.md) · [horizon-bets.md](./horizon-bets.md) · [the role map](./README.md) · [feature-dashboard.md](../planning/feature-dashboard.md) · [SOURCE-OF-TRUTH.md](../planning/SOURCE-OF-TRUTH.md).

---

## 26. Appendix: the full research record (the groundwork)

> **Why this appendix exists.** Sections 1-25 are the concise, decision-grade canon. This appendix preserves the FULL analysis behind them, at the depth it was researched, so the founder can prepare a pitch from it and any agent has the complete context. **If a section above feels too short, the full version is here.** Produced 2026-06-23 by parallel specialist agents, each grounded in the code, the live Supabase database, or current web research. Every concise section cross-references its appendix entry ("full version: Appendix A1", etc.).

### A1. The villain and the defense (full version of §9)

The founder asked: play the villain who wants to kill Cadence, give it real teeth, then mount the defense as strongly as it can honestly be made, then show the action that makes the defense true. Five masks, real numbers, followed by the rebuttal and the build item that earns it.

**Villain 1: the Frontier Lab CTO ("you are a system prompt with a logo").** "Let us be precise about what Cadence is. It is a `{thought, action}` JSON loop with a 6-step cap, a brittle regex parser, tool outputs truncated at 2,000 characters, and a 100KB registry of thin REST wrappers. That is 2024 scaffolding. In the next 12 months we ship native long-horizon planning, native memory, native computer-use, and native MCP, and every line of your orchestration becomes a polyfill for something the model does natively and better. Your 'moat' is 23 memory rows, zero outcome edges, and one learnings record. You are not ahead of the frontier; you are a thin app on top of it, and the frontier is a rising tide that reaches your floor."
**Defense.** The model is the engine; nobody sells the engine as the car. The defensible product is everything that makes a raw capability trustworthy and accountable inside a company: approval-by-exception with non-overridable safety floors (verified: merge is always `review`), prompt-injection hardening (`<untrusted_tool_output>`), per-mission cost caps, a replayable chokepoint log, and above all the Trust Ledger. The killer fact: the labs are walking the OTHER way. OpenAI is removing memory's audit trail; Google killed Project Mariner; OpenAI retired Operator. They are consolidating into horizontal personal assistants, which are individual-scoped and accountability-light. The buyer needs the opposite: team-shared, permissioned, auditable product-decision state, a different data model the labs show no intent to build because for them it is a liability surface, not a growth surface. Cadence is model-agnostic by contract (17 anthropic refs, 7 openai, 4 deepseek in the runtime), so a better engine UPGRADES it. And the no-fast-oracle asymmetry means the thing the labs are best at is the thing this domain has least of. **Makes it true:** keep the chokepoint model-agnostic; make the Trust Ledger the hero (`TRUST-LEDGER`).

**Villain 2: the Incumbent PM (Atlassian / Productboard / Notion).** "We own the workspace, the data, and the distribution. Hundreds of millions of seats. We bundle AI as a loss-leader to retain them. The Teamwork Graph has 150 billion objects. You have 8 workspaces and about 90 monthly visitors, mostly your own team in India. When 'decision tracking' tests well, we ship it as a checkbox next quarter and attach it to the issue tracker the customer already pays for. You are asking a Head of Product to make a five-person pre-revenue startup their system of record for the most political artifact in the company. They will not. They will wait for us, and we are moving."
**Defense.** Their 150 billion objects are a context-and-relationship graph: it answers "what is connected to this ticket." It does NOT answer "what did we decide, why, on what evidence, who approved it, and was the call later proven right or superseded," which is a bi-temporal decision/precedent graph, and Cadence has the real, tested code for the hard query (multi-hop, invalidate-don't-delete, cycle-guarded). Flat RAG over a context graph cannot produce that answer. The structural point no incumbent can rebut: a single-suite vendor cannot be the neutral brain ABOVE the toolchain. Atlassian will never read Linear and Figma and Amplitude and decide against keeping you in Jira. Distribution is the honest threat, which is why the wedge is not "rip out Jira"; it is the Critic teardown beside Jira, needing no migration, as the shareable artifact that travels. **Makes it true:** ship the wedge (`WEDGE`, already real in code); pull cross-tool read-only access forward (`CONNECTORS-V11`, `INTEROP-V11`).

**Villain 3: the Seed Investor who has seen this movie.** "AI-PM is a graveyard. Kraftful sold to Amplitude. Cycle sold to Atlassian and got sunset. Zeda died. Reforge, the only full-lifecycle play, got absorbed by Miro. Eighteen months, four bodies. Your differentiator is 'compounding outcome memory,' but by your own documents it accrues over weeks to quarters per outcome, you have ZERO of it today, and you have no users to generate it. So the moat is a promise about data that does not exist, gated behind traction you do not have. Worse: your own strategy docs contradict each other on the core thesis ('memory is the moat' vs 'the decision layer is the moat'), your README pitches seven personas while your own canon says 'we are for everyone is what pre-PMF companies say,' and it cites Claude 3.5 and GPT-4o as current in 2026. This is an acqui-hire wearing a Series A costume."
**Defense.** The graveyard is the proof, not the warning. Every body in it was a NARROW slice (feedback, discovery) or a course business with tools bolted on; narrow slices get absorbed precisely because they are features. Their acquisitions prove the category is real enough for Amplitude, Atlassian, and Miro to pay for entry, and they prove the independent, full-lifecycle, genuinely-autonomous, system-of-record slot is now EMPTY (Reforge and Productboard Spark, the only full-lifecycle plays, both now sit inside someone else). On the empty moat, do not lie, and do not want to: pitch "the moat is a flywheel, and here is the flywheel turning on real data." Invest in the mechanism and the team's execution, evidenced by a system far above demo quality (31 missions completing autonomously, RLS on all 111 tables, a 3-day-old decision engine already armed in production). The metric that wins the room is NRR: AI wrappers churn at a median around 48% net retention, system-of-record SaaS holds 120%+, and that 15-point spread is roughly a 5x valuation spread; Cadence's entire architecture (compounding memory, rising switching cost, governance lock-in) is an NRR-expansion engine. **Makes it true:** close the loop and fuel the cold moat (`LOOP-PROVE`, `TEST-SEED`, then the built `LRN-02`/`W1-AUTO`/`MOAT-METRIC`); reconcile the doc drift (`POS-V11`).

**Villain 4: the Head of Product who churned in week two.** "I pointed it at a feature. It generated a PRD I had to rewrite anyway. It ran 'autonomous missions' that did busywork I did not trust, and the memory panel that was supposed to be the magic was empty. 'Agents execute, you govern' turned out to mean I now babysit an AI intern AND still do my own job, approving a queue of things I would rather have just done myself. Judgment is the one part of my work I actually like and the one part I will be fired for getting wrong. Why would I outsource THAT to a model and keep the typing for myself? You automated the wrong half."
**Defense.** This is the most important reframe and the one the current demo gets backwards. "Agents execute, you govern" must not feel like babysitting; it must feel like: the agent does the 214-job-posts of PM work (read every ticket, cluster the signals, draft the spec, chase the citations) and hands you a DECISION, pre-loaded with the evidence and the three times your team made a similar bet and what happened. You are not approving busywork; you are making a sharper call faster, with a record that protects you when someone asks in six months why you killed the feature. The Trust Ledger is FOR the PM, not just the auditor: it is the artifact that makes their judgment legible and defensible to their VP. The reason this villain churned is not the thesis; it is the empty demo (the seed writes no lineage edges, so the magic renders blank), a fuel problem in front of a built engine, fixable this week. **Makes it true:** `TEST-SEED`/`DEMO-SEED-RICH` (full panels), `CORE-UX-TRUST` (per-agent track record + auto-clear reversible gates, so the queue holds only consequential calls), `TRUST-LEDGER`.

**Villain 5: the Build-lane Realist.** "Your 'agent owns the whole pipeline, ticket to PR' is not your slide. It is Lovable's, Cursor's, Devin's. They raised six billion, twenty-nine billion, and they own idea-to-app and spec-to-PR today. If any part of your roadmap is building a coding/build surface, you are pouring concrete into a moat that is already draining. You are late to a fight you should not be in."
**Defense.** Conceded entirely. Do not build codegen. Cadence's output (a formed, cited PRD and a scoped task graph) is exactly the INPUT Lovable, Cursor, and Codex need. The defensible move is the one already in the architecture: dispatch to them over MCP/A2A and govern the result; sit one layer ABOVE the pipeline, deciding what deserves to enter it and remembering whether it worked. The coding agents are a commodity you conduct, not a war you enter. **Makes it true:** `ORCH-DELEGATE` (see Appendix A11 for the full mechanics + economics).

**The meta-point:** three of the five villains land because of FUEL and VISIBILITY, not architecture. So the whole pre-pitch build is: pour fuel, turn on the lights, make the Trust Ledger the hero. Four of the five defenses are activation and visibility, not new construction. The defense gap IS the build plan (§21).

### A2. Ground-truth probe 1: the strategy-doc audit (the soft spots an investor attacks)

A diligence read of the 7 strategy docs (v7-v10, moat.md, README, the role map), spanning 2026-06-14 to 06-19, found the wedge and the build-state honesty genuinely strong, but real version drift the arbiter does not reconcile:
- **The headline moat thesis flipped, and the canon was not updated.** v7:45 (the named positioning arbiter) says "Memory is the moat, not orchestration." moat.md:7 and README:55 say "the moat is the decision layer; memory is one layer of it." A reader who follows the documented arbiter lands on the RETIRED thesis. (v11 resolves this: the decision-and-outcome layer; memory is one component.)
- **"Ambient + governed, NOT autonomous" (v7) vs "say the autonomous loop out loud" (v9/CLAUDE.md).** A live tonal contradiction an investor will hear in two different pitch sentences. (v11 resolves via §3: autonomy is real and self-initiating, governed by reversibility.)
- **Persona count: 7 vs 2 vs 1.** README lists P1-P7 (enterprise-led); v7 narrows to dual-persona (PLG-led); v9 says "collapse the narrative to the individual PM." The README, the first doc an investor reads, is the broadest exactly where the canon says a pre-PMF company must be narrowest.
- **BYOK contradicted inside one file.** README removes BYOK from self-serve, but the same README's margin story still leans on BYOK as a margin lever; moat.md then says "no self-serve BYOK means we must keep margin discipline." The margin story rests on a lever the pricing just removed.
- **The build-next #1 stated two ways in v10:** `LRN-02` "closes the loop; nothing matters more" vs an overlay stamping the Decision Brain as TOPMOST.
- **Stale specifics:** the README model table cites Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, DeepSeek-Coder-V2 as current (dated for 2026), and `pgsodium` for key encryption while the code uses AES-256-GCM.
- **The 3 weakest claims a skeptic attacks on sight:** (1) "the outcome-memory moat compounds" but the loop does not close on real data, so the moat has zero accrued data and is entirely prospective; (2) "foundation labs are a capability we plug in, not a competitor" is asserted, while the docs' own threat ranking calls labs adding native memory/orchestration "existential"; (3) the pricing thesis stacks three unproven bets (PMs pay a premium for judgment; the credits model holds margin after removing BYOK; outcome accuracy lifts as memory grows, a metric that is unbuilt). All three are addressed by v11's "fuel the moat + honest flywheel pitch."

### A3. Ground-truth probe 2: the build-state audit (what is actually built)

Code-verified, not doc-trusted. **Bottom line: this is NOT fragmented bits-and-pieces; there is a genuine, code-wired end-to-end autonomous engine, driven by a live cron sweeper.** The fragmentation risk is the opposite of the fear: the surface area is large, and the deepest differentiator (the Decision Brain) is built but dormant behind an un-flipped flag.
- **Inventory:** about 50 routes collapse cleanly into about 8 real data-backed surfaces (Today, Ask, Product loop, PRD/Spec editor, Build/Studio, Missions, Brain/Knowledge, Engine Room/Govern, Settings, Admin, Connectors) via clean redirect stubs (zero "coming soon" placeholders), backed by 84 `*.functions.ts` server modules.
- **Autonomy is real and code-verified:** migration `20260603215547` schedules a `pg_cron` job `resume-runs` every minute against a real Lovable deployment URL; `advanceMissionCore` advances every running mission with no human; stations are ordered Sense/Decide/Define/Build/Ship/Learn; A2A handoff writes a structured payload and the receiver claims it compare-and-set; the loop runs from Ask, Today, Missions, and the cron.
- **The single biggest gap:** the autonomous PLUMBING is wired end-to-end, but the SIGNATURE differentiator (the Decision Brain supersession engine) is fully built yet sits behind a flag and has never run on live data, and the demo seed writes no `artifact_lineage` edges, so provenance/lineage/memory render EMPTY in any demo. The gap is activation + proof-on-real-data, not a missing engine.

### A4. Ground-truth probe 3: the technical-defensibility audit (the CTO read)

"Genuinely engineered agentic system, not a GPT-wrapper demo," but the moat is "wired and armed yet effectively unpopulated."
- **The agent loop:** adaptive step budget (orchestrator base 14, specialists about 6) under a hard ceiling; tools are DB-driven per-user per-agent and risk-capped (a scoped agent cannot even see an out-of-remit tool); approval modes compose the tool's mode with the agent's earned autonomy arc, then non-overridable safety floors force merge/revert/delegate to `review` and any high-blast tool to at least `confirm`; model routing is model-agnostic by contract (default `gemini-2.5-flash` for the loop). Real limit: a single linear plan-act-observe loop, a brittle JSON-string protocol with a regex fallback, 2,000-char tool-output truncation. Prompt-injection hardening is real (`<untrusted_tool_output>`).
- **Multi-agent orchestration is genuine and wired end-to-end:** typed handoff payloads (not pasted prompt strings), a model-free mid-mission advance engine (a deliberately good design: the orchestrator LLM only does the initial plan), claim-first CAS dispatch, skip-cascade of poisoned dependents. Live-DB evidence: 31 missions (27 completed), 37 agent runs (32 carrying a `mission_id`), 22 agent messages all consumed.
- **Genuinely defensible:** the bi-temporal typed decision graph (`supersession.ts` + `governing-decision.ts`), workspace/account-scoped compounding memory with tier-gated cross-workspace pooling, the four-lens Critic, the credential chokepoint with a cross-tenant guard. **Weekend-replicable:** the loop shape, the tool registry, the chokepoint logging, RAG retrieval, the approval-queue UI, the Critic prompt minus the graph retrieval.
- **The moat is REAL in schema/code, COLD in data:** the write path is wired and the flag is ON in production, but `agent_memory` is 23 rows (all reflections, ZERO outcome), `artifact_lineage` is 20 rows (all derivation, ZERO supersedes/contradicts), `learnings` is 1, because an edge requires a new outcome that semantically matches a prior decision with a conflicting verdict, and only about two outcomes have ever been recorded. The layer is 1-3 days old.
- **Top 3 risks:** the moat is empty and depends on usage that is not happening; most agentic plumbing is commoditizing; hard dependencies on a single managed backend + a pinned OpenAI 1536-d embedder. **Top 3 defenses:** the typed bi-temporal decision graph + governing-decision retrieval (structurally un-replicable from weights); workspace-scoped compounding memory (value-based lock-in); the governed autonomous execution loop as a system-of-record (months to match the integration depth).

### A5. Ground-truth probe 4: the live-app inspection (production truth)

Live at `https://cadence-flow-beta.lovable.app`, published, on-brand (the orange butterfly, "AGENTS EXECUTE · YOU GOVERN", Google SSO + email/password). 113 tables mapping almost 1:1 to the documented Agentic Product OS (tenancy, agent execution core, memory/decisions, PM surfaces, governance/safety, monetization, connectors). **A working app exercised by a small internal/seed circle, no external traction yet:** 5 profiles, 6 accounts, 8 workspaces, 44 agents, 37 agent runs (32 completed), 31 missions (27 completed), 12 PRDs, 26 opportunities, 35 signals, 38 tasks, 29 decisions, 158 guardrail hits, 342 ai_events totalling about 490K tokens (83 in the last 7 days); web analytics about 90-103 visitors/month, mostly direct, desktop, India + a little US; the governed-agent surfaces (Today, govern, missions, knowledge, product, chat, build, admin) are the ones actually opened. Empty/unexercised: `connections` = 0, `drift_incidents` = 0, `prototypes` = 0, `studio_changesets` = 0, `learnings` = 1, `subscriptions` = 1. Security: RLS enabled on all 111 base tables; 125 SECURITY DEFINER functions; the two billing-secret vaults have RLS-on-with-zero-policies (the correct service-role-only pattern). (Note: the Supabase MCP was unauthenticated this session; the agent reached the same DB via the Lovable `query_database` path, so Postgres-advisor-level findings were not pulled.)

### A6. Ground-truth probe 5: the market and competitor map (June 2026)

**The one-paragraph read:** "agentic PM" is inflated industry-wide; almost everything shipping is a human-in-the-loop copilot that stops at a human-approved artifact. The two PM-specific incumbents (Productboard, Aha!) self-brand "co-pilot, not autopilot." Genuine autonomy exists almost only in the adjacent CODING lane (Atlassian Rovo Dev, Cursor, Codex, Devin, Lovable/Replit), which is absorbing the "build" slice decisively, so build is not a defensible moat. The independent full-lifecycle AI-PM startups have mostly been acquired or died in 2025-26 (Kraftful to Amplitude, Cycle to Atlassian and sunset, Zeda dead, Reforge to Miro), leaving the independent, genuinely-autonomous, end-to-end, system-of-record slot effectively OPEN. The frontier labs build the substrate (personal memory, enterprise search, connectors, computer-use), not the vertical (product-decision lineage, cross-stakeholder shared state, PM system-of-record), and OpenAI is actively removing its audit trail.
- **Incumbent AI reality (verified 2025-26):** Productboard Spark (agentic skills, but non-reorderable steps, "co-pilot not autopilot"); Atlassian Rovo (the strongest, real autonomy in CODING via Rovo Dev, PM-ops is supervised triage; the Teamwork Graph is a context graph, explicitly not a decision graph; bundled + credit-metered); Aha! Elle (assistant, no background runs); Linear/Notion/Asana/ClickUp agents (mostly trigger-to-action automations + thin assignable-agent layers, credit-gated). Everyone converged on per-seat base + metered AI credits and is racing the seat price down.
- **The defensibility table (commoditized vs survives):** generic PRD/story drafting, summarization, personal-assistant memory, generic connector retrieval, single-shot automation are COMMODITIZED. Domain-opinionated lifecycle with stage gates, cross-stakeholder shared state with permissions, structured product-decision lineage/audit (the single most durable piece per every analyst), cross-tool orchestration with write-back, being the PM system-of-record, and compounding proprietary outcome data SURVIVE.
- **The 3 sharpest investor objections and the only credible answers** are captured in full in A1 (villains 1-3); the honest caveats are that Atlassian is the most dangerous competitor (distribution), and the decision-graph moat compounds slowly so time-to-depth is the vulnerability.

### A7. Core-user probe 1: the felt daily experience (the proof + trust-timing problem)

Verdict: "Cadence has a genuinely novel, well-built first-value moment (the Critic teardown) and a calm, restrained shell a discerning PM respects on sight. But the daily loop is a trust-asymmetry trap: it asks the PM to govern a machine whose intelligence is invisible because the moat data is cold. It would impress in a 10-minute demo and quietly lose the PM by week two, not because the engine is fake (it is not), but because the surfaces meant to prove the engine is smart render empty."
- **First-run:** the Critic teardown is the strongest moment (an instant Ship/Revise/Kill verdict with risks + kill-criteria, zero setup, under 10 minutes). Then it goes downhill: data-plumbing onramp, then a jargon wall (Loop, missions, stations, Engine Room, Gauntlet, Trust), then empty proof-panels. Highest-stakes fragility: if the gateway is cold, the teardown can dead-end on the very first action.
- **Emotional truth (surface to feeling):** delight = the teardown; trust = the expanded DecisionCard ("Evidence / If you approve / Undo" with reversibility coloring) and the mission gate panel; control = the mission detail page (cancel/replay/advance, "Executed unattended"); curiosity-then-deflation = "What changed" / Brain memory / spec provenance, all built to show the moat and all empty on cold data; anxiety = the Today approval queue when it has 5+ tool-call gates; alienation = the 13-tab Engine Room (calm in NAMING, overwhelming in BREADTH).
- **"Agents execute, you govern" leans BURDEN today** because most of the queue is low-level tool gates (intern-supervision) and the rejection-learning is invisible (cold memory), so rejecting feels like correcting a parrot, not training a colleague.
- **JTBD coverage (felt):** "decide and defend the call" 8/10 (the best-covered job); "spec fast" 7/10; "into eng's hands" 6/10 (setup-gated); "keep stakeholders informed" 4/10 (underbuilt); "tell me what changed and why" 3/10 today (promised, empty on cold data, the job Cadence is uniquely positioned to own); "reduce busywork" 5/10 (removes spec drudgery, adds approval drudgery); "a calm place I want to open" 7/10.
- **The 8 prioritized fixes** (now `CORE-UX-*` + `STITCH-LOOP` + the seed): (1) make the seed/engine write the moat data so panels are never empty (highest leverage by far); (2) per-agent track record on the DecisionCard; (3) auto-clear reversible tool gates, only ask about consequential ones; (4) harden the teardown's cold-gateway path; (5) promote "stakeholder update" to a first-class daily surface in the PM's voice; (6) translate the jargon at the surface while keeping the engine model; (7) give the daily brief a point of view and stakes; (8) close the rejection-learning loop visibly. Power-user wishes: "remember MY taste," a natural-language command bar, and a "what Cadence has learned about your product" view.

### A8. Core-user probe 2: the pains and the future of PM

- **Ranked pains (evidence-grounded, 2025 State of B2B PM survey + Productboard AI report):** (1) writing PRDs/tickets/epics (the documentation tax, the #1 "want less" and #2 AI time-saver); (2) status updates scattered across unconnected tools; (3) deck-building for leadership; (4) chasing/synthesizing data across 15+ tools (about 30% of PM time, directional); (5) context-switching/firefighting; (6) stakeholder alignment (about 20% of PM time); (7) prioritization debates / "why is this on the roadmap" (40% flag poor prioritization discipline); (8) meeting overload; (9) pseudo-PM work.
- **The "I wish this was autonomous" cut:** NOW (status updates, first-draft PRDs, feedback triage/clustering, task breakdown, deck assembly); SOON 1-3 yrs (continuous discovery, autonomous build because code has a fast oracle, roadmap re-ranking, decision defense); NEVER, the human core and the moat (the prioritization CALL / saying no, taste, stakeholder politics, owning the consequence). The asymmetry the market confirms: autonomy where truth is checkable, governance where it is not.
- **Emotional/career pains (under-served, high-leverage):** fear of the wrong call with no evidence to defend it (the dominant impostor-syndrome driver); being seen as a "ticket writer" not a strategist (the survey's #1 org problem, delivery-over-strategy 49%); the anxiety of outcomes they cannot prove (only 40% measure outcomes; about 39% of product investments fail for lack of clear strategy); decision amnesia (the org forgets why it decided, which validates the receipts pillar most directly, per "Why We Did That," Apr 2026).
- **The future (build for 2028):** the role bifurcates UPWARD; grunt work evaporates; judgment becomes the whole job; the PM becomes an orchestrator of agent fleets; smaller teams ship more (Every: a 15-person team, 5 products, 7-figure revenue, no manual coding); the eng/PM/design boundary blurs (LinkedIn replaced its APM program with a "Product Builder" program); discovery and delivery run continuously in one loop; the durable moat is the org-specific compounding record of decisions, evidence, and outcomes. The threat is polarization, not extinction: the translator/ticket-writer PM is at risk, the judgment/taste/domain PM is more valuable. **Build for the PM who survives, not the one who is automated.**
- **The 4 highest-leverage gaps (now on the board):** evaluations as a first-class PM primitive (`EVALS-PRIMITIVE`), the personal/portable PM decision-and-outcome track record (`PM-IMPACT-LEDGER`, the strongest un-named opportunity, a career-pain wedge + retention hook), stakeholder persuasion/alignment artifacts (`STAKEHOLDER-PACK`), and the agent-fleet control surface (`AGENT-FLEET-VIEW`). The survival warning the market flags: hollow autonomy is THE way agentic products die in this exact market, so claim-never-outruns-wiring is not optional.

### A9. The embed-skills / Playbook Registry verdict (full version of §12)

**Verdict: strong YES on the strategic idea, NO on the literal framing.** A Claude-Code dev-time "skill" is a markdown procedure a coding agent loads to do a one-shot task for the developer; a Cadence runtime "capability" is something the production loop invokes on behalf of a paying workspace, against that workspace's data, under approval gates. Embedding the skill text verbatim as runtime prompts is cosmetic: any frontier model recites generic PM method, and a competitor reproduces it in an afternoon. The defensible version is a versioned **Playbook Registry** that does for every station what `critic.server.ts` already does for the Critic: bind opinionated PM method to per-workspace decision-memory. **The exact line:** method text is commodity; method times (decision graph + outcome memory + approval history + per-workspace playbook-performance ranking) is the moat. **The strongest framing (the pitch line):** "Cadence ships with institutional product judgment as software, a library of expert PM playbooks the agents apply autonomously, and it compounds twice: smarter per workspace as it learns your decisions, and smarter per outcome as it learns which judgment actually worked." **Architecture:** a `Playbook { slug, station, version, method, rubric, requiredInputs, outputContract, bindMemory }` in `src/lib/ai/playbooks/registry.server.ts`; `bindMemory` reuses the four memory loaders the Critic already calls, generalized into a shared `bindWorkspaceContext(station, focusIds)`; a `playbook_runs` table stamps which playbook+version produced each artifact, and the Measure/Learn station ranks playbooks by validated-outcome rate. **Timing:** pitch-narrative pillar now (the Critic is the working proof, demoable today), thin vertical slice post-pitch (one new playbook through the orchestrator + a `playbook_runs` stamp), library grown slowly. **Risks:** generic dilution (lead with the memory binding, never the library size), maintenance sprawl (ship 3-4 flagship playbooks, not 30 shallow ones), focus risk 15-20 days pre-pitch.

### A10. Market sizing, business model, and pricing (full version of §10-11)

**Bottom-up TAM:** about 1.8M addressable PM seats [A] (between the about 1M active PM community [V] and about 2.6M global title count [V]) times about $550/seat/year [A] (about 2-3x the maker-tool floor of about $180-336/year [V]) = about **$1.0B direct PM-seat TAM** [E]. Lead with this honest number; the expansion is the buyer growing beyond the PM (eng leads, founders, product-ops, design) to about $3-5B [E], plus credits-not-seats scaling revenue with decision throughput. **Top-down:** PM software about $8.4B (2025) at about 11.6% CAGR [V], cluster consensus 10-14% [V]; the work-management envelope it raids is about $45-55B [E]. **SAM** about $2.5-3.5B [E]. **SOM** about $15-40M ARR by Year 3 [E] (Year 1 about $0.3-0.5M, Year 2 about $3-6M), about 0.5-1.3% of the SAM, modeled on the Notion SoR curve ($13M to $31M to $67M, 2020-22 [V]), not the vibe-coding curve.
**Pricing:** Free (the wedge + decaying memory) to Pro about $39-49/seat/month (persistent + cross-workspace memory, Critic everywhere, the outcome loop) to Team landing above $150/team/month (about $45-59/seat times 4-5 seats; org-scoped SoR, governance, shared compounding memory; account-level credit pooling, not per-workspace) to Enterprise (negotiated; BYOK and BYO-coding-agent-key as negotiated options). Do not price autonomy per seat (you shrink as PMs are automated); price decision work (credits) so revenue grows as decisioning gets cheaper. Beat "Jira already includes AI": different layer not a better feature; no fast oracle; the outcome ledger cannot be backfilled; reframe the buyer's question.
**Margin:** agentic workloads are 5-30x more token-intensive than chat, so model 45-60% blended gross margin [V-anchored], not 75%+. Levers: small-model routing, aggressive caching, grant-sizing, capped top-ups; BYOK is an enterprise-only escape valve, not a self-serve margin strategy. **Unit economics:** GM at least 55-60% at scale; NRR at least 120% (AI-wrapper median about 48%, top-quartile SoR 125-130%+, a 15-point spread is roughly a 5x valuation spread); GRR at least 85-90%; CAC payback under 15 months. The proof metric: outcome-accuracy-lift per account as memory grows (`MOAT-METRIC`). **Comparables (two axes):** category axis (Linear about $1.25B, Productboard about $1.7B 2022, Notion's early arc) and the Reforge-to-Miro/Maze strategic-acquisition floor; AI-premium axis (borrow the multiple environment of Lovable about 33x, Cursor about 15x, not the $6-29B tier). Deck sentence: "we are not the next Cursor; we are the decision layer that sits above every Cursor."

### A11. Orchestrate the builders: mechanics, BBI, and B2B economics (full version of §13)

**The mechanics (verified 2025-26).** Four of six candidates expose a genuine programmatic dispatch path, and the seat-license trap dissolves if you dispatch through the cloud/SDK/self-host surface, not the editor:
- **Devin (best fit):** a REST `POST /v3/.../sessions` async build-and-open-a-PR API with a built-in `max_acu_limit` per-task cost cap; pricing is per-ACU (1 ACU is about 15 min of work; the exact per-ACU rate is mid-revision, treat as estimate), enterprise billed in ACUs.
- **Claude Agent SDK / Codex SDK:** headless/CLI, API-key-metered (predictable per-token), you drive the loop; as of mid-2026 the Agent SDK + GitHub Actions are metered separately from interactive Claude Code.
- **Cursor Cloud Agents API:** supports service-account API keys (so it DOES fit programmatic dispatch), but the ToS for embedding it in a third-party product that dispatches on behalf of YOUR customers is the open legal question; keep Cursor BYO-key-only until cleared.
- **OpenHands (the floor):** self-host, $0 external license, BYO-LLM, so cost flows through your existing AI-credit chokepoint.
- **v0:** niche (text-to-UI, not a repo-PR agent). The seat-only/no-dispatch surfaces are the Cursor editor itself and the v0 web app.
Cadence already has the exact seams: `DelegateProvider` (BLD-04, dormant, with the right payload shape) + `ExecProvider` (SANDBOX, the $0 GitHub-Actions CI floor that decides if the result may merge). The two compose: DelegateProvider dispatches, ExecProvider greenlights.
**The recommended architecture:** OpenHands self-host as the $0 floor -> Devin + Claude Agent SDK as the two premium adapters -> Codex -> Cursor (BYO-key) -> v0. Governance is where the moat lives: human-approves-before-dispatch (a `review`-mode tool), the external agent returns a PR that cannot bypass your merge gate, the result folds back as a mission step with full trace.
**Credit consolidation:** meter external compute as Cadence credits, two postures. (A) passthrough + markup (a credit pre-authorization holds, then debits actual cost; OpenHands floor is highest-margin; premium providers convert ACU/token cost at a 1.3-1.6x markup [E], always capped per task). (B) enterprise BYO-coding-agent-key (mirrors BYOK; the customer binds their own Devin/Cursor/Codex contract via the existing `resolveProviderAuth` chain; the heaviest, spikiest compute is billed to THEIR account, removing your COGS and resolving the Cursor ToS and data-residency objections at once). **Net business model: price the orchestration + governance + decision-memory (near-software margins), meter the compute, cap every task, BYO-key to enterprise.**

### A12. The consumer-grade IA audit (full version of §14)

**Headline:** the route layer is ALREADY consolidated (about 24 of about 50 routes are redirect stubs into 6 surfaces), so "too complicated" is felt density and competing organizing metaphors, not route sprawl, and the app violates its own engine-room doctrine in fixable ways. This is a tightening job.
- **The left nav stacks four organizing systems at once** (an unlabeled workspace rail, a jargon-labeled "Loop" group whose per-group ids are flattened anyway, a Products LIST that is entity-data-as-navigation, and a "Trust" icon row where three of four icons deep-link into the SAME `/govern` surface) plus a floating dock for one link. A first-time PM meets 6+ competing navigational mechanisms.
- **The recommended IA:** 5 calm outcome-named destinations (Today, Ask, Product, Build with Missions folded in, Brain) + one recessed Engine Room door (the approvals badge on it); kill the "Loop"/"Trust" labels and the floating dock; demote the Products list into the workspace switcher; lean on the already-built ⌘K palette for the deep surfaces. The 13 Engine Room tabs (already outcome-named) group into three bands: Needs you (Approvals, Spend), Trust and safety (Controls, Safety, Team, Incidents, Attention), Quality and insight (Quality checks, Prompts, Analytics, Activity, Trends, Loop health).
- **Settings (the most overloaded surface, 11 flat tabs) into 5 groups:** Account (Profile, Notifications) / Workspace (the Strategic Brief, Voice Anchor, Members, the agent roster) / Connections (one home for Accounts/Integrations/`/sync`, killing the three-places confusion) / AI and keys (default model + BYO keys) / Billing (Plan + Credits), with Advanced (Health, Data/compliance) recessed. **Promote the Strategic Brief out of Settings:** it is injected into every agent's prompt (a steering wheel) yet buried as tab 4.
- **The doctrine violations:** calm-front (the count of exposed surfaces is not calm even though the naming is); one-door (the Trust row gives `/govern` three doors); name-the-outcome (the nav still leaks "Loop", "Trust", "Models", "Staff"); progressive disclosure (the deep surfaces are pinned in chrome AND in ⌘K, duplicated); one-Connect-place; one-home-per-artifact (Calendar and Approvals/Spend render in multiple places). Build items: `IA-NAV-V11` (#11), `SETTINGS-SEGREGATE` (#12), `CONNECTORS-V11`, `IA-DEPTH-V11`.

### A13. The seven founder reference images (and how they map)

An external "AI operating system / agentic business" talk the founder surfaced, which independently corroborated the three-pillar moat: (1+2) IMG_2847 "AI feature added to an app (drafts, waits, copyable) vs AI operating system that owns the loop (collects context, decides, acts, keeps the log)" = Cadence's positioning verbatim, and the right column is code-verified real; (3) IMG_2850 "chatbot (the work is still yours) vs action system (the work is done)" = the autonomous action thesis; (4) IMG_2854/2853 "the agent owns the whole pipeline, ticket to PR, an operating system for software teams" = the CODING pipeline, flagged as the commoditized lane to orchestrate not compete; (5) IMG_2844 "the useful questions" (which markets are too crowded, which opportunities about to explode, which to avoid) = the ambient market-sensing frame; (6) IMG_2846 "opportunity signals tagged across 373 companies" (AI agent, MCP/tool-calling, evals/sandbox, CRM and revenue ops, human approval, data ingestion, compliance and audit, browser automation) = signal-intelligence as a product + the tag set Cadence's Sense layer should use; (7) IMG_2852 "regulated buyers want proof: what changed / why / evidence / who approved; trust is not a feature, it is the thing people pay for" = the Trust Ledger, the most durable pillar, the part the labs are removing and the incumbents lack.

### A14. The raw research artifacts
The full agent reports (each 100K-200K tokens of grounded analysis with file:line citations and source URLs) live in the 2026-06-23 session transcript. This appendix distills them; for a specific claim's primary evidence, the transcript holds the raw probe output. The deck's own appendix should reproduce the source URLs from A6, A8, A10, and A11.

### A15. The full session narrative (every founder steer and how it shaped the work)

A chronological record of the 2026-06-23 session, so the PROCESS (the inputs, the corrections, the reasoning), not just the conclusions, is preserved. The concise input-to-decision table is §24; this is the narrative behind it.

1. **The opening brief.** The founder asked for an honest outsider teardown of Cadence (market + product), explicitly "do not just agree, pressure-test, use the full arsenal of skills and agents, think as an investor / entrepreneur / CTO / power user / Head of Product, and tell me the truth." The method chosen was grounding-first to avoid sycophantic grounding (reading the aspiration and mistaking it for the product): five parallel probes established reality (the strategy-doc audit, the build-state audit, the technical-defensibility audit, the live-app inspection, the market/competitor map) BEFORE any synthesis. The headline that emerged reframed the founder's own fear: the engine is wired (good news), the moat is cold and the demo is empty (the real, fixable problem).

2. **"Autonomy should not need a human to initiate; self-initiate at every phase."** This was the first major steer and it upgraded the North Star from pull-based (human triggers, agents execute) to push-based / ambient (signals push work in, agents triage and act, at every station). The non-obvious finding that made it tractable: the ambient layer is the dormant HALF of the engine that is already scaffolded (the `event_subscriptions` / `event_queue` reactor, the Sense station, a Reactor crew agent), simply un-fed and un-lit. So "self-driving at every phase" became "activate what is scaffolded + feed it signal," not "invent a new vision."

3. **"Play the villain, then defend strongly."** Produced the five-mask attack and the defense (Appendix A1). The key insight: three of the five villains land because of fuel and visibility, not architecture, so the defense gap IS the build plan.

4. **"Should we embed the skills/agents into the product?"** Produced the Playbook Registry verdict (A9): yes to the strategic idea, no to literal skill-text; the moat is method bound to per-workspace decision-memory and outcome ranking, which the Critic already demonstrates.

5. **"The core user is the most important stakeholder, and you forgot them."** A genuine and important correction. Two parallel researches (felt experience, A7; pains + future of PM, A8) were run. The felt-experience finding reframed everything: not a design problem, a proof + trust-timing problem. The pains research found the 2026 PM-AI literature converges on Cadence's exact thesis, and surfaced four high-leverage gaps now on the board (the personal impact ledger, stakeholder packs, evals, the agent-fleet view). The founder then deepened it twice: pains should drive "I wish this was autonomous," and the future-of-the-role lens should make us build for 2028, not 2026.

6. **"No separate implementation-plan doc; put the build items in the dashboard with top priority and a Why per row."** This drove the deletion of the briefly-created `v11-implementation-plan.md` and the folding of all build items into the dashboard as ranked rows (#1-21) with a one-line Why each, plus a top callout. The founder reinforced the documentation mandate: capture everything at depth so both founder and agents can re-reference what was discussed and why.

7. **"The agent ecosystem: where does it get utilized, how is it triggered, automatic? And how do agents/platforms access Cadence?"** Produced the agent operating model (§4): the roster by station, where each is utilized, the three trigger modes (human-initiated, system-continued via cron, ambient self-initiated), and the inbound interop (`INTEROP-V11`: read-only MCP, A2A cards, a scoped API). This was a legibility gap; the ecosystem was asserted but not made explicit.

8. **"Do not go by my words on IA; form your own opinion; the app is too complex, settings overloaded; it is not consumer-grade."** Produced the IA audit (A12) and the recommended IA (§14): the route layer is already consolidated, so the fix is felt-density, not a rebuild; 5 calm destinations + one Engine Room door, settings into 5 groups, one connectors home.

9. **"How do we pass work to Cursor or an equivalent; cost/license at B2B; credit consolidation; this is build/buy/integrate beyond coding agents."** Produced the orchestration economics (A11): four of six candidates are dispatchable; OpenHands $0 floor + Devin/Claude-Agent-SDK premium + enterprise BYO-coding-agent-key; price the orchestration, meter and cap the compute.

10. **"Scope-trim is reuse / reposition / club / flag, not blind deletion; honest opinion."** Produced §15 (the honest scope opinion): nothing deleted, the unexercised surfaces recessed and not invested in until the loop is proven.

11. **"The landing page is bad; think what a visiting PM wants to see, research others, do not just dump features."** Produced the landing-page content design (§14.3): hero outcome, the feature-vs-OS contrast, proof (the Trust Ledger), one CTA (the teardown), sequenced AFTER the capabilities it showcases.

12. **"Rich demo seeding is LAST, not first."** A correction to the original #1 pick (DEMO-SEED-RICH). The reasoning the founder gave (build the capability for real, then showcase it; do not fake a built product with seed) is the more honest sequencing and aligns with claim-never-outruns-wiring. Resolved by demoting the rich seed to Tier-4 (closure) and adding a minimal `TEST-SEED` (#1) as the dev enabler.

13. **"Add a one-line Why to dashboard rows."** Applied to every v11 row and made the standing convention; the legacy rows flagged for a light future pass rather than churned now.

14. **"Logical sequencing: build the feature, then the surface that showcases it."** Applied to the landing page (moved after the capabilities) and the rich seed (Tier-4); codified as a doctrine (§20.8) so agents apply it generally.

15. **"Cascade the v11 positioning into README / AGENTS / moat."** Pointers added to all three now; the full reconciliation (the formal ripple review) tracked as `POS-V11` rather than rushed.

16. **"The Brain: graphical, interconnections, derived decisions, 'how it went the past 3 months', and build-vs-integrate the layer."** Produced §7: the four human lenses, the infra verdict (build the intelligence, self-host Postgres + pgvector, integrate only the viz). The founder then extended it twice, which materially widened the capability: (a) "do not limit to four static lenses; keep horizons wide, derive whatever useful intelligence the data supports" (the lenses are the floor, the agent-derived intelligence the open ceiling), and (b) "the Brain must DRIVE agent action, not just be read" (the discover-derive-act loop; the Brain's intelligence is itself a trigger source feeding `AMBIENT-TRIGGER`).

17. **"Connectors are not fully there; day-one input; de-dup the repetitive presentation."** Produced `CONNECTORS-V11` (§14.4): one connectors home, day-one readiness so the loop is never siloed, de-dup the repetitive lists.

18. **"Bring the v11 items to the top; strict instructions to agents; one-liner + 'this is from v11'."** Clarified that the items were ALREADY Rank #1-21 (the founder was reading the markdown file line number, not the Rank), and added the prominent top callout to the dashboard with the strict pick-order instruction.

19. **"feature-backlog.md is stale; salvage pending items, archive it; the repo structure is overwhelming, restructure."** Found feature-backlog stale (its open markers mostly already-shipped work), salvaged its one genuinely-pending item (`DEF-04`), marked it superseded, and tracked the physical archive + the broader repo declutter as `REPO-DECLUTTER-V11` (because a rushed move would break about 25 live inbound links, which the repo's own anti-rot rule forbids). The honest tradeoff was surfaced rather than silently rushed.

20. **"Document every single bit at depth, the villain/defense and everything, as a reference/appendix."** This appendix (§26, A1-A16) is the response: the full research record, the session narrative, and the decision rationale, so the founder can prepare from it and any agent has complete context.

### A16. The decision rationale (the "how we decided" behind each major call)

For each major decision: the options, the tradeoff, the call, and why. (The villain/defense rationale is A1; the research findings are A2-A14.)
- **Ambient autonomy (pull vs push).** Pull is built; push is scaffolded but cold. Call: light the push half (it is the differentiated, hard-to-copy part, since it needs your connectors + memory + governance), governed by reversibility so it never acts irreversibly without a human. Why: the labs and incumbents will not own the push-from-your-signals layer.
- **The Brain (read surface vs action driver; build vs integrate; lenses vs open analyst).** Call: all of the deeper options. It drives action (discover-derive-act), the lenses are a floor with an open intelligence ceiling, and the infra is build-the-intelligence + self-host-the-substrate + integrate-only-the-viz. Why: the intelligence IS the moat (never rent it); the substrate is commodity Postgres (own the data, no per-token graph bill); a viz library is not worth building.
- **Orchestrate vs build the coding layer.** Call: orchestrate, never build codegen. Floor = OpenHands ($0 license), premium = Devin + Claude Agent SDK, enterprise = BYO-coding-agent-key. Why: build is a draining moat owned by $6-29B players; Cadence's output is their input; price the orchestration + governance, which has software margins.
- **IA: rebuild vs tighten.** Call: tighten (the routes are already consolidated; the problem is felt density). 5 destinations + one door, settings into 5 groups. Why: a rebuild would be wasted effort against an already-clean route layer; the win is in grouping and de-jargoning.
- **Demo seed: first vs last.** Call: last (rich showcase), with a minimal TEST-SEED early. Why: a rich seed in front of unbuilt capabilities is a faked product; build it for real, then showcase. This honors claim-never-outruns-wiring.
- **One doc vs a separate implementation plan.** Call: one guiding-star doc + the dashboard as the build register; delete the separate plan. Why: the founder's anti-doc-proliferation ruling; the repo has already been de-cluttered multiple times and must not re-proliferate.
- **The positioning cascade: full rewrite now vs pointer + tracked item.** Call: pointers now, the full ripple-review reconciliation tracked as `POS-V11`. Why: the formal cascade should run the ripple-review checklist (pricing, gating, IA, tests), not a rushed mid-session edit.
- **feature-backlog: physical archive now vs mark-superseded + track.** Call: mark superseded now (kills the confusion), track the physical archive as `REPO-DECLUTTER-V11`. Why: about 25 live inbound links; a half-done move breaks them, which the repo's anti-rot rule forbids; the honest tradeoff was surfaced to the founder.
- **Commit + push.** Call: commit to main and push. Why: the project's single-branch, cross-tool model and the founder's live-publishing authorization make immediate push the norm, so every tool and session syncs to the new canon.

# Horizon Bets: forward product bets not yet in the build queue

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> **What this is.** A living, append-forward register of **forward product bets** that are bigger than a backlog item and not yet specced into the build queue, captured comprehensively (thesis, evidence, wiring, open questions) so each can be enriched and then promoted into the queue with full context. This sits between the raw reasoning in [`strategic-inputs-log.md`](./strategic-inputs-log.md) and the specced work in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md): a bet lives here while we are still deciding *what* and *how* to build, then graduates to dashboard IDs and a feature spec once enriched.
>
> **Standing rule (no orphans).** Every bet here is cross-linked to the canon it touches and back again. A bet is captured here in the same session the cue surfaces; the raw input goes to [`strategic-inputs-log.md`](./strategic-inputs-log.md); the decision to pursue (and any repositioning it causes) goes to [`session-decisions.md`](./session-decisions.md). This file is linked from the strategy [`README.md`](./README.md) role map.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is Cadence, the only name to use. Any stray legacy token from the retired 2026-06-10 rename experiment reads as equivalent to `cadence`/`Cadence`.

---

## Index of bets

| ID | Bet | Drill-down doc | Priority | Status |
| --- | --- | --- | --- | --- |
| **H1** | The Decision Brain | [`decision-brain.md`](../features/decision-brain.md) | **TOPMOST (founder ruling 2026-06-20)** | Captured, awaiting enrichment |
| **H2** | The Command Canvas | [`command-canvas.md`](../features/command-canvas.md) | High, sequenced behind H1 | Captured, awaiting enrichment |

Both came from one founder session (2026-06-20) and are best read as one arc: a **second-brain product** where a knowledge graph is the engine and a command-plus-preview surface is the front. Graph in, canvas out. Each bet has a self-contained, shareable drill-down doc in [`../features/`](../features/) (linked above); this register holds the strategic view (thesis, wiring, multi-lens, roadmap).

> [!IMPORTANT]
> **Founder ruling (2026-06-20): the Decision Brain (H1) is now the topmost build priority.** In-flight work runs to a clean stopping point, then the queue reorders behind H1. Two founder requirements ride on it: (1) the brain's felt surface is an **Obsidian-style visual graph that speaks everything** (auto-built, explorable, every node tells its story), and (2) it must **deliver value at every single step, often before the user expects it** (ambient, proactive, genuinely useful, never a step that only stores data and surfaces nothing).

---

## Bet H1: The Decision Brain

### Thesis

Today Cadence's memory is **flat vector recall** (embeddings plus RAG over chunks). The founder's cue is that the moat (memory plus the decision layer) needs a genuine **company-brain / second-brain engine** underneath, "like Obsidian, a company brain, a second brain." The correct, defensible reading of that cue, grounded in the 2026 agent-memory frontier, is:

> Evolve memory into a **typed, bi-temporal, auto-extracted decision knowledge graph, layered over the existing vector recall**, whose signature mechanic is **outcome-labeled supersession**.

This is not a new feature bolted on. It is the **physical data structure of the moat the strategy already claims**: "decision to evidence to outcome to was-the-reasoning-right." That sentence is a graph. We have been storing it as flat text.

### The schema (where the defensibility lives)

- **Typed nodes:** `Signal`, `Opportunity`, `Assumption`, `Decision`, `PRD`, `Experiment`, `Outcome`/`Metric`, plus shared entities `Person`, `Team`, `Feature`.
- **Typed edges (the moat lives in the edges):** `cites`, `depends-on`, `supersedes`, `validates`, `contradicts`, `derived-from`. Each edge is **time-bounded** (`valid_at` / `invalid_at`).
- **Outcome-labeled supersession (the signature mechanic):** when an outcome lands, the prior assumption is **invalidated, not deleted**. The supersession chain is preserved with provenance. That chain *is* the "was-the-reasoning-right" loop, and it stays queryable forever.

### Why a graph and not just more vectors (research-grounded)

Flat vector RAG has three structural failures for compounding memory, and they map exactly onto the queries a PM decision OS must answer:

1. **No temporal sequence:** it returns the most *similar* fact, not the most *current* one (recommends a preference the user already abandoned).
2. **No causal traversal:** vectors are isolated points, so chains ("this assumption led to this decision led to this outcome") cannot be walked.
3. **No invalidation:** it cannot recognize that a later event overrode an earlier fact.

On the exact hard cases (temporal, multi-hop), graph memory wins decisively in published benchmarks:

- LongMemEval: Zep/Graphiti **63.8%** vs Mem0 **49.0%**, with the gains concentrated in **temporal queries (+29.6 points)** and **multi-hop reasoning (+23.1 points)**. ([Mem0 state-of-memory](https://mem0.ai/blog/state-of-ai-agent-memory-2026), [Zep](https://blog.getzep.com/stop-using-rag-for-agent-memory/))
- GraphRAG roughly **86%** vs vector roughly **32%** on a Microsoft enterprise benchmark; plus multi-hop recall lift. ([agentmarketcap graph-vs-vector](https://agentmarketcap.ai/blog/2026/04/07/graph-rag-vs-vector-rag-agent-memory-neo4j-pgvector))
- The whole frontier has converged here (Zep/Graphiti, Mem0, Letta/MemGPT, Cognee, Microsoft GraphRAG), and "agentic memory is expected to surpass RAG in usage." ([Mem0 graph memory](https://mem0.ai/blog/graph-memory-solutions-ai-agents), [Atlan frameworks](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/))

The decision-intelligence literature gives the moat its language: "decision #10,001 is smarter than #10,000 because it inherits 10,000 decisions of accumulated learning," and "the competitive cost of replicating institutional memory is structurally infinite." ([Decision DNA](https://chancecurtiss.substack.com/p/decision-dna-how-institutional-memory))

### The three hard guardrails (or the bet backfires)

1. **Hybrid, never graph-only.** Graph indexing costs roughly 10 to 40 times the cost and roughly 2.3 times the latency of vectors, and *loses* about 13% on simple single-hop lookups. Keep vectors for fuzzy recall; route only multi-hop, contradiction, and decision queries through the graph. ([agentmarketcap](https://agentmarketcap.ai/blog/2026/04/07/graph-rag-vs-vector-rag-agent-memory-neo4j-pgvector), [Atlan memory-vs-rag-vs-kg](https://atlan.com/know/ai-memory-vs-rag-vs-knowledge-graph/))
2. **Auto-extract, never manual.** Every "build a second brain" post-mortem converges on the same failure: manual capture and over-structuring kill adoption (the classic "elaborate system on Sunday, four notes by Tuesday"). The graph must be auto-populated from artifacts the PM already produces (PRDs, discovery, logged decisions), never a second job. (Cognee Extract to Cognify to Load shape; Mem0/Zep resolve contradictions on write.) ([Okafor, "the concept is the problem"](https://justtalkingtech.medium.com/i-tried-every-second-brain-app-the-concept-is-the-problem-not-the-tools-5015de4c8812))
3. **Storage is not the moat.** A bi-temporal property graph over Supabase/pgvector is viable for v1 (Graphiti on Neo4j is the open reference if we cross over later). The defensibility is the **typed temporal decision ontology plus auto-extraction plus outcome labeling**, which a competitor cannot backfill, because the value is accumulated, outcome-validated, linked judgment over calendar time.

### What to borrow

- **Tana (supertags):** typed nodes and typed edges that *mean something*, not raw untyped backlinks. This is the single most transferable PKM idea.
- **Glean (Enterprise Graph):** the graph is the explainability substrate, "because the graph is explicit, you can trace why a result emerged." That is our "why did we decide X" made queryable. ([Glean graph vs vector](https://www.glean.com/blog/knowledge-graph-vs-vector-database))
- **Guru (Verified RAG):** retrieve the *governing* decision (most recent, confirmed, not-yet-superseded), not the nearest text.

### What NOT to do

Do not market or build "Obsidian for PMs" (manual linked notes). Do not go pure-graph (cost, latency, simple-lookup regression). Do not skip contradiction-on-write (an append-only graph rots faster than vectors). Do not underestimate entity resolution ("the checkout redesign" vs "Project Swift"), the cited unsolved enterprise gap. Do not claim the moat before outcomes have accrued (claim-never-outruns-wiring): the graph's value compounds over time, which is also why it is un-backfillable.

---

## Bet H2: The Command Canvas

### Thesis

A **natural-language command / intent bar** as the primary visual surface, with a **live preview / canvas pane** on the right that renders outcomes as structured, outcome-named blocks. The founder's "everything is command-line, right side is preview" instinct is sound **if and only if** "command-line" is read as a *natural-language intent bar*, not a *syntax CLI*.

### Why this does not conflict with the Engine-Room Doctrine

The doctrine says "name the outcome, not the mechanism; the default surface never makes the user reason about how the machine works." A command bar violates that only if it requires memorized syntax. **Linear is the existence proof**: it is simultaneously the most command-driven and the calmest tool, because its command layer is an *optional accelerator over an opinionated, minimal GUI*, with plain-language outcome labels and a full mouse fallback. The preview pane is what makes the command bar calm-compatible: the user *watches* the outcome instead of *reasoning about* the mechanism. ([Inside Linear](https://www.lennysnewsletter.com/p/inside-linear-building-with-taste), [NN/g accelerators](https://www.nngroup.com/articles/ui-accelerators/))

### The 10 calm-command rules (the resolution to keep)

1. Plain-language intent, not syntax (the single biggest calm lever).
2. Outcome-named commands that show the user's word and the canonical word together (Superhuman's `Mark Done (Archive)`).
3. Forgiving, fast, fuzzy search, never exact-match.
4. The preview as the periphery-to-center confirmation (the result confirms itself visually).
5. Context-scoped command sets (show only what is relevant to the active object).
6. Shortcuts taught inline, never required.
7. Show what matters first; defer the rest (progressive disclosure).
8. A visible trigger and onboarding hint, never a secret shortcut.
9. Capability hints for the NL bar (set expectations; tone of a helpful colleague).
10. Graceful failure and a minimal resting surface.

([NN/g AI paradigm](https://www.nngroup.com/articles/ai-paradigm/), [Wattenberger, why chatbots are not the future](https://wattenberger.com/thoughts/boo-chatbots/), [Superhuman command palette](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/))

### What to borrow

- **Linear `⌘K`:** one calm door that holds everything; calm equals reduced resting scope plus full power one keystroke away.
- **Raycast AI Extensions:** natural-language intent maps to a tool plus arguments and runs. This is the Cadence shape.
- **Slack Quick Switcher:** never open to a blank prompt; populate with frecency-ranked recents; treat speed as a feature.
- **Warp blocks:** turn machine output into selectable, structured, reviewable units. This is the content model for the preview pane.
- **Claude Artifacts / ChatGPT Canvas:** persistent artifact plus ephemeral conversation; highlight-to-edit scopes changes so the system never over-rewrites.
- **bolt.new Visual Inspector:** click-to-target beats prose-only editing (v0's prose-only model is the cited negative example).

2026 direction (NN/g, Wattenberger, Maggie Appleton, LukeW, a16z, LangChain, Vercel): the field is moving *off* the bare text box toward hybrid UIs, generative UI assembled from constrained components, and review-not-drive autonomy. Command-plus-preview sits exactly where this converges. ([NN/g generative UI](https://www.nngroup.com/articles/generative-ui/), [LangChain ambient agents](https://www.langchain.com/blog/introducing-ambient-agents), [a16z agentic interface](https://podscripts.co/podcasts/a16z-podcast/big-ideas-2026-the-agentic-interface))

### Scope ruling (the decision to keep)

Command-plus-preview is the **primary layout and a power-user altitude, never a primary-only path**. Every action stays reachable in the GUI. The CLI feel is a layer, not the floor. The **preview pane is the more valuable half** of the bet (it makes autonomous agent actions legible and reviewable, which supports the claim-never-outruns-wiring posture and human-in-the-loop trust); build it first and treat the full intent bar as the accelerant layered on top.

### Risks / anti-patterns

Syntax-recall burden; mechanism-forward jargon; blank-prompt or hidden-trigger discoverability failure; prose-only editing of a visual artifact; over-rewriting; "done" reported while the preview silently diverges; an autonomy dial set to approval-fatigue or unreviewable auto-accept. Each has a known mitigation captured above.

---

## The combined arc: a second-brain product

H1 and H2 are the engine and the front of the same product instinct. A knowledge graph is the natural *engine* of a second brain; a command-plus-preview surface is the natural *front* of one (it is literally how Obsidian works: a command palette over a graph with a preview). The strategic shape is **graph in, canvas out**: one decision graph that every pillar reads from, one legible governed canvas that every action renders into.

---

## Wiring into the existing roadmap

**Where we stand (2026-06-20):** roughly 42% strict / 57% weighted complete. Strongest groups: **Decide 94%, Foundational 89%, Governance 81%** (the loop backbone, the Critic, the eval/drift gates are real). Weakest and most relevant here: **Launch 39%, Interop 52% (MCP read-only), Sense 45%**, and the **Brain surface is a status dashboard only**. The `WM-*` tenancy/monetization initiative is in flight across parallel lanes.

**The decisive interconnect findings (current code state):**

- **The outcome loop is stubbed.** `rememberOutcome()` exists, `buildOutcomeMemory()` exists, and `checkPrdShipped()` detects shipped PRDs via GitHub, but **no code calls `rememberOutcome()`**. Outcomes are detected and discarded. The moat's core loop is one wiring step from closing.
- **The Critic is context-blind.** `critic.server.ts` reads no memory and its verdict is not outcome-labeled; it red-teams the spec, not the institutional record.
- **The A2A `memory_refs` contract exists but is never populated** by the loop.
- **MCP is a read-only foundation** (`searchSignals`/`searchOpportunities`/`getPRD`/`appendDecision`), with no outcome feedback.
- **`O1` (knowledge graph + query) is partial** (provenance walk only) and **`O3` (fact drift + skill packs) is pending**, both filed P2 in the knowledge lane.

These gaps *are* the two bets. Wiring map:

| What | Today | Bet | Action |
| --- | --- | --- | --- |
| Outcome to memory pipeline | Stubbed (no caller) | H1 | **BUILD first (small):** call `rememberOutcome()` from `outcome.functions` ship-detection. Closes the loop the moat claims. |
| `O1` knowledge graph + query | Partial (provenance only) | H1 | **REPOSITION + elevate** P2 to moat-tier; becomes the typed decision graph. |
| `O3` fact drift + skill packs | Pending | H1 | **ABSORB** into H1 (freshness/provenance + MCP export). |
| Brain surface (`brain.functions.ts`, `brain.md`) | Status dashboard | H1 | **REPOSITION** into a navigable decision graph (Glean "trace why" + Guru governing-decision retrieval). |
| Critic (`critic.server.ts`, the wedge, G2) | Spec-only, context-blind | H1 | **MODIFY:** read the graph for multi-hop "what contradicts this / what happened last time." Upgrades the launch wedge's receipts. |
| MCP (G6 Interop, Lane F) | Read-only | H1 | **BRING FORWARD:** the graph becomes the neutral brain external agents query and write outcomes to; populate A2A `memory_refs` from it. |
| Loop legibility / mission cockpit (G7) | Inline cooking banner | H2 | **BUILD:** the preview/canvas pane (the valuable half first). |
| `CommandPalette.tsx` (`⌘K`, nav-only) | Navigation | H2 | **MODIFY:** elevate to an NL intent bar (Raycast pattern); preserve the GUI fallback. |
| Ask surface (`/chat`, rail "Brain") | NL Q&A + mission dispatch | H2 | **EVOLVE, do not duplicate:** the Command Canvas is the maturation of Ask (one NL surface + a persistent preview), resolving the two-NL-box overlap the founder flagged (2026-06-20). Detail in [`../features/command-canvas.md`](../features/command-canvas.md). |
| Connectors (GitHub live; Linear/Jira/Notion registered) | Partial | H1 | **EXTEND:** outcome detection feeds the graph's `Outcome` nodes with external truth. |

**On-track verdict.** H1 is not a new lane bolted on. It is the **completion of Lane B (LEARN) and the M-B milestone gate** ("compounding memory surfaced; gauntlet shows rising numbers"), which today cannot be proven because the loop is stubbed. The `WM-*` monetization work continues untouched in parallel (file-disjoint). H2 is genuinely additive and lower priority; sequence its preview pane alongside the agent-execution and cockpit surfaces, and defer the full intent bar until power-user demand is evidenced.

**The connectivity that makes the product durable.** The Decision Brain is the **one substrate every pillar draws from**: the Critic's receipts, the loop's recall and handoff threading, the Brain surface, the MCP export, and the outcome-accuracy metric all read the same graph. The Command Canvas is the **legible governed front** that makes all of it visible and approvable. One graph in, one canvas out is the interoperability that compounds, and it is exactly what an incumbent's bolt-on cannot replicate.

---

## Multi-lens read

| Lens | H1 Decision Brain | H2 Command Canvas |
| --- | --- | --- |
| **Founder** | Completes the moat already claimed; turns "memory moat" from a slogan into an enforced data structure. | A power-feel front; sequence behind H1. |
| **Investor** | The check-writing metric (outcome-accuracy lift per PM as memory grows) becomes measurable and un-backfillable; "context graph as moat" is the funded thesis (Atlassian, Glean). | UX delight, not defensibility; do not pitch as the moat. |
| **Incubator / YC** | Sharpens the wedge story with receipts; "why now" (the vector-to-graph memory shift) is current and citable. | Demo-able wow, but a side-note in the narrative. |
| **End-customer PM** | "It remembers what we decided, why, and whether it worked." The Critic stops being vibes. | Faster for keyboard-native PMs; must never force syntax on the rest. |
| **Power user** | Multi-hop queries ("what contradicts this assumption") are the senior-PM superpower. | The CLI altitude they want: frecency, shortcuts, omnipotence principle. |
| **Marketer** | Shareable artifact equals the Critic teardown with graph-cited receipts ("watch the AI demolish my pet feature with our own history"). | A striking, screenshot-able surface for build-in-public. |
| **Evangelist** | "Decision #10,001 is smarter than #10,000," the institutional-memory narrative. | "Command your product org," memorable but secondary. |
| **Business / monetization** | Graph depth is retention gravity (an export cannot take the tuned linked judgment); rides the account-level credit pool (more workspaces equals a deeper graph). | No direct monetization; a tier differentiator at most. |
| **Incumbent / competitor (the threat)** | Biggest risk: Atlassian (150B-object Teamwork Graph, opened via MCP) or Notion/Glean add an outcome-labeled decision schema. Defense: win on the decision/outcome ontology, the adversarial Critic (incumbents will not tell customers they are wrong), and cross-tool neutrality. | Copyable UX; not a defense. |

---

## Build roadmap (phased; mapped to the existing skeleton; gated)

**H1 Decision Brain** (Lane B/LEARN + G2 Decide + G6 Interop; serves milestones M-A/M-B):

- **DBR-0 (now, small, highest-leverage):** wire `rememberOutcome()` into `outcome.functions` ship-detection. Fits the knowledge lane immediately; makes outcome-labeling real. Gates: tsc + build + tests + prod dry-run.
- **DBR-1:** typed bi-temporal decision graph over Supabase/pgvector (nodes, edges, validity windows), auto-extracted from PRDs/discovery/decisions; hybrid retrieval (vectors stay). Absorbs `O1`.
- **DBR-2:** Critic reads the graph (multi-hop contradiction and precedent context); upgrades the wedge.
- **DBR-3:** Brain surface becomes a navigable graph plus provenance plus freshness plus governing-decision retrieval. Absorbs `O3`.
- **DBR-4:** MCP/A2A: populate `memory_refs`; expose the graph for external read plus outcome write (the neutral brain).
- **Cross-cut:** entity resolution and contradiction-on-write (invalidate, do not delete).

**H2 Command Canvas** (G7 Cockpit + Build surface; additive, lower priority):

- **CMD-0 (the valuable half first):** a live preview/canvas pane rendering loop progress, memory-recall citations, and Critic verdicts as outcome-named, Warp-style blocks.
- **CMD-1:** elevate `CommandPalette.tsx` from navigation to an NL intent bar that dispatches the loop into the canvas; preserve the GUI fallback.
- **CMD-2:** direct manipulation (click-to-target, highlight-to-edit) plus the 10 calm-command rules.

**Parallelism.** This strategy/doc track runs alongside the live `WM-*`/overnight lanes now (file-disjoint). For build, DBR-0 fits the existing knowledge lane immediately; DBR-1 is a new-lane candidate; CMD-0 fits the cockpit lane. All are founder-gated before they enter a lane.

---

## Open questions for the enrichment session

1. Graph storage: a bi-temporal property graph on Supabase/pgvector (v1, no new infra) versus a Graphiti/Neo4j reference engine. When do we cross over?
2. H2 scope: ship CMD-0 (preview) standalone and pause, or commit to the full intent bar?
3. Skill-pack export (DBR-4): enterprise-tier gated, or part of the cross-tool-neutral free surface?
4. Confirm the provisional `DBR-*` / `CMD-*` IDs and their dashboard placement.

---

## References (canon this bet touches)

- Moat / competition / defensibility: [`moat.md`](./moat.md) (the Decision Brain is the engine under the memory layer).
- Raw reasoning: [`strategic-inputs-log.md`](./strategic-inputs-log.md) (the 2026-06-20 entry).
- Decision log: [`session-decisions.md`](./session-decisions.md) (the 2026-06-20 entry).
- Interface law: [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md); structure: [`v8-calm-front-deep-engine.md`](./v8-calm-front-deep-engine.md); design: [`../conventions/design-context.md`](../conventions/design-context.md).
- Current Brain surface: [`../features/brain.md`](../features/brain.md).
- Live tracker: [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md), [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md).
- Role map (which strategy doc to pick): [`README.md`](./README.md).

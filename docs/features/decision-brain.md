# The Decision Brain

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> **Status: TOPMOST PRIORITY (founder ruling, 2026-06-20).** This is the lead build. Other in-flight work continues to a clean stopping point, then the queue reorders behind this. Strategic home: [`../strategy/horizon-bets.md`](../strategy/horizon-bets.md) (bet H1). Moat canon: [`../strategy/moat.md`](../strategy/moat.md). This doc is the self-contained drill-down: read it on its own to understand, build, or share the idea.

---

## In one line

Cadence's memory becomes a **living decision graph**: a typed, time-aware, auto-built map of every signal, decision, assumption, and outcome, connected the way a senior PM's mind connects them, that you can *see* (an Obsidian-style graph that speaks everything) and that quietly makes you smarter at every step, often before you ask.

---

## The problem today

Cadence already remembers, but it remembers *flatly*. Memory is stored as embeddings and retrieved by similarity (vector recall over chunks). That has three structural limits, and they are exactly the limits that matter for product decisions:

1. **It returns what is similar, not what is current.** If you changed your mind last month, a flat store still surfaces the old belief.
2. **It cannot walk a chain.** "This signal led to this assumption led to this decision led to this outcome" is invisible to a pile of vectors.
3. **It cannot retire a belief.** When an outcome proves an assumption wrong, nothing marks the old assumption as superseded.

Two real consequences follow, and a code-state review (2026-06-20) sharpened them (correcting an earlier draft that wrongly called the outcome loop "stubbed"):

- **The outcome loop IS closed, and correctly human-gated.** `recordOutcome` already writes an outcome-labeled memory via `rememberOutcome` (`outcome.functions.ts`), and it is human-gated by design, because a verdict (validated / missed) is only knowable weeks *after* ship, not at ship-detection time. So memory does compound; it just compounds *flatly* (text plus an embedding), with no typed relationships and no supersession.
- **The Critic, the launch wedge, is blind to all of it.** `runCritic` red-teams only the target row's own fields; it reads no past outcomes. So it cannot say "we shipped a similar bet and it missed." The Decision Brain fixes both: it gives the flat memory a typed, time-aware shape, and it feeds that history to the Critic so the verdict carries receipts (the first step, DBR-0, does the latter today, see the build roadmap).

---

## What it is

A **typed, bi-temporal, auto-extracted decision knowledge graph, layered over the existing vector recall**, whose signature mechanic is **outcome-labeled supersession**.

Plain version: every meaningful thing in the product (a piece of feedback, an opportunity, an assumption, a decision, a spec, a shipped result) becomes a **node with a type**. The relationships between them become **edges with a meaning** (this decision *cites* that evidence; this outcome *contradicts* that assumption; this decision *supersedes* an older one). Every node and edge knows *when* it was true. When reality proves something wrong, the brain does not delete the old belief; it marks it superseded and keeps the trail. That trail is the answer to "was our reasoning right," and it stays answerable forever.

This is not "Obsidian for PMs" in the sense of notes you maintain by hand. The structure is Tana-grade (typed), the *look* is Obsidian-grade (a graph you can see and roam), and the upkeep is **automatic**: the brain builds itself from the work you are already doing.

### The felt surface: an Obsidian-style graph that speaks everything

The brain is not a database you query in the dark. It has a face: a **visual, explorable knowledge graph**, in the spirit of Obsidian's graph view, that renders the product's whole mind.

- **Nodes are color-coded by type** (signals, opportunities, assumptions, decisions, PRDs, outcomes) and sized by influence (how much rests on them).
- **Edges are visible and meaningful**: a red `contradicts` edge between an outcome and an assumption reads at a glance; a `supersedes` edge shows a decision that replaced an earlier one.
- **Every node speaks.** Click it and it tells you its story: where it came from (provenance), what it depends on, what it led to, whether it held up. "Trace why this is on the roadmap" is two clicks, not an archaeology dig.
- **It is navigable and alive.** Zoom from the whole product down to a single decision and back. Filter by time ("what did we believe in Q1"), by type, by outcome. The graph is auto-built and always current, so it is a true mirror of the product's reasoning, not a diagram someone forgot to update.

The graph view is the proof of the moat made visible: a competitor can copy a feature, but they cannot screenshot your accumulated, outcome-validated reasoning, because they do not have it.

---

## The principle: deliver value at every step, often before it is expected

The Decision Brain earns its place only if it is **useful at every single step, including steps where the user did not ask for anything**. The graph is the asset; the felt value is the brain *volunteering* the right thing at the right moment. Concrete moments where it should quietly exceed expectations:

- **Opening a PRD:** the brain has already pulled the three past decisions an assumption here rests on, and flags one that an outcome later contradicted, before you defend it in a review.
- **Logging a decision:** it auto-links the signals and opportunities that justify it, and gently surfaces "this looks like the decision you made in March; here is what happened."
- **An outcome lands:** it proactively re-scores the priority of similar live bets ("a bet that reasoned this way just missed, so this one looks riskier now"), without you running anything.
- **In the Critic:** before you argue for your pet feature, the Critic already has receipts from your own history, so its verdict is grounded, not generic.
- **In chat / Ask:** answers come with "past finding" and "past decision" citations that link straight back into the graph.

The test for every Decision Brain surface: *did the user get a useful, specific, trust-building nudge they did not have to ask for?* If a step only stores data and surfaces nothing, it is not done.

---

## The schema (where the defensibility lives)

- **Typed nodes:** `Signal`, `Opportunity`, `Assumption`, `Decision`, `PRD`, `Experiment`, `Outcome`/`Metric`, plus shared entities `Person`, `Team`, `Feature`.
- **Typed edges (the moat is in the edges):** `cites`, `depends-on`, `supersedes`, `validates`, `contradicts`, `derived-from`, each **time-bounded** (`valid_at` / `invalid_at`).
- **Bi-temporal stamping:** every assertion knows when it became true and when it stopped being true, so "what did we believe then" and "this outcome invalidated that assumption" are first-class queries.
- **Outcome-labeled supersession:** outcomes invalidate, never delete; the chain plus provenance is preserved.

## Why a graph beats more vectors (the evidence)

| Hard query a PM brain must answer | Flat vectors | Decision graph |
| --- | --- | --- |
| "What is the *current* belief, not the similar old one?" | Fails (returns similar) | Bi-temporal validity |
| "What contradicts this assumption?" | Cannot express | `contradicts` edge traversal |
| "What happened last time we reasoned this way?" | Cannot walk the chain | Multi-hop traversal |
| "Trace why this shipped, back to the root signal" | Keyword guess | Provenance walk |

Published benchmarks on exactly these cases: Zep/Graphiti **63.8%** vs Mem0 **49.0%** on LongMemEval, with gains concentrated in **temporal (+29.6 points)** and **multi-hop (+23.1 points)** ([Mem0](https://mem0.ai/blog/state-of-ai-agent-memory-2026), [Zep](https://blog.getzep.com/stop-using-rag-for-agent-memory/)); GraphRAG roughly **86%** vs vector roughly **32%** on a Microsoft enterprise benchmark ([agentmarketcap](https://agentmarketcap.ai/blog/2026/04/07/graph-rag-vs-vector-rag-agent-memory-neo4j-pgvector)). The whole agent-memory frontier (Zep/Graphiti, Mem0, Letta, Cognee, Microsoft GraphRAG) has converged on graph memory, and the decision-intelligence literature names the moat: "decision #10,001 is smarter than #10,000," and replicating institutional memory carries a "structurally infinite" cost ([Decision DNA](https://chancecurtiss.substack.com/p/decision-dna-how-institutional-memory)).

## How it powers the rest of the product (connectivity)

The Decision Brain is the **one substrate every pillar reads from**:

- **The Critic (the launch wedge)** reads the graph for multi-hop contradiction and precedent, turning "your pet feature is wrong, with receipts" from a generic red-team into one grounded in your own history.
- **The autonomous loop** recalls from the graph and, via A2A handoffs, threads the relevant decision context to the next agent (the `memory_refs` contract that exists today but is never populated).
- **MCP / external agents** query the graph as the neutral brain across tools and write outcomes back into it.
- **Connectors** (GitHub live today; Linear/Jira/Notion next) feed real shipped/closed state into `Outcome` nodes, so the loop closes with external truth.
- **The outcome-accuracy metric** (the moat made measurable for investors) reads the graph's validated/contradicted edges.

One graph in, every surface out.

## Build roadmap (topmost priority; gated)

> **Increment 1 (founder-approved 2026-06-20): Ambient Precedent.** The first build is generalizing DBR-0 into a **cross-platform proactive precedent nudge** (semantic match over the existing outcome memories), wired at the opportunity / spec / Critic seams, migration-free. It is the felt first win ("value at every step"). Full granular design: [`ambient-precedent.md`](./ambient-precedent.md); task-by-task build plan: [`../planning/ambient-precedent-plan.md`](../planning/ambient-precedent-plan.md).

- **DBR-0 (DONE 2026-06-20, ◐):** give the Critic decision precedent. The outcome loop was already closed (`recordOutcome` → `rememberOutcome`), but the Critic (the wedge) red-teamed in a vacuum. Shipped: a pure, TDD'd `formatDecisionPrecedent` helper (`src/lib/ai/outcome-memory.ts`, +5 tests) plus a best-effort workspace-outcomes query wired into `runCritic` (`src/lib/ai/critic.server.ts`), so the Critic now cites the workspace's own shipped outcomes. tsc 0 / 303 tests / build green; fail-safe (an empty precedent block leaves the prompt unchanged). ◐ because the live LLM/DB path is not behaviorally verified unattended (verify on next publish). This is the read-side seam DBR-2 deepens once the graph (DBR-1) exists.
- **DBR-1:** the typed bi-temporal decision graph over Supabase/pgvector (nodes, edges, validity), auto-extracted from PRDs/discovery/decisions; hybrid retrieval (vectors stay for fuzzy recall). Absorbs and elevates the partial `O1` (knowledge graph + query).
- **DBR-2:** the Critic reads the graph (multi-hop contradiction and precedent context).
- **DBR-3:** the Brain surface becomes the **visual graph** (Obsidian-style explorer) plus provenance, freshness, and governing-decision retrieval. Absorbs `O3` (fact drift + skill packs).
- **DBR-4:** MCP/A2A: populate `memory_refs`; expose the graph for external read and outcome write.
- **Cross-cut:** entity resolution ("the checkout redesign" equals "Project Swift") and contradiction-on-write (invalidate, do not delete).

## Guardrails and risks (or it backfires)

1. **Hybrid, never graph-only.** Graph indexing costs roughly 10 to 40 times the cost and roughly 2.3 times the latency of vectors and loses about 13% on simple lookups; route only multi-hop/contradiction/decision queries through the graph.
2. **Auto-extract, never manual.** Manual capture and over-structuring is the documented killer of every second-brain product. The graph builds itself from existing work.
3. **Contradiction-on-write is non-negotiable.** An append-only graph rots faster than vectors (it surfaces stale, contradictory decisions confidently). Invalidate-don't-delete plus provenance is the cure, and it is also the "was-it-right" loop.
4. **Entity resolution early,** or the graph fragments.
5. **Claim never outruns wiring.** The compounding-judgment moat accrues over calendar time as outcomes are labeled; do not claim it before the loop is running. That same fact is why a competitor cannot backfill it.

## What to borrow

Tana (typed nodes/edges, not raw backlinks); Obsidian (the visual, roamable graph view, but auto-populated); Glean (the graph as the "trace why" explainability substrate); Guru (return the governing decision, not the nearest text); Cognee/Mem0/Zep (auto-extraction pipeline and contradiction-resolve on write).

## Open questions for enrichment

1. Storage: bi-temporal property graph on Supabase/pgvector for v1, versus a Graphiti/Neo4j reference engine. When to cross over?
2. The visual graph: build in-house (force-directed over our data) versus an existing graph-viz library, and how to keep it legible at scale (clustering, level-of-detail).
3. How aggressive should ambient surfacing be before it becomes noise (the calm-front balance)?

## FAQ (for sharing / posting)

- **Is this just RAG with extra steps?** No. RAG retrieves similar text. This walks a typed, time-aware graph of decisions and their outcomes, which is what answers "what contradicts this" and "what happened last time," the queries RAG structurally cannot.
- **Is it Obsidian for PMs?** It looks like Obsidian's graph and roams like it, but you never maintain it by hand. It builds itself from the work you already do. Manual upkeep is the thing that kills second-brain tools, so we removed it.
- **Why is this the moat and not a feature?** Because the value is the accumulated, outcome-validated, linked judgment of your team over time. A competitor can copy the schema in a day and still cannot copy your history.

# Ambient Precedent (Decision Brain, increment 1) — design spec

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> **What this is.** The buildable design for the first increment of the Decision Brain (H1). Brainstormed and founder-approved 2026-06-20. Strategic home: [`../strategy/horizon-bets.md`](../strategy/horizon-bets.md) (H1) and [`decision-brain.md`](./decision-brain.md). The granular, task-by-task implementation plan is [`../planning/ambient-precedent-plan.md`](../planning/ambient-precedent-plan.md).

---

## The principle (founder, 2026-06-20)

Precedent is the **decision layer made omnipresent.** It is not a feature on one screen. Wherever a decision is called out anywhere in the product, the memory of "here is how this went last time" shows up, quietly, before the user asks. The moat (decision layer + memory) becomes a felt behavior, not a section.

## What the first increment delivers

A **proactive precedent nudge**: when a user is on a decision (an opportunity, a spec, a Critic verdict), they see a calm reminder of the relevant past outcomes they already have, "you reasoned this way before; here is how it turned out." It surfaces value the user did not ask for, at the moment judgment happens.

Chosen first win (of four options): the proactive nudge, because it is the truest expression of "value at every step, even unexpected," it reuses data we already have, and it is the fastest path to a felt result. The visual graph (DBR-3) and the typed graph engine (DBR-1/2) come after.

## The four units (each one job, reusable)

### 1. Precedent engine (`src/lib/ai/decision-precedent.server.ts`)

- **Input:** a decision context `{ text, workspaceId, userId, excludeId? }`.
- **Behavior:** embed the query text, semantically recall over the workspace's existing **outcome memories** (the `agent_memory` rows where `kind = OUTCOME_MEMORY_KIND` that `rememberOutcome` already writes with embeddings), filter by a relevance threshold, rank, and return a small list `{ title, verdict, summary, link, score }`.
- **Relevance:** semantic match (cosine) over the embedded outcomes, gated by a score threshold (proposed default ~0.72, tunable) and capped at 3. The threshold is the noise control. Hybrid (semantic + theme/entity boost) is the explicit growth step, not v1.
- **Reuse:** this upgrades DBR-0's recency-only `learnings` query to genuine "reasoned this way" matching, over the same RAG retriever (`src/lib/rag/retriever.server.ts`) the loop already uses; `formatDecisionPrecedent` (built + unit-tested in `outcome-memory.ts`) becomes the engine's formatter for any text surface.
- **Scope rules:** workspace-scoped; respects the existing account-pooling rule for paid tiers (mirror `recallMemoryRefs`); `excludeId` drops the current row's own past outcome so it never cites itself.
- **Fail-safe:** any error or empty result returns `[]`.

### 2. Precedent primitive (one reusable component)

- A single calm, Ember-styled, dismissible component, dropped in anywhere: a header ("Precedent, you reasoned this way before"), 1 to 3 rows (a verdict chip + one line + a link back to the source outcome), and a dismiss affordance.
- Verdict chips reuse the existing role-color law (outcome colors: moss for validated, madder for missed, neutral for mixed); no new colors.
- Renders nothing when the engine returns `[]`.
- **Design rule:** when this component is built, the design skills (`impeccable`, `emil-design-eng`, the taste skills) are actively invoked per [`../conventions/design-context.md`](../conventions/design-context.md), and placement obeys the Engine-Room Doctrine and the home-and-today IA rubric.

### 3. Placement seams (v1: the 3 densest decision points)

Wire the primitive at the places a call is most explicitly made:

1. The **opportunity** detail (the bet).
2. The **spec / PRD** view (the commitment).
3. The **Critic** verdict surface (the red-team moment, extends DBR-0).

Built so adding a seam (Today, approvals, roadmap, anywhere else) is a one-line drop-in. The "everywhere" rollout is the explicit follow-on roadmap, not deleted scope.

### 4. Noise control

Relevance threshold + max 3 + per-context dismiss (session-level in v1, no schema) + never blocks the surface + renders nothing without real precedent.

## Data flow

decision context (text from the opportunity/spec/verdict) -> precedent engine (embed query, ANN over outcome memories, threshold, rank) -> precedent primitive renders the top matches -> user clicks through to the source outcome.

## Deliberately out of scope for v1 (the growth path)

- The typed bi-temporal decision graph (DBR-1) and multi-hop/contradiction precedent (DBR-2).
- The Obsidian-style visual graph surface (DBR-3).
- Hybrid relevance (semantic + entity/theme boost).
- Persisted (cross-session) dismissals (needs a small table; v1 dismiss is session-only).
- MCP/A2A exposure (DBR-4).

## Why this is safe and low-friction

- **Migration-free:** reads only data that already exists; the primitive is UI; seams are wiring; dismissal is session state. No DB schema decision, no founder gate.
- **Fail-safe:** every seam degrades to rendering nothing; no decision surface can break.
- **Aligned with the front-end direction:** it stitches a real, felt surface onto a backend that already exists (the outcome memories).

## Success criteria (how we know it worked)

- Opening a decision that genuinely resembles a past outcome shows a relevant, correct precedent nudge.
- A decision with no real precedent shows nothing (no noise).
- Verifiable with seeded similar and dissimilar cases on the demo workspace; the engine's ranking/threshold is unit-testable with injected memories.

## Connects to

- Upgrades and generalizes **DBR-0** (the Critic's precedent) into a platform-wide primitive.
- The read-side foundation the typed graph (**DBR-1/DBR-2**) later deepens, and the visual graph (**DBR-3**) later visualizes.
- Strategy + roadmap: [`../strategy/horizon-bets.md`](../strategy/horizon-bets.md); the bet: [`decision-brain.md`](./decision-brain.md).

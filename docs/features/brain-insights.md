# Brain Insights — human lenses on the decision/memory graph

> _Created: 2026-06-24 · Last updated: 2026-06-24_

> **Status:** ◐ Floor + human lenses shipped 2026-06-24 (lane 2, register item `BRAIN-UX-V11`, v11 Cockpit) · **Route:** `/knowledge` → **Insights** tab (now the default landing tab) · **Server fn:** `getBrainInsights`

## What it does

Makes the Brain human-useful instead of a node graph. The **Insights** tab renders rule-based, plain-language lenses a PM derives value from:

- **Headline observations** — honest, rule-based notes the data supports (hit rate, evolving beliefs, sparse-data honesty).
- **Beliefs** — current beliefs (standing decisions) vs revised (superseded), via bitemporal supersession.
- **What Cadence has learned** — recorded outcomes by verdict (validated / missed / mixed) + the decisive **hit rate** + each recent outcome's metric and ICE shift.
- **Why we believe this** _(2026-06-24)_ — per-decision plain-language "why": each recent decision's recorded **rationale**, whether it still **stands** or was **revised**, and (when known) the title of the decision that **revised** it.
- **What is unresolved** _(2026-06-24)_ — the open questions: decisions in an **active contradiction** that no later decision has settled, plus **mixed** outcomes still waiting on a clean result. Honest empty state when nothing is open.
- **How it accrued** — a month-by-month timeline of decisions + outcomes (the darker base marks revised decisions).

## Why it exists

v11: the decision/memory graph IS the moat, but a node graph is how the *agent* sees it, not how a PM derives value. The lenses are the **legibility floor**. (The open "agent volunteering intelligence" **ceiling** — predictions, next-best-action, contradiction alerts — needs the AI chokepoint and is a deliberate follow-on, not built here.)

## How it works

- `getBrainInsights` (`src/lib/brain-insights.functions.ts`) — workspace-scoped (`context.supabase`, RLS-gated) reads of `decisions` (incl. `rationale`) + `learnings` + the bitemporal `artifact_lineage` graph; no migration, no AI/chokepoint.
- The lens math is **pure + unit-tested** (`summarizeLearnings`, `isDecisionSuperseded`, `monthKey`, `buildTimeline`, `derivePatterns`, `supersedingIdFor`, `supersedesParentMap`, `resolvedChildIds`, `activeContradictions`, `deriveUnresolved` — **22 tests**). `valid_to` has a pre-migration fallback so the lens never errors to empty.
- **Revised vs contested are disjoint by design.** The shared `supersededChildIds` (Trust Ledger) treats both `supersedes` AND `contradicts` as "no longer the active belief" — right for the ledger's question. The Brain panel asks a different question, so it uses a **`supersedes`-only** map (`supersedesParentMap`) for "revised": a mere `contradicts` is an **open conflict** that routes to the *unresolved* lens, never mislabeled "now superseded by X". An adversarial review caught this (a decision could otherwise read as both revised AND unresolved); the fix is regression-guarded.
- The unresolved `count` is the **honest total** of open contradictions even when the rendered list is capped (also a regression-guarded review fix).
- View: `src/components/knowledge/InsightsPanel.tsx` (Ember chrome; honest empty/sparse states per the no-filler law).
- Voice: signal-first and honest when sparse (per the product generated-output voice precedent).

## Known limits / follow-ons

- **The AI "open analyst" ceiling** (predictions, next-best-action, contradiction/risk alerts, cost-of-inaction) is NOT built — it requires the AI chokepoint (pinned/forbidden for lanes). This is now the ONLY remaining ◐ slice. Deliberate follow-on.
- The rule-based FLOOR lenses (beliefs, learned, timeline, observations, **per-decision why**, **what-is-unresolved**) are all shipped.

## Where to see it

`Sidebar → Brain → Insights` (`/knowledge`, the default tab).

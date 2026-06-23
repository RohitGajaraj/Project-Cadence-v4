# Brain Insights — human lenses on the decision/memory graph

> _Created: 2026-06-24 · Last updated: 2026-06-24_

> **Status:** ◐ Floor shipped 2026-06-24 (lane 2, register item `BRAIN-UX-V11`, v11 Cockpit) · **Route:** `/knowledge` → **Insights** tab (now the default landing tab) · **Server fn:** `getBrainInsights`

## What it does

Makes the Brain human-useful instead of a node graph. The **Insights** tab renders rule-based, plain-language lenses a PM derives value from:

- **Headline observations** — honest, rule-based notes the data supports (hit rate, evolving beliefs, sparse-data honesty).
- **Beliefs** — current beliefs (standing decisions) vs revised (superseded), via the same bitemporal supersession rule as the Trust Ledger.
- **What Cadence has learned** — recorded outcomes by verdict (validated / missed / mixed) + the decisive **hit rate** + each recent outcome's metric and ICE shift.
- **How it accrued** — a month-by-month timeline of decisions + outcomes (the darker base marks revised decisions).

## Why it exists

v11: the decision/memory graph IS the moat, but a node graph is how the *agent* sees it, not how a PM derives value. The lenses are the **legibility floor**. (The open "agent volunteering intelligence" **ceiling** — predictions, next-best-action, contradiction alerts — needs the AI chokepoint and is a deliberate follow-on, not built here.)

## How it works

- `getBrainInsights` (`src/lib/brain-insights.functions.ts`) — workspace-scoped (`context.supabase`, RLS-gated) reads of `decisions` + `learnings` + the bitemporal `artifact_lineage` graph; no migration, no AI/chokepoint.
- The lens math is **pure + unit-tested** (`summarizeLearnings`, `isDecisionSuperseded`, `monthKey`, `buildTimeline`, `derivePatterns` — 11 tests). Supersession reuses `supersededChildIds` from the Trust Ledger so the Brain and the ledger never disagree. `valid_to` has a pre-migration fallback so the lens never errors to empty.
- View: `src/components/knowledge/InsightsPanel.tsx` (Ember chrome; honest empty/sparse states per the no-filler law).
- Voice: signal-first and honest when sparse (per the product generated-output voice precedent).

## Known limits / follow-ons

- **The AI "open analyst" ceiling** (predictions, next-best-action, contradiction/risk alerts, cost-of-inaction) is NOT built — it requires the AI chokepoint (pinned/forbidden for lanes). Deliberate follow-on.
- Additional FLOOR lenses still buildable rule-free: per-decision plain-language "why did we decide X", and an "what is unresolved" lens over open opportunities.

## Where to see it

`Sidebar → Brain → Insights` (`/knowledge`, the default tab).

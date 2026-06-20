# EVAL-COVERAGE — which AI surfaces have an eval guard

> _Created: 2026-06-21 (lane 1). Status: ◐ scorer + read fn + EvalsPanel banner shipped._

Closes the `considerations.md` AI-safety-lens **P1** gap "Eval coverage targets per surface/agent" (_"Today coverage is partial; autonomy needs broad coverage"_). The eval substrate already supported suite CRUD, score trends, and scheduled runs, but nothing answered the governance question: **which of the canonical AI surfaces have no eval guard at all.** This computes it, completing the "is the autonomy actually guarded" triad with [RELIABILITY-SLO](./reliability-slo.md) (is it reliable) and [RUNAWAY-DETECT](./runaway-detection.md) (is it spinning).

## What it scores

Across the 7 canonical `surface×prompt_key` targets (chat/default, copilot/daily_brief, discovery/theme_cluster, meetings/summarize, roadmap/prd_generate, studio/prototype, agent/planner_executor), each is classified:

- **covered** — an enabled suite with at least one runnable (enabled) case for the target whose last run is `completed`.
- **stale** — a guard exists but is unproven: never ran, errored, only ever in flight, or has zero runnable cases.
- **uncovered** — no enabled, runnable-case-bearing suite for the target (the hard gap).

`coveragePct` = covered / total. A calm `summarizeCoverage` line is empty at full coverage.

## Coverage vs pass-rate (the design call)

A suite's score **trend** answers "is the eval passing?"; coverage answers the more fundamental "is the surface guarded **at all**?". So a `completed` last run counts as covered regardless of whether its cases passed (that is the score trend's job). An enabled-but-**empty** suite (0 runnable cases) is a hollow guard, so it counts as `stale`, never covered — keeping the metric honest. `eval_runs` lifecycle: `pending → running → completed | error`, so `completed` is the success terminal (the literal the runner writes; note the legacy `agent_runs` value is `complete`, deliberately not accepted).

## How it works

- **Pure scorer** — [`../../src/lib/evals/coverage.ts`](../../src/lib/evals/coverage.ts): `EVAL_COVERAGE_TARGETS` (the canonical list, **re-imported by EvalsPanel as its `SURFACE_KEYS`** so the create-suite picker and the scorer share one source of truth and cannot drift) + `assessEvalCoverage` / `targetState` / `summarizeCoverage`. Deterministic and **total** (empty suites, empty target list, unknown status all yield a defined report). Fully unit-tested (`coverage.test.ts`, 17 cases).
- **Read-only server fn** — `getEvalCoverage` in [`../../src/lib/evals.functions.ts`](../../src/lib/evals.functions.ts): reads `eval_suites` (user-scoped `.eq('user_id', userId)`), folds `eval_cases` counts + the newest `eval_runs.status` per suite (the same fold `listEvalSuites` uses), normalizes to the scorer's shape, runs it. No writes, no agent calls, no AI spend.
- **Calm banner** — [`../../src/components/governance/EvalsPanel.tsx`](../../src/components/governance/EvalsPanel.tsx) renders a one-line "Coverage" banner above the suite grid **only** when something is uncovered or stale (e.g. "3 of 7 AI surfaces have no eval guard"); silent at full coverage, neutral ink (the role-color accents stay reserved), degrades to silent on a query error. (The unification also removed em-dashes from the picker labels, a humanization win.)

## Verification

- `bunx tsc --noEmit` clean; `bun --bun run build` green; `bun test` 463 pass (17 new).
- The scorer is behaviorally complete and verified offline. The read fn's live query verifies on the founder's next publish (the lane's ◐ convention; DB MCPs intermittent this session).

## Out of scope / follow-ups

- **Per-target chips** in the suite grid (covered/stale/uncovered as VerdictChips per the design system), and a one-click "create a guard for this uncovered surface" affordance.
- **A coverage floor** as a deploy gate (alongside KI-14's regression-blocks-deploy) once coverage is broad.

## Related

- Gap source: [`../planning/considerations.md`](../planning/considerations.md) (AI / autonomous-agent safety lens, P1).
- Triad siblings: [`reliability-slo.md`](./reliability-slo.md) + [`runaway-detection.md`](./runaway-detection.md).
- Board: `EVAL-COVERAGE` (row 155) in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md).
- Build log: [`../../plan.md`](../../plan.md) §4.

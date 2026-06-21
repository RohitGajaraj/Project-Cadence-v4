# EVAL-COVERAGE — which AI surfaces have an eval guard

> _Created: 2026-06-21 (lane 1). Status: ✅ scorer + read fn + EvalsPanel banner + per-target chips + one-click guard + a dormant-by-default coverage-floor deploy-gate primitive — **LIVE-VERIFIED on the published app 2026-06-22** (lane 1): `/govern?tab=evals` renders "Coverage · 7 of 7 AI surfaces have no eval guard" with all 7 per-surface chips, and clicking the "Chat, default" chip opened the New eval suite form pre-targeted (Name pre-filled "Chat, default", Target prompt combobox "Chat, default" selected, pass gate 70). The only remaining piece is wiring the (already-built, dormant) floor into the CI/deploy step — founder/infra._

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
- **Calm banner + per-surface chips** — [`../../src/components/governance/EvalsPanel.tsx`](../../src/components/governance/EvalsPanel.tsx) renders a one-line "Coverage" headline above the suite grid **only** when something is uncovered or stale (e.g. "3 of 7 AI surfaces have no eval guard"), then a per-surface **chip map** of all 7 targets so the gap is actionable surface-by-surface. The chips read the report's `targets[]` (one ordered source, no drift with the summary): **covered** = quiet emerald, **uncovered** = rose (solid), **stale/unproven** = neutral + dashed (kept off the `--saffron` celebration token, and distinguishable from uncovered without relying on hue, so it is colorblind-safe). Each chip carries an `aria-label` naming the state, so coverage state is announced, not color-only. Silent at full coverage; degrades to silent on a query error.
- **Coverage-floor deploy gate (pure primitive, dormant by default)** — `evaluateCoverageFloor(report, policy)` in `coverage.ts` is a pure, total policy function: a `CoverageFloorPolicy` of a `minCoveragePct` and/or a list of `requiredSurfaces` yields a `CoverageGateVerdict` `{ configured, pass, reasons }`. A policy with neither set is **dormant** (`configured:false`, always `pass:true`), so it **never blocks a deploy until the founder opts in** (the flag-gated-default-off convention). `getEvalCoverage` reads the policy from env (`EVAL_COVERAGE_FLOOR_PCT`, clamped to ≤100; `EVAL_COVERAGE_REQUIRED_SURFACES`, a comma list, deduped) and returns the verdict alongside the report; the panel shows a calm "Coverage floor not met" line (sentence-case reasons) only when configured AND failing. The floor compares the **true unrounded ratio** (6/7 displays as 86% but gates as 85.7%), and a required surface counts only when actually `covered` (stale/uncovered do not satisfy it).

## Verification

- `bunx tsc --noEmit` clean; `eslint` 0 on the changed files; `bun test` 599 pass (`coverage.test.ts` now 34 cases). The production `bun run build` is red only on a pre-existing Lovable `vite-config` ESM-cycle baseline (fails at config load, before any of this source).
- The scorer + the floor primitive are behaviorally complete and verified offline (incl. a 3-lens adversarial review: logic SHIP, security SHIP/0-findings, UX SHIP_WITH_FIXES — all real findings folded).
- **Live (2026-06-22):** `/govern?tab=evals` on the published app renders the Coverage headline ("7 of 7 AI surfaces have no eval guard" — correct: the seeded Lumen suite targets a product surface, not one of the 7 canonical targets), the full 7-chip per-surface map, and the one-click guard flow (clicking a chip opens `CreateSuiteForm` pre-targeted to that surface, with the combobox + name pre-seeded). The read fn's live query against `eval_suites`/`eval_runs` is exercised by this render. Verified by Playwright against `cadence-flow-beta.lovable.app` (demo account, commit 662b5aec).

## One-click guard (2026-06-21, lane 1)

Each uncovered/stale coverage chip is now a button: clicking it opens the existing `CreateSuiteForm` pre-targeted to that surface (and pre-filled with the surface label as the suite name), so the operator goes from "this surface has no guard" to a pre-seeded new suite in one click. Covered chips stay static. The form validates the seeded target against the canonical `SURFACE_KEYS` (an unknown target falls back to the default, never an invalid surface/key), is re-keyed on the prefill so clicking a different gap chip while the form is open re-seeds it, and a manual "New suite" / empty-state open stays unseeded. Reviewed (single-agent, SHIP, 0 defects; folded one defensive prefill-clear). UI: `/govern?tab=evals`.

## Out of scope / follow-ups

- **Wire the floor into the actual deploy pipeline.** `evaluateCoverageFloor` is the reusable primitive; a CI/pre-deploy step (alongside KI-14's regression-blocks-deploy) can call it and block the ship when the verdict fails, once the founder sets the floor env. Today the verdict only surfaces in the panel.

## Related

- Gap source: [`../planning/considerations.md`](../planning/considerations.md) (AI / autonomous-agent safety lens, P1).
- Triad siblings: [`reliability-slo.md`](./reliability-slo.md) + [`runaway-detection.md`](./runaway-detection.md).
- Board: `EVAL-COVERAGE` (row 155) in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md).
- Build log: [`../../plan.md`](../../plan.md) §4.

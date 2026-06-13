-- v6 Phase 3 ("Proof & Launch") · KI-14 — standardize the suite-eval score scale on 0–100.
--
-- WHY: `eval_runs.avg_score` and `eval_case_results.score` were `numeric(4,3)`
-- (max 9.999 — a 0–1 design), but the live judge (`eval-runner.server.ts`)
-- writes 0–100 and `eval_suites.pass_threshold` is INTEGER 0–100. Two failures:
--   (1) a real eval run writing a score ≥ 10 OVERFLOWS `numeric(4,3)` — a silent
--       corruption / hard insert error on the live runner path;
--   (2) the demo seeds wrote 0–1 fractions, so the UI honestly rendered
--       "score 1 · below gate 80" — a false failure (KI-14 as observed).
-- Fix: standardize on 0–100 — the judge's native scale, the threshold's scale,
-- and what the UI (`EvalsPanel`/`EvalSuiteDetail`) already assumes.
--
--   (a) widen both columns to `numeric(6,3)` — holds 0–100.000 AND keeps the old
--       3-decimal scale, so the widen is precision-lossless;
--   (b) rescale the existing 0–1 rows ×100 (eval_runs, eval_case_results, AND the
--       derived drift_snapshots.avg_eval_score channel, which materializes the same
--       metric at rollup — so all three persisted copies stay on one scale).
--
-- FORWARD-ONLY (apply exactly once — the migration ledger guarantees this): the
-- data rescale is value-guarded (`<= 1`), NOT re-run-proof. Rationale for the guard:
-- pre-widening the column held only values ≤ 9.999, and any genuine 0–100 write ≥ 10
-- would have overflowed (so never persisted) — therefore every existing row ≤ 1 is a
-- 0–1 seed fraction. EDGE (accepted): a genuine per-case 0–100 score of exactly 0 or 1
-- (a real near-zero run) fits `numeric(4,3)` and would be touched by the guard — 0×100=0
-- (harmless) and a true `1` → 100 (mis-scaled). This is near-nil in practice (no real
-- runner row is known to survive, and a case scoring exactly 1/100 is vanishingly rare)
-- and is the price of not being able to distinguish 0–1 "1.0" from 0–100 "1" post-hoc.
--
-- NO application logic change is needed (verified against source):
--   * the runner already writes 0–100 and compares `verdict.score >= pass_threshold`;
--   * the eval UI reads the raw score and compares it to `pass_threshold` (both 0–100);
--   * `trust.server.ts` reads a DIFFERENT table (`ai_evals.score`, the per-message
--     chat-judge system, still 0–1) — not these columns;
--   * `drift.server.ts` feeds the score only through a scale-invariant pct-delta.
-- (The drift UI formatter is updated separately to render the 0–100 value as an integer.)
--
-- RESIDUAL (tracked in known-issues KI-14): `seed_demo_workspace` still emits 0–1
-- literals. It is NOT on the signup path (the current `handle_new_user` no longer calls
-- it), so (b) fixes all existing demo data — but it IS the documented manual re-seed for
-- the demo accounts (docs/operations/demo-credentials.md). That doc now carries a warning
-- + a corrected re-seed snippet (run the seed, then the same three ×100 normalizations) so
-- an operator never silently re-breaks the demo. Reproducing the 354-line seed function to
-- change a few literals was judged a worse (untestable-here) risk than the operator-gated,
-- now-documented residual.

ALTER TABLE public.eval_runs         ALTER COLUMN avg_score TYPE numeric(6,3);
ALTER TABLE public.eval_case_results ALTER COLUMN score     TYPE numeric(6,3);

UPDATE public.eval_runs
   SET avg_score = round(avg_score * 100, 3)
 WHERE avg_score IS NOT NULL AND avg_score <= 1;

UPDATE public.eval_case_results
   SET score = round(score * 100, 3)
 WHERE score IS NOT NULL AND score <= 1;

-- drift_snapshots.avg_eval_score is the SAME metric materialized at drift-rollup time
-- (drift.server.ts derives it from eval_case_results.score). Plain numeric (no widen);
-- rescale existing 0–1 rows so the derived channel matches the rescaled source and a
-- drift window can't straddle a 0–1↔0–100 boundary.
UPDATE public.drift_snapshots
   SET avg_eval_score = round(avg_eval_score * 100, 3)
 WHERE avg_eval_score IS NOT NULL AND avg_eval_score <= 1;

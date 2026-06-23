/**
 * EVALS-PRIMITIVE (v11 #29) — server adapter for the eval-HEALTH (trust) leg.
 *
 * Thin DB-to-helper bridge: loads the user's eval suites + their run history (the same
 * user-scoped RLS pattern as `evals.functions.ts`) and hands them to the PURE
 * `computeEvalHealth`. Returns the structured health report (pass rate, error rate, trend,
 * per-suite flakiness, a trust verdict) + a one-line summary. The reliability logic lives in
 * `evals/health.ts` so it is unit-tested and cannot drift. No migration, no AI/chokepoint.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  computeEvalHealth,
  summarizeEvalHealth,
  type EvalHealth,
  type EvalRunRow,
  type SuiteTitles,
} from "@/lib/evals/health";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EvalHealthResult = { health: EvalHealth; summary: string };

export const getEvalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EvalHealthResult> => {
    const { supabase, userId } = context;

    const { data: suites, error: sErr } = await supabase
      .from("eval_suites")
      .select("id,name")
      .eq("user_id", userId);
    if (sErr) throw new Error(sErr.message);

    const ids = (suites ?? []).map((s) => s.id);
    const titles: Record<string, string | null> = {};
    for (const s of suites ?? []) titles[s.id] = (s as { name?: string | null }).name ?? null;

    let runs: EvalRunRow[] = [];
    if (ids.length) {
      const { data, error: rErr } = await supabase
        .from("eval_runs")
        .select(
          "suite_id,status,pass_count,fail_count,errored,total_cases,avg_score,created_at",
        )
        .in("suite_id", ids)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (rErr) throw new Error(rErr.message);
      runs = (data ?? []) as unknown as EvalRunRow[];
    }

    const health = computeEvalHealth(runs, titles as SuiteTitles);
    return { health, summary: summarizeEvalHealth(health) };
  });

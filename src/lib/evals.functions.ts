/**
 * Server functions for the Eval Harness UI (/evals).
 * - listEvalSuites: all user suites with stats
 * - getEvalSuite: detail + cases + recent runs
 * - createEvalSuite / updateEvalSuite / deleteEvalSuite
 * - createEvalCase / updateEvalCase / deleteEvalCase
 * - runEvalSuiteNow: trigger a manual run (synchronous)
 * - getEvalRun: full run detail with per-case results
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runEvalSuite } from "./ai/eval-runner.server";

export const listEvalSuites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: suites, error } = await supabase
      .from("eval_suites")
      .select(
        "id,name,description,surface,prompt_key,model,judge_model,pass_threshold,enabled,schedule_cron,last_run_at,updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (suites ?? []).map((s) => s.id);
    const caseCounts = new Map<string, number>();
    const lastRuns = new Map<
      string,
      {
        status: string;
        avg_score: number | null;
        pass_count: number;
        fail_count: number;
        created_at: string;
      }
    >();
    if (ids.length) {
      const { data: cases } = await supabase
        .from("eval_cases")
        .select("suite_id")
        .in("suite_id", ids);
      (cases ?? []).forEach((c) =>
        caseCounts.set(c.suite_id, (caseCounts.get(c.suite_id) ?? 0) + 1),
      );
      const { data: runs } = await supabase
        .from("eval_runs")
        .select("suite_id,status,avg_score,pass_count,fail_count,created_at")
        .in("suite_id", ids)
        .order("created_at", { ascending: false });
      (runs ?? []).forEach((r) => {
        if (!lastRuns.has(r.suite_id)) lastRuns.set(r.suite_id, r);
      });
    }

    return (suites ?? []).map((s) => ({
      ...s,
      case_count: caseCounts.get(s.id) ?? 0,
      last_run: lastRuns.get(s.id) ?? null,
    }));
  });

export const getEvalSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { suite_id: string }) => z.object({ suite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: suite, error } = await supabase
      .from("eval_suites")
      .select("*")
      .eq("id", data.suite_id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { data: cases } = await supabase
      .from("eval_cases")
      .select("*")
      .eq("suite_id", suite.id)
      .order("created_at", { ascending: true });
    const { data: runs } = await supabase
      .from("eval_runs")
      .select(
        "id,status,trigger,model,judge_model,pass_count,fail_count,errored,total_cases,avg_score,total_cost_usd,total_latency_ms,created_at,completed_at,error",
      )
      .eq("suite_id", suite.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { suite, cases: cases ?? [], runs: runs ?? [] };
  });

const SuiteInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  surface: z.string().min(1).max(50),
  prompt_key: z.string().min(1).max(100),
  model: z.string().max(100).optional().nullable(),
  judge_model: z.string().max(100).optional().nullable(),
  pass_threshold: z.number().int().min(0).max(100).optional(),
  schedule_cron: z.string().max(100).optional().nullable(),
  enabled: z.boolean().optional(),
});

export const createEvalSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SuiteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("eval_suites")
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description ?? null,
        surface: data.surface,
        prompt_key: data.prompt_key,
        model: data.model ?? null,
        judge_model: data.judge_model ?? "google/gemini-2.5-flash",
        pass_threshold: data.pass_threshold ?? 70,
        schedule_cron: data.schedule_cron ?? null,
        enabled: data.enabled ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateEvalSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ suite_id: z.string().uuid() }).merge(SuiteInput.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { suite_id, judge_model, ...rest } = data;
    const patch = {
      ...rest,
      ...(judge_model !== undefined
        ? { judge_model: judge_model ?? "google/gemini-2.5-flash" }
        : {}),
    };
    const { error } = await supabase
      .from("eval_suites")
      .update(patch as never)
      .eq("id", suite_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvalSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { suite_id: string }) => z.object({ suite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("eval_suites")
      .delete()
      .eq("id", data.suite_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CaseInput = z.object({
  suite_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  input: z.string().min(1).max(20000),
  expected: z.string().max(20000).optional().nullable(),
  rubric: z.string().max(4000).optional().nullable(),
  weight: z.number().int().min(1).max(10).optional(),
  enabled: z.boolean().optional(),
});

export const createEvalCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("eval_cases")
      .insert({
        user_id: userId,
        suite_id: data.suite_id,
        name: data.name,
        input: data.input,
        expected: data.expected ?? null,
        rubric: data.rubric ?? null,
        weight: data.weight ?? 1,
        enabled: data.enabled ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateEvalCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ case_id: z.string().uuid() })
      .merge(CaseInput.partial().omit({ suite_id: true }))
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { case_id, ...patch } = data;
    const { error } = await supabase
      .from("eval_cases")
      .update(patch)
      .eq("id", case_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvalCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { case_id: string }) => z.object({ case_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("eval_cases")
      .delete()
      .eq("id", data.case_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runEvalSuiteNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { suite_id: string }) => z.object({ suite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return await runEvalSuite(supabase, userId, data.suite_id, "manual");
  });

/**
 * F-DESIGN-EMBER (screen 5, Govern · Evals) — score trend per suite for the
 * list-level cards: latest vs previous completed run, so the "↑ improving /
 * → steady / ↓ falling" mono label renders from real run history, never an
 * invented trend. Additive only — listEvalSuites is untouched.
 */
export const getEvalScoreTrends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: runs, error } = await supabase
      .from("eval_runs")
      .select("suite_id,avg_score,created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("avg_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const trends: Record<string, { latest: number; previous: number | null }> = {};
    const seen = new Map<string, number>();
    for (const r of runs ?? []) {
      const n = seen.get(r.suite_id) ?? 0;
      if (n === 0) trends[r.suite_id] = { latest: Number(r.avg_score), previous: null };
      else if (n === 1) trends[r.suite_id].previous = Number(r.avg_score);
      seen.set(r.suite_id, n + 1);
    }
    return { trends };
  });

/**
 * F-DESIGN-EMBER (screen 7, Govern · Evals drill-down) — the runs-table
 * "Prompt" column: per-run prompt version labels ("v3") for a suite.
 * getEvalSuite's runs select omits prompt_version_id and feeds the live
 * panel, so it must not be reshaped — this is additive only. Returns
 * { versions: { [run_id]: "v3" | null } }; prompt_version_id is nullable
 * (the UI falls back to eval_runs.model or "—").
 */
export const getEvalRunPromptVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { suite_id: string }) => z.object({ suite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: runs, error } = await supabase
      .from("eval_runs")
      .select("id,prompt_version_id")
      .eq("suite_id", data.suite_id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const versionIds = [
      ...new Set(
        (runs ?? [])
          .map((r) => r.prompt_version_id as string | null)
          .filter((v): v is string => v != null),
      ),
    ];
    const labels = new Map<string, string>();
    if (versionIds.length) {
      const { data: vs } = await supabase
        .from("prompt_versions")
        .select("id,version")
        .in("id", versionIds);
      (vs ?? []).forEach((v) => labels.set(v.id, `v${v.version}`));
    }
    const versions: Record<string, string | null> = {};
    (runs ?? []).forEach((r) => {
      versions[r.id] = r.prompt_version_id ? (labels.get(r.prompt_version_id) ?? null) : null;
    });
    return { versions };
  });

export const getEvalRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { run_id: string }) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run, error } = await supabase
      .from("eval_runs")
      .select("*")
      .eq("id", data.run_id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { data: results } = await supabase
      .from("eval_case_results")
      .select(
        "id,case_id,status,actual,score,passed,judge_reasoning,ai_event_id,judge_event_id,prompt_tokens,completion_tokens,cost_usd,latency_ms,error,created_at",
      )
      .eq("run_id", data.run_id)
      .order("created_at", { ascending: true });
    const caseIds = (results ?? []).map((r) => r.case_id);
    let caseMap = new Map<string, { name: string; input: string; expected: string | null }>();
    if (caseIds.length) {
      const { data: cs } = await supabase
        .from("eval_cases")
        .select("id,name,input,expected")
        .in("id", caseIds);
      caseMap = new Map((cs ?? []).map((c) => [c.id, c]));
    }
    return {
      run,
      results: (results ?? []).map((r) => ({ ...r, case: caseMap.get(r.case_id) ?? null })),
    };
  });

/**
 * Eval Harness runner — executes a suite end-to-end:
 *   1. resolve target prompt (surface/key) → version_id
 *   2. for each enabled case: call subject model with case.input
 *   3. judge the actual output with a judge model (0-100 + reasoning)
 *   4. write eval_case_results + roll up eval_runs totals
 *
 * Designed to be invoked from a serverFn (manual "Run now") or from the
 * scheduled eval-suite-tick hook.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { callModel } from "./runtime.server";

type Suite = {
  id: string;
  user_id: string;
  name: string;
  surface: string;
  prompt_key: string | null;
  model: string | null;
  judge_model: string;
  pass_threshold: number;
};

type Case = {
  id: string;
  name: string;
  input: string;
  expected: string | null;
  rubric: string | null;
  weight: number;
  enabled: boolean;
};

const JUDGE_SYSTEM = `You are a strict AI output evaluator. Score the candidate output on a 0-100 scale where 100 is perfect and 0 is unusable. Consider correctness, completeness, format adherence, and the rubric (if provided). When an expected output is given, weight similarity heavily but allow semantically equivalent phrasings. Respond ONLY with strict JSON: {"score": number, "passed": boolean, "reasoning": string}.`;

function buildJudgePrompt(c: Case, actual: string, passThreshold: number) {
  return `Case: ${c.name}

Input:
${c.input}

${c.expected ? `Expected output:\n${c.expected}\n` : ""}${c.rubric ? `Rubric:\n${c.rubric}\n` : ""}
Actual output:
${actual}

Pass threshold: ${passThreshold}. Return {"score": 0-100, "passed": boolean, "reasoning": "1-2 sentences"}.`;
}

function parseJudge(text: string): { score: number; passed: boolean; reasoning: string } {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    const j = JSON.parse(cleaned);
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
    return {
      score,
      passed: typeof j.passed === "boolean" ? j.passed : score >= 70,
      reasoning: String(j.reasoning ?? "").slice(0, 2000),
    };
  } catch {
    // Fallback: try to extract first number
    const m = text.match(/\b(\d{1,3})\b/);
    const score = m ? Math.min(100, parseInt(m[1], 10)) : 0;
    return { score, passed: score >= 70, reasoning: text.slice(0, 500) };
  }
}

export async function runEvalSuite(
  supabase: SupabaseClient,
  userId: string,
  suiteId: string,
  trigger: "manual" | "scheduled" = "manual",
): Promise<{
  run_id: string;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  avg_score: number | null;
}> {
  // Load suite
  const { data: suiteRow, error: sErr } = await supabase
    .from("eval_suites")
    .select("id,user_id,name,surface,prompt_key,model,judge_model,pass_threshold")
    .eq("id", suiteId)
    .eq("user_id", userId)
    .single();
  if (sErr || !suiteRow) throw new Error(sErr?.message ?? "Suite not found");
  const suite = suiteRow as Suite;

  // Resolve active prompt version (for record-keeping)
  let promptVersionId: string | null = null;
  if (suite.prompt_key) {
    const { data: tpl } = await supabase
      .from("prompt_templates")
      .select("active_version_id")
      .eq("user_id", userId)
      .eq("surface", suite.surface)
      .eq("key", suite.prompt_key)
      .maybeSingle();
    promptVersionId =
      (tpl as { active_version_id: string | null } | null)?.active_version_id ?? null;
  }

  // Load enabled cases
  const { data: caseRows } = await supabase
    .from("eval_cases")
    .select("id,name,input,expected,rubric,weight,enabled")
    .eq("suite_id", suite.id)
    .eq("user_id", userId);
  const cases = ((caseRows ?? []) as Case[]).filter((c) => c.enabled !== false);

  const model = suite.model || "google/gemini-2.5-flash";
  const judgeModel = suite.judge_model || "google/gemini-2.5-flash";

  // Create run
  const { data: runRow, error: rErr } = await supabase
    .from("eval_runs")
    .insert({
      user_id: userId,
      suite_id: suite.id,
      prompt_version_id: promptVersionId,
      model,
      judge_model: judgeModel,
      status: "running",
      trigger,
      total_cases: cases.length,
    })
    .select("id")
    .single();
  if (rErr || !runRow) throw new Error(rErr?.message ?? "Failed to create run");
  const runId = (runRow as { id: string }).id;

  let passed = 0,
    failed = 0,
    errored = 0;
  const scores: number[] = [];
  let totalCost = 0,
    totalLatency = 0;

  for (const c of cases) {
    try {
      // 1. Subject call — uses prompt template via promptKey
      const subject = await callModel(supabase, userId, {
        surface: "eval",
        surface_ref: c.id,
        model,
        messages: [{ role: "user", content: c.input }],
        promptKey: suite.prompt_key ?? undefined,
        guardrails: false,
        maxRetries: 1,
      });

      if (subject.status !== "ok") {
        await supabase.from("eval_case_results").insert({
          run_id: runId,
          case_id: c.id,
          user_id: userId,
          status: "error",
          actual: subject.output ?? null,
          ai_event_id: subject.eventId,
          error: subject.error ?? "Subject call failed",
          prompt_tokens: subject.prompt_tokens,
          completion_tokens: subject.completion_tokens,
          cost_usd: subject.est_cost_usd,
          latency_ms: subject.latency_ms,
        });
        errored++;
        totalCost += subject.est_cost_usd || 0;
        totalLatency += subject.latency_ms || 0;
        continue;
      }

      // 2. Judge call
      const judge = await callModel(supabase, userId, {
        surface: "judge",
        surface_ref: c.id,
        model: judgeModel,
        messages: [
          { role: "system", content: JUDGE_SYSTEM },
          { role: "user", content: buildJudgePrompt(c, subject.output, suite.pass_threshold) },
        ],
        responseFormat: "json_object",
        guardrails: false,
        maxRetries: 1,
      });

      const verdict = parseJudge(judge.output);
      const isPassed = verdict.score >= suite.pass_threshold;
      if (isPassed) passed++;
      else failed++;
      scores.push(verdict.score);

      const caseCost = (subject.est_cost_usd || 0) + (judge.est_cost_usd || 0);
      const caseLatency = (subject.latency_ms || 0) + (judge.latency_ms || 0);
      totalCost += caseCost;
      totalLatency += caseLatency;

      await supabase.from("eval_case_results").insert({
        run_id: runId,
        case_id: c.id,
        user_id: userId,
        status: isPassed ? "passed" : "failed",
        actual: subject.output,
        score: verdict.score,
        passed: isPassed,
        judge_reasoning: verdict.reasoning,
        ai_event_id: subject.eventId,
        judge_event_id: judge.eventId,
        prompt_tokens: subject.prompt_tokens,
        completion_tokens: subject.completion_tokens,
        cost_usd: caseCost,
        latency_ms: caseLatency,
      });
    } catch (e: unknown) {
      errored++;
      await supabase.from("eval_case_results").insert({
        run_id: runId,
        case_id: c.id,
        user_id: userId,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  await supabase
    .from("eval_runs")
    .update({
      status: errored === cases.length && cases.length > 0 ? "error" : "completed",
      pass_count: passed,
      fail_count: failed,
      errored,
      avg_score: avgScore,
      total_cost_usd: totalCost,
      total_latency_ms: totalLatency,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  await supabase
    .from("eval_suites")
    .update({
      last_run_at: new Date().toISOString(),
    })
    .eq("id", suite.id);

  return { run_id: runId, total: cases.length, passed, failed, errored, avg_score: avgScore };
}

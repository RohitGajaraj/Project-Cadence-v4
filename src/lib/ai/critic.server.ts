/**
 * Critic (DEC-02 opportunities · DEF-03 specs) — shared server-only logic.
 *
 * Extracted from discovery.functions.ts (DEC-02-LOOP) so the Critic is callable
 * from BOTH the inline promotion/spec paths AND the agent loop as a routable
 * tool (`critic.evaluate`, registered in tools/registry.server.ts). The verdict
 * is advisory and side-effect-free beyond persisting the row's own
 * `critic_review` column, which is why the registered tool is gating-exempt.
 *
 * `.server.ts` — runs only in the Worker; never bundled to the client.
 */
import { callModel } from "@/lib/ai/runtime.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CriticReview = {
  verdict: "ship" | "revise" | "kill";
  summary: string;
  risks: string[];
  kill_criteria: string[];
  missing_evidence: string[];
  confidence: number;
  reviewer_model: string;
  reviewed_at: string;
};

/**
 * Run the Critic agent against an opportunity or PRD. Persists the verdict
 * on the row's `critic_review jsonb` column. Called inline from
 * `promoteThemeToOpportunity` / `promoteSignalToOpportunity` / `generatePrd`
 * so the verdict is present the first time the operator sees the row.
 * Failures are swallowed: a missing Critic must never block the upstream
 * write.
 */
export async function runCritic(
  supabase: SupabaseClient,
  userId: string,
  target: { kind: "opportunity" | "prd"; id: string },
): Promise<CriticReview | null> {
  const table = target.kind === "opportunity" ? "opportunities" : "prds";
  const { data: row } = await supabase.from(table).select("*").eq("id", target.id).single();
  if (!row) return null;

  const subject =
    target.kind === "opportunity"
      ? `OPPORTUNITY
Title: ${row.title}
Problem: ${row.problem ?? ""}
Target user: ${row.target_user ?? "—"}
Hypothesis: ${row.hypothesis ?? "—"}
ICE — Impact:${row.impact} Confidence:${row.confidence} Ease:${row.ease}`
      : `SPEC
Title: ${row.title}
Body:
${(row.body_md ?? "").slice(0, 6000)}`;

  // DEF-03: specs get a SPEC-specific red-team lens (ambiguity · untestable
  // criteria · scope creep · unstated assumptions · missing edge cases);
  // opportunities keep the DEC-02 bet-evaluation lens. Both map onto the same
  // CriticReview fields (the badge relabels them per kind).
  const system =
    target.kind === "prd"
      ? `You are the Critic agent doing a pre-review RED TEAM of a product SPEC (PRD) before a human approves it for build. Judge it like an engineer + PM would: is it unambiguous, testable, and scoped?
Evaluate the spec specifically for:
- AMBIGUITY — requirements that read two ways; vague terms ("fast", "intuitive", "etc.") with no definition.
- UNTESTABLE / UNMEASURABLE acceptance criteria — success conditions a QA engineer couldn't verify pass/fail.
- SCOPE CREEP — work beyond the stated problem/opportunity, or that could be cut without losing the core.
- UNSTATED ASSUMPTIONS & DEPENDENCIES — what must already be true or built first that the spec never names.
- MISSING EDGE CASES — error / empty / loading / permission / concurrency states the spec ignores.
Return STRICT JSON only:
{"verdict":"ship|revise|kill","summary":"max 240 chars","risks":["ambiguity / scope / dependency / edge-case — quote the spec where useful"],"kill_criteria":["what makes this spec un-shippable AS WRITTEN"],"missing_evidence":["untestable/unmeasurable acceptance criteria, unstated assumptions, and open questions to resolve before build"],"confidence":0.0-1.0}
Be specific and quote the spec. No filler. Only judge what the spec actually says — do not invent requirements. "ship" only when the spec is clear, testable, and scoped; "kill" when it is fundamentally unbuildable as framed; "revise" otherwise.`
      : `You are the Critic agent. Red-team the proposal before a human approves it.
Return STRICT JSON only:
{"verdict":"ship|revise|kill","summary":"max 240 chars","risks":["..."],"kill_criteria":["..."],"missing_evidence":["..."],"confidence":0.0-1.0}
Be specific. No filler. Use "ship" only when risks are bounded and evidence is strong; "kill" when the bet is unsalvageable; "revise" otherwise.`;

  const model = "google/gemini-2.5-pro";
  try {
    const result = await callModel(supabase, userId, {
      surface: "judge",
      surface_ref: `critic:${target.kind}:${target.id}`,
      model,
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: subject },
      ],
    });
    const parsed = (result.json ?? {}) as Partial<CriticReview>;
    const verdict =
      parsed.verdict === "ship" || parsed.verdict === "kill" || parsed.verdict === "revise"
        ? parsed.verdict
        : "revise";
    const review: CriticReview = {
      verdict,
      summary: (parsed.summary ?? "").slice(0, 280),
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 8).map(String) : [],
      kill_criteria: Array.isArray(parsed.kill_criteria)
        ? parsed.kill_criteria.slice(0, 6).map(String)
        : [],
      missing_evidence: Array.isArray(parsed.missing_evidence)
        ? parsed.missing_evidence.slice(0, 6).map(String)
        : [],
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      reviewer_model: model,
      reviewed_at: new Date().toISOString(),
    };
    await supabase.from(table).update({ critic_review: review }).eq("id", target.id);
    return review;
  } catch {
    return null;
  }
}

/**
 * Routable-tool adapter (DEC-02-LOOP). Lets the agent loop call the Critic as
 * `critic.evaluate` against an opportunity or PRD. Never throws — preserves the
 * "a missing Critic never blocks" contract — returning `{ ok, review }` so the
 * caller (orchestrator/specialist) can read the verdict and decide for itself.
 * The verdict is advisory: it must never auto-fail dependent work.
 */
export async function runCriticTool(
  args: { target_kind: "opportunity" | "prd"; target_id: string },
  ctx: { supabase: SupabaseClient; userId: string },
): Promise<{ ok: boolean; review: CriticReview | null }> {
  const review = await runCritic(ctx.supabase, ctx.userId, {
    kind: args.target_kind,
    id: args.target_id,
  });
  return { ok: review !== null, review };
}

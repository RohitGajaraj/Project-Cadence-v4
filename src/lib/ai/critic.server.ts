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
import { formatDecisionPrecedent, type DecisionPrecedentRow } from "@/lib/ai/outcome-memory";
import { loadDecisionPrecedent, type PrecedentMatch } from "@/lib/ai/decision-precedent.server";
import {
  selectContradictionHistory,
  formatContradictionHistory,
} from "@/lib/ai/contradiction-history";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";
import { resolveLineageCols } from "@/lib/knowledge-graph-view.functions";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DBR-2 loader: fetch the workspace's supersedes/contradicts edges that touch any of
 * the focus artifact ids (the decision under review + its semantically-similar
 * precedents). `.server`-only. Migration-tolerant: reuses `resolveLineageCols` to read
 * `valid_to` when the DBR-1.5 column is live (so the pure core's current-before-retired
 * ranking and the "later reversed" framing become real) and to fall back to the base
 * columns pre-migration (a 42703 can never empty the result). Newest-first ordering so
 * the `.limit(50)` window is the most recent edges, not an arbitrary slice. Fail-safe:
 * returns [] on any error (the Critic must never break on a missing/odd graph). Only
 * uuid-shaped ids reach the PostgREST `.or(... in ...)` filter, so it can never be
 * filter-injected.
 */
async function loadContradictionEdges(
  supabase: SupabaseClient,
  userId: string,
  focusIds: string[],
): Promise<RawLineageEdge[]> {
  const ids = Array.from(new Set(focusIds.filter((id) => UUID_RE.test(id))));
  if (!ids.length) return [];
  try {
    const cols = await resolveLineageCols(supabase);
    const list = ids.join(",");
    const { data, error } = await supabase
      .from("artifact_lineage")
      .select(cols)
      .eq("user_id", userId)
      .in("relation", ["supersedes", "contradicts"])
      .or(`parent_id.in.(${list}),child_id.in.(${list})`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as unknown as RawLineageEdge[];
  } catch {
    return [];
  }
}

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

  // DBR / Ambient Precedent: semantic precedent over the workspace's past outcomes.
  const precedentRows = await loadDecisionPrecedent(supabase, {
    userId,
    workspaceId: (row.workspace_id as string | null) ?? null,
    text: subject,
    excludeId: undefined,
  });
  const precedent = formatDecisionPrecedent(precedentRows as DecisionPrecedentRow[]);

  // DBR-2: the Critic also reasons over the typed decision GRAPH, not just flat
  // precedent. Surface outcome-labeled supersedes/contradicts edges bearing on this
  // decision OR on the semantically-similar precedents (their prd/opportunity ids),
  // so it can cite "a decision like this was contradicted by a later outcome", which
  // the query flat RAG cannot answer. Best-effort + fail-safe: any failure yields "" and
  // the Critic is byte-identical (and stays so until the decision graph has edges).
  let contradictions = "";
  try {
    const matches = precedentRows as PrecedentMatch[];
    const focusIds = [target.id, ...matches.flatMap((m) => [m.prdId ?? "", m.opportunityId ?? ""])];
    const edges = await loadContradictionEdges(supabase, userId, focusIds);
    contradictions = formatContradictionHistory(
      selectContradictionHistory(edges, focusIds, { targetId: target.id }),
    );
  } catch {
    contradictions = "";
  }

  const blocks = [precedent, contradictions].filter(Boolean);
  const userContent = blocks.length ? `${subject}\n\n${blocks.join("\n\n")}` : subject;
  const guidance = [
    precedent
      ? 'If a "Decision precedent" block is present, weigh it: cite a relevant past outcome (especially a MISSED one) in risks or missing_evidence when it bears on this judgment.'
      : "",
    contradictions
      ? 'If a "Contradiction history" block is present, it lists this workspace\'s OWN outcome-labeled supersedes/contradicts edges: treat a prior decision that a later outcome CONTRADICTED or SUPERSEDED as strong evidence against repeating its reasoning. Entries are ordered most-relevant first (edges on this exact decision before ones on merely similar past decisions); weigh how directly each bears on the decision under review, and cite the relevant ones in risks or missing_evidence.'
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const systemContent = guidance ? `${system}\n${guidance}` : system;

  const model = "google/gemini-2.5-pro";
  try {
    const result = await callModel(supabase, userId, {
      surface: "judge",
      surface_ref: `critic:${target.kind}:${target.id}`,
      model,
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
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

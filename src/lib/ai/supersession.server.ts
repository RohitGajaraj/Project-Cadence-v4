/**
 * Supersession engine — gated write orchestrator (Decision Brain, DBR-1.5).
 *
 * .server.ts — Worker-only; never bundled to the client.
 *
 * Flag-gated OFF by default (DECISION_BRAIN_SUPERSESSION). When the founder enables it,
 * each recorded outcome: finds the account's most similar prior decisions (one embed via
 * the already-shipped loadDecisionPrecedent), classifies verdict conflicts (PURE), and
 * writes typed supersedes/contradicts edges into artifact_lineage with bi-temporal
 * provenance — invalidate-don't-delete, NEVER mutating a promoted/human edge.
 *
 * Fail-safe: the whole orchestrator is wrapped so it can never throw into recordOutcome
 * (mirrors rememberOutcome's "never let a memory write break the outcome").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDecisionPrecedent } from "./decision-precedent.server";
import { SUPERSESSION_AGENT, buildSupersessionEdge, selectSupersessions } from "./supersession";
import { SUPERSESSION_TENTATIVE_FLOOR } from "./supersession-confidence";

/** The feature_flags key the activation gate reads (operator flips it with one SQL upsert). */
export const SUPERSESSION_FLAG_KEY = "decision_brain_supersession";

/**
 * AI-spend / activation gate. DB-backed via the feature_flags get_flag RPC — the same idiom as
 * credits_enabled() / limit_gates_enabled() — so an operator can flip the moat's signature
 * mechanic live with one SQL statement and NO redeploy (a Worker env var would need both infra
 * access and a deploy). The env var stays a hard override: an explicit value wins (tests + an
 * emergency kill switch). Default OFF, and fail-safe — any DB error reads as OFF, so a flaky DB
 * can never silently arm edge-writing. inferSupersession's first line awaits this, so a disabled
 * flag means zero embed, zero write, and a byte-identical recordOutcome.
 */
export async function supersessionEnabled(supabase?: SupabaseClient): Promise<boolean> {
  // 1) Env override: an explicit value always wins (test harness + emergency kill).
  const env = process.env.DECISION_BRAIN_SUPERSESSION;
  if (env === "1" || env === "true") return true;
  if (env === "0" || env === "false") return false;
  // 2) DB-backed flag (the live, no-redeploy toggle). Fail-safe OFF.
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc(
      "get_flag" as never,
      { _key: SUPERSESSION_FLAG_KEY } as never,
    );
    if (error) return false;
    const row = Array.isArray(data) ? data[0] : data;
    return !!(row && (row as { enabled?: boolean }).enabled);
  } catch {
    return false;
  }
}

/**
 * Best-effort, flag-gated supersession-edge inference for one recorded outcome.
 * Never throws (returns void on any path). No-op when the flag is off OR when there is
 * no decision text / no similar prior decisions / no verdict conflict.
 */
export async function inferSupersession(
  supabase: SupabaseClient,
  args: {
    userId: string;
    // The workspace the recorded outcome lives in. Threaded so every engine-written edge is
    // tenant-correct; without it the artifact_lineage default forced edges into the inserting
    // user's DEFAULT workspace, hiding them from the workspace-scoped read surfaces.
    workspaceId?: string | null;
    prdId: string | null;
    opportunityId: string | null;
    text: string;
    verdict: string;
    summary?: string | null;
    learningId?: string | null;
    memoryId?: string | null;
    aiEventId?: string | null;
  },
): Promise<void> {
  // Dormant by default: this MUST be the first statement so a disabled flag means zero
  // embed spend, zero DB write, and a byte-identical recordOutcome.
  if (!(await supersessionEnabled(supabase))) return;

  try {
    const text = args.text?.trim();
    if (!text) return;

    // The ONLY AI cost: one embedOne inside loadDecisionPrecedent (surface "embed").
    // It already excludes non-outcome rows and is fail-safe (returns [] on any error).
    // excludeId drops THIS outcome's own just-written memory (rememberOutcome runs first),
    // so the self-row can't crowd a real prior decision out of the small candidate budget.
    const candidates = await loadDecisionPrecedent(supabase, {
      userId: args.userId,
      workspaceId: null,
      text,
      excludeId: args.memoryId ?? undefined,
    });
    if (!candidates.length) return;

    const selected = selectSupersessions(
      { prdId: args.prdId, opportunityId: args.opportunityId, verdict: args.verdict },
      candidates.map((c) => ({
        prdId: c.prdId,
        opportunityId: c.opportunityId,
        verdict: c.verdict,
        score: c.score,
      })),
      // Edge-confidence precision (DBR-EDGE-CONF): drop the marginal edges before they are ever
      // written, so the first edges the Critic cites are trustworthy and the graph cannot rot
      // with confident-but-false "this was contradicted" links.
      { minConfidence: SUPERSESSION_TENTATIVE_FLOOR },
    );
    if (!selected.length) return;

    const now = new Date().toISOString();

    for (const s of selected) {
      const edge = buildSupersessionEdge({
        userId: args.userId,
        workspaceId: args.workspaceId ?? null,
        parent: s.parent,
        child: s.child,
        relation: s.relation,
        verdict: args.verdict,
        score: s.score,
        summary: args.summary ?? null,
        aiEventId: args.aiEventId ?? null,
        // Persist the confidence provenance so the read side (Critic, canvas) can prefer
        // strong edges and a future tuning pass can audit precision on real data.
        confidence: s.confidence,
        tier: s.tier,
        reasons: s.reasons,
      });

      // 1) Write the typed edge. Idempotent on the unique key (incl. relation), so a
      //    re-recorded outcome upserts the same row rather than duplicating.
      await supabase.from("artifact_lineage").upsert(edge, {
        onConflict: "user_id,parent_kind,parent_id,child_kind,child_id,relation",
      });

      // 2) Invalidate-don't-delete: retire any still-valid supersession-engine edge for
      //    the REVERSE pair (prior --rel--> new) — the prior assertion this new verdict
      //    overturns. Scoped to our OWN agent's edges + valid_to IS NULL, so it can never
      //    mutate a promoted/human edge and re-running it no-ops (idempotent).
      await supabase
        .from("artifact_lineage")
        .update({ valid_to: now, invalidated_by: args.learningId ?? null })
        .eq("user_id", args.userId)
        .eq("parent_kind", s.child.kind)
        .eq("parent_id", s.child.id)
        .eq("child_kind", s.parent.kind)
        .eq("child_id", s.parent.id)
        .eq("created_by_agent", SUPERSESSION_AGENT)
        .is("valid_to", null);
    }
  } catch (e) {
    // Belt-and-suspenders: never let edge inference break the recorded outcome.
    console.error("inferSupersession failed (non-fatal):", e);
  }
}

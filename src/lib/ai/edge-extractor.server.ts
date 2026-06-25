/**
 * Edge extractor — server orchestrator (DBR-3i).
 *
 * Writes the direct validates/contradicts edge between a PRD and its opportunity
 * when an outcome lands. Fail-safe: never throws into the caller (recordOutcome).
 * Idempotent via the artifact_lineage unique key on
 * (user_id, parent_kind, parent_id, child_kind, child_id, relation).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOutcomeEdge } from "./edge-extractor";

export async function inferDirectEdge(
  supabase: SupabaseClient,
  params: {
    userId: string;
    prdId: string;
    opportunityId: string | null;
    verdict: string;
  },
): Promise<void> {
  const edge = buildOutcomeEdge(params);
  if (!edge) return;
  await supabase.from("artifact_lineage").upsert(
    {
      user_id: params.userId,
      parent_kind: edge.parent_kind,
      parent_id: edge.parent_id,
      child_kind: edge.child_kind,
      child_id: edge.child_id,
      relation: edge.relation,
      rationale: edge.rationale,
      created_by_agent: edge.created_by_agent,
    },
    { onConflict: "user_id,parent_kind,parent_id,child_kind,child_id,relation" },
  );
}

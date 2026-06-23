/**
 * LOOP-PROVE (v11 #5) — server adapter for the decision-loop closure proof.
 *
 * Thin DB-to-helper bridge: loads this workspace's decisions, learnings, and bitemporal
 * lineage (RLS-scoped, same loaders the Brain + Trust Ledger use), then hands them to the
 * PURE `computeLoopClosure` proof. The handler holds no loop logic — the assertion lives in
 * `loop-closure.ts` so it is unit-verifiable and can never drift from the engine it proves.
 *
 * `getLoopClosure` is the diagnostic behind "prove the loop closes on real data": a surface
 * (or a founder spot-check) calls it and `closed === true` is the live proof; otherwise
 * `gaps` names the cold stage. NO migration, NO AI/chokepoint — existing data only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeLoopClosure, type LoopClosureReport } from "@/lib/moat/loop-closure";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";

const Schema = z.object({ workspaceId: z.string().uuid().optional() }).strip();

const EMPTY: LoopClosureReport = {
  closed: false,
  warmth: "cold",
  counts: {
    decisions: 0,
    outcomesRecorded: 0,
    supersessionEdges: 0,
    contradictionEdges: 0,
    governingResolutions: 0,
  },
  chains: [],
  gaps: ["No workspace context — nothing to prove."],
};

export const getLoopClosure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<LoopClosureReport> => {
    const supabase = context.supabase as SupabaseClient;
    let workspaceId = data?.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    if (!workspaceId) return EMPTY;

    const [decisionsRes, learningsRes] = await Promise.all([
      supabase.from("decisions").select("id").eq("workspace_id", workspaceId).limit(2000),
      supabase.from("learnings").select("verdict").eq("workspace_id", workspaceId).limit(2000),
    ]);
    if (decisionsRes.error) throw new Error(decisionsRes.error.message);
    if (learningsRes.error) throw new Error(learningsRes.error.message);

    // Bitemporal lineage, with the pre-migration `valid_to` fallback so the proof never
    // errors to empty on a graph that predates the column (same guard as brain-insights).
    let edges: RawLineageEdge[] = [];
    {
      const run = (sel: string) =>
        supabase.from("artifact_lineage").select(sel).eq("workspace_id", workspaceId).limit(5000);
      const full =
        "id,parent_kind,parent_id,child_kind,child_id,relation,rationale,created_at,valid_to";
      let res = await run(full);
      const m = (res.error?.message ?? "").toLowerCase();
      if (res.error && m.includes("does not exist") && m.includes("valid_to")) {
        res = await run(
          "id,parent_kind,parent_id,child_kind,child_id,relation,rationale,created_at",
        );
      }
      if (!res.error) edges = (res.data ?? []) as unknown as RawLineageEdge[];
    }

    return computeLoopClosure({
      edges,
      decisions: (decisionsRes.data ?? []) as { id: string }[],
      learnings: (learningsRes.data ?? []) as { verdict: string | null }[],
    });
  });

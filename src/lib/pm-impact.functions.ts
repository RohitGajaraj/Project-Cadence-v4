/**
 * PM-IMPACT-LEDGER (v11 #18) — server adapter for the PM's portable track record.
 *
 * Thin DB-to-helper bridge: loads this workspace's decisions + recorded outcomes + the
 * bitemporal lineage (RLS-scoped, the same loaders the Brain + Trust Ledger use), derives
 * the superseded-decision set, then hands primitives to the PURE `computeImpactLedger` and
 * returns both the structured ledger and the rendered, copy-anywhere Markdown artifact.
 * The handler holds no aggregation logic — that lives in `pm-impact.ts` so it is unit-tested
 * and cannot drift. NO migration, NO AI/chokepoint — existing data only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supersededChildIds, type LineageEdgeLite } from "@/lib/trust-ledger.functions";
import {
  computeImpactLedger,
  renderImpactMarkdown,
  type ImpactLedger,
  type ImpactDecisionRow,
  type ImpactLearningRow,
} from "@/lib/pm-impact";

const Schema = z
  .object({ workspaceId: z.string().uuid().optional(), name: z.string().max(120).optional() })
  .strip();

export type ImpactLedgerResult = {
  ledger: ImpactLedger;
  /** The portable artifact (Markdown), pre-rendered server-side. */
  markdown: string;
  workspaceName: string | null;
};

const EMPTY_LEDGER = computeImpactLedger({});

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getImpactLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<ImpactLedgerResult> => {
    const supabase = context.supabase as SupabaseClient;
    let workspaceId = data?.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    if (!workspaceId) {
      return {
        ledger: EMPTY_LEDGER,
        markdown: renderImpactMarkdown(EMPTY_LEDGER, { name: data?.name ?? null, asOf: isoDate() }),
        workspaceName: null,
      };
    }

    const [decisionsRes, learningsRes, wsRes] = await Promise.all([
      supabase
        .from("decisions")
        .select("id,status,created_at,decided_by_agent_slug")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("learnings")
        .select("verdict,prior_ice,new_ice,metric_label,metric_value,summary,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    ]);
    if (decisionsRes.error) throw new Error(decisionsRes.error.message);
    if (learningsRes.error) throw new Error(learningsRes.error.message);

    // Bitemporal lineage for supersession, with the pre-migration `valid_to` fallback so the
    // record never errors to empty on a graph that predates the column.
    let edges: LineageEdgeLite[] = [];
    {
      const run = (sel: string) =>
        supabase.from("artifact_lineage").select(sel).eq("workspace_id", workspaceId).limit(5000);
      let res = await run("parent_kind,parent_id,child_kind,child_id,relation,valid_to");
      const m = (res.error?.message ?? "").toLowerCase();
      if (res.error && m.includes("does not exist") && m.includes("valid_to")) {
        res = await run("parent_kind,parent_id,child_kind,child_id,relation");
      }
      if (!res.error) edges = (res.data ?? []) as unknown as LineageEdgeLite[];
    }
    const supersededDecisionIds = new Set(supersededChildIds(edges).keys());

    const ledger = computeImpactLedger({
      decisions: (decisionsRes.data ?? []) as ImpactDecisionRow[],
      learnings: (learningsRes.data ?? []) as ImpactLearningRow[],
      supersededDecisionIds,
    });

    const workspaceName = ((wsRes.data as { name?: string | null } | null)?.name ?? null) || null;
    const markdown = renderImpactMarkdown(ledger, {
      name: data?.name ?? null,
      workspace: workspaceName,
      asOf: isoDate(),
    });

    return { ledger, markdown, workspaceName };
  });

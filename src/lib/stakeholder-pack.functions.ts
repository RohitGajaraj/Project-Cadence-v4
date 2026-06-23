/**
 * STAKEHOLDER-PACK (v11 #19) — server adapter for audience-tuned persuasion artifacts.
 *
 * Loads a decision + the receipts it already has (lineage evidence + bitemporal standing +
 * any recorded outcome), builds a normalized brief, and hands it to the PURE composer to
 * produce the exec / eng / board packs (structured + pre-rendered Markdown). Reuses the Trust
 * Ledger's `evidenceCounts` / `supersededChildIds` so "evidence" and "standing" mean the same
 * thing everywhere. The handler holds no framing logic — that lives in `stakeholder-pack.ts`.
 * NO migration, NO AI/chokepoint — existing data only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  evidenceCounts,
  supersededChildIds,
  type LineageEdgeLite,
} from "@/lib/trust-ledger.functions";
import {
  composeAllPacks,
  renderPackMarkdown,
  PACK_AUDIENCES,
  type DecisionBrief,
  type PackAudience,
  type StakeholderPack,
} from "@/lib/stakeholder-pack";

const Schema = z.object({ decisionId: z.string().uuid().optional() }).strip();

type DecisionRow = {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
  source_kind: string | null;
  prd_id: string | null;
  opportunity_id: string | null;
  decided_by_agent_slug: string | null;
  created_at: string;
};

export type RenderedPack = { pack: StakeholderPack; markdown: string };

export type StakeholderPackResult = {
  /** Recent decisions for the picker (newest first). */
  decisions: { id: string; title: string }[];
  /** The selected decision's brief + all three rendered packs, or null when none exist. */
  selected:
    | { decisionId: string; brief: DecisionBrief; packs: Record<PackAudience, RenderedPack> }
    | null;
};

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function labelSource(kind: string | null): string | null {
  if (!kind || !kind.trim()) return null;
  const k = kind.trim();
  const map: Record<string, string> = {
    mission: "a mission",
    prd: "a PRD",
    meeting: "a meeting",
    opportunity: "an opportunity",
  };
  return map[k] ?? `a ${k}`;
}

export const getStakeholderPack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<StakeholderPackResult> => {
    const supabase = context.supabase as SupabaseClient;
    const { data: wsRpc } = await supabase.rpc("current_user_default_workspace");
    const workspaceId = (wsRpc as string | null) ?? null;
    if (!workspaceId) return { decisions: [], selected: null };

    const cols = "id,title,rationale,status,source_kind,prd_id,opportunity_id,decided_by_agent_slug,created_at";
    const { data: decRows, error: decErr } = await supabase
      .from("decisions")
      .select(cols)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (decErr) throw new Error(decErr.message);
    const decisions = (decRows ?? []) as DecisionRow[];
    if (decisions.length === 0) return { decisions: [], selected: null };

    const wantId = data?.decisionId ?? null;
    const selectedRow = (wantId && decisions.find((d) => d.id === wantId)) || decisions[0];

    // Lineage for evidence + supersession standing, with the pre-migration valid_to fallback.
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
    const evidence = evidenceCounts(edges);
    const superseded = supersededChildIds(edges);

    // A recorded outcome linked to the selected decision (by prd or opportunity), if any.
    let verdict: string | null = null;
    let metricLabel: string | null = null;
    let metricValue: string | null = null;
    const linkFilter = selectedRow.prd_id
      ? { col: "prd_id", val: selectedRow.prd_id }
      : selectedRow.opportunity_id
        ? { col: "opportunity_id", val: selectedRow.opportunity_id }
        : null;
    if (linkFilter) {
      const { data: lrn } = await supabase
        .from("learnings")
        .select("verdict,metric_label,metric_value,created_at")
        .eq("workspace_id", workspaceId)
        .eq(linkFilter.col, linkFilter.val)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (lrn ?? [])[0] as
        | { verdict: string | null; metric_label: string | null; metric_value: string | null }
        | undefined;
      if (row) {
        verdict = row.verdict ?? null;
        metricLabel = row.metric_label ?? null;
        metricValue = row.metric_value ?? null;
      }
    }

    const brief: DecisionBrief = {
      title: selectedRow.title,
      rationale: selectedRow.rationale,
      status: selectedRow.status,
      actor: selectedRow.decided_by_agent_slug,
      humanDecided: !(
        typeof selectedRow.decided_by_agent_slug === "string" &&
        selectedRow.decided_by_agent_slug.trim()
      ),
      occurredAt: selectedRow.created_at,
      sourceLabel: labelSource(selectedRow.source_kind),
      evidenceCount: evidence.get(selectedRow.id) ?? 0,
      outcome: superseded.has(selectedRow.id) ? "superseded" : "standing",
      verdict,
      metricLabel,
      metricValue,
    };

    const composed = composeAllPacks(brief);
    const asOf = isoDate();
    const packs = {} as Record<PackAudience, RenderedPack>;
    for (const a of PACK_AUDIENCES) {
      packs[a] = { pack: composed[a], markdown: renderPackMarkdown(composed[a], { asOf }) };
    }

    return {
      decisions: decisions.map((d) => ({ id: d.id, title: d.title })),
      selected: { decisionId: selectedRow.id, brief, packs },
    };
  });

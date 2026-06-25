/**
 * DBR-4: Decision-Brain graph tools for the MCP/A2A read surface.
 *
 * Exposes two graph-aware queries to external agents:
 *   get_governing_decision — "what is the CURRENT belief on X?" (not a stale one)
 *   get_contradiction_history — "has a decision like X ever been contradicted?"
 *
 * Both reuse the existing pure walk functions + DB loaders so the logic can
 * never drift from what the in-product Critic uses.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoverningForNodes } from "./governing-decision.server";
import { selectContradictionHistory } from "./contradiction-history";
import { resolveLineageCols } from "@/lib/knowledge-graph-view.functions";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";
import { sanitizeIlikeQuery } from "@/lib/mcp.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ──────────────────────────────────────────────────────────────────────────────
// Shared: search decisions by workspace + topic
// ──────────────────────────────────────────────────────────────────────────────

async function searchDecisionsByTopic(
  supabase: SupabaseClient,
  workspace_id: string,
  topic: string,
  limit: number,
): Promise<Array<{ id: string; title: string; rationale: string | null; status: string | null }>> {
  let q = supabase
    .from("decisions")
    .select("id, title, rationale, status")
    .eq("workspace_id", workspace_id);

  const safe = sanitizeIlikeQuery(topic);
  if (safe) q = q.or(`title.ilike.%${safe}%,rationale.ilike.%${safe}%`);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data as Array<{
    id: string;
    title: string;
    rationale: string | null;
    status: string | null;
  }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// get_governing_decision
// ──────────────────────────────────────────────────────────────────────────────

export type GoverningDecisionResult = {
  topic: string;
  decisions: Array<{
    id: string;
    title: string;
    status: string | null;
    is_current: boolean;
    superseded_by?: { id: string; title: string } | null;
    contradicted: boolean;
  }>;
};

/**
 * For a topic query, return the workspace's decisions on that topic and mark
 * which are CURRENT vs stale (superseded/contradicted). Stale items include
 * the governing replacement so the caller can cite the right one.
 *
 * Fail-safe: any graph-walk error returns the raw search results marked as
 * current (no worse than search_decisions without the walk).
 */
export async function getGoverningDecision(
  supabase: SupabaseClient,
  workspace_id: string,
  user_id: string,
  topic: string,
  limit: number = 10,
): Promise<GoverningDecisionResult> {
  const rows = await searchDecisionsByTopic(supabase, workspace_id, topic, limit);
  if (!rows.length) return { topic, decisions: [] };

  const nodes = rows
    .filter((r) => UUID_RE.test(r.id))
    .map((r) => ({ id: r.id, kind: "decision" as const }));

  let governing: Awaited<ReturnType<typeof resolveGoverningForNodes>> = [];
  try {
    governing = await resolveGoverningForNodes(supabase, user_id, nodes);
  } catch {
    // fail-safe: return results without governing walk
  }

  const staleById = new Map(governing.map((g) => [g.fromId, g]));

  const decisions = rows.map((r) => {
    const g = staleById.get(r.id);
    if (!g || (!g.superseded && !g.contradicted)) {
      return { id: r.id, title: r.title, status: r.status, is_current: true, contradicted: false };
    }
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      is_current: false,
      superseded_by:
        g.superseded && g.governingId !== r.id
          ? { id: g.governingId, title: g.governingTitle ?? g.governingId }
          : null,
      contradicted: g.contradicted,
    };
  });

  return { topic, decisions };
}

// ──────────────────────────────────────────────────────────────────────────────
// get_contradiction_history
// ──────────────────────────────────────────────────────────────────────────────

export type ContradictionHistoryResult = {
  topic: string;
  decision_ids_searched: string[];
  history: Array<{
    relation: "supersedes" | "contradicts";
    parent_id: string;
    child_id: string;
    rationale: string | null;
    retired: boolean;
    incident: boolean;
    created_at: string | null;
  }>;
};

/**
 * For a topic query, return the contradiction/supersession history of related
 * decisions. Useful for an agent to ask "has a bet like this ever been
 * contradicted?" before committing.
 *
 * Fail-safe: graph-walk errors return empty history (no worse than absence).
 */
export async function getContradictionHistory(
  supabase: SupabaseClient,
  workspace_id: string,
  user_id: string,
  topic: string,
  limit: number = 10,
): Promise<ContradictionHistoryResult> {
  const rows = await searchDecisionsByTopic(supabase, workspace_id, topic, limit);
  const ids = rows.map((r) => r.id).filter((id) => UUID_RE.test(id));
  if (!ids.length) return { topic, decision_ids_searched: [], history: [] };

  let edges: RawLineageEdge[] = [];
  try {
    const cols = await resolveLineageCols(supabase);
    const list = ids.join(",");
    const { data, error } = await supabase
      .from("artifact_lineage")
      .select(cols)
      .eq("user_id", user_id)
      .in("relation", ["supersedes", "contradicts"])
      .or(`parent_id.in.(${list}),child_id.in.(${list})`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) edges = data as unknown as RawLineageEdge[];
  } catch {
    // fail-safe: return empty history
  }

  const items = selectContradictionHistory(edges, ids, { max: 20 });
  return {
    topic,
    decision_ids_searched: ids,
    history: items.map((it) => ({
      relation: it.relation,
      parent_id: it.parentId,
      child_id: it.childId,
      rationale: it.rationale,
      retired: it.retired,
      incident: it.incident,
      created_at: it.createdAt,
    })),
  };
}

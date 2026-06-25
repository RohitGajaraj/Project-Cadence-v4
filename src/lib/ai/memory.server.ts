/**
 * Agent memory recall + use-tracking (v6 Phase 1).
 *
 * Shared by the planner/executor loop (prompt injection) and the deterministic
 * mission advance (handoff threading). `recallMemoryRefs` returns BOTH:
 *   - `lines`: human-readable memory strings for system-prompt injection, and
 *   - `refs`:  `{ id, summary }` for `HandoffPayload.memory_refs[]` + the
 *     `last_used_at` write-back — the seam through which compounding memory
 *     threads across mid-loop hops (v6 §5, Appendix D).
 *
 * Both source RPCs (`match_agent_memory`, `recent_agent_reflections`) already
 * return the memory `id` alongside `content`, so no schema change is needed to
 * populate the refs — Phase 0 (W5) added the contract field; this fills it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "@/lib/rag/embed.server";
import { OUTCOME_MEMORY_KIND } from "./outcome-memory";
import { entitlementsFor, normalizePlanTier } from "@/lib/entitlements";

export type MemoryRef = { id: string; summary?: string };
export type RecalledMemory = { lines: string[]; refs: MemoryRef[] };

const SUMMARY_LEN = 140;

/**
 * WM-F2: which account (if any) to pool recall across. Returns the account id when the
 * active workspace's account is on a paid tier (crossWorkspaceMemory) — so the agent
 * recalls decision memory compounded across ALL the account's workspaces (the moat
 * flywheel) — and null otherwise (free / single-workspace: recall stays scoped to the
 * active workspace, byte-identical to WM-F1). `entitlements.ts` is the single source of
 * truth for which tiers pool. Resolved INTERNALLY (not threaded through callers) so the
 * pooling is actually driven without touching every recall call site. Pre-publish-
 * tolerant: if the accounts schema (WM-M2) is not live yet, any read error degrades to
 * null, so recall never widens incorrectly.
 */
async function resolvePoolAccountId(
  supabase: SupabaseClient,
  workspaceId: string | null,
): Promise<string | null> {
  if (!workspaceId) return null;
  try {
    const ws = await supabase
      .from("workspaces")
      .select("account_id")
      .eq("id", workspaceId)
      .maybeSingle();
    const accountId = (ws.data as { account_id?: string } | null)?.account_id;
    if (ws.error || !accountId) return null;
    const acc = await supabase
      .from("accounts")
      .select("plan_tier")
      .eq("id", accountId)
      .maybeSingle();
    if (acc.error || !acc.data) return null;
    const tier = normalizePlanTier((acc.data as { plan_tier?: unknown }).plan_tier);
    return entitlementsFor(tier).crossWorkspaceMemory ? accountId : null;
  } catch {
    return null;
  }
}

/**
 * Recall memory for `agentSlug` relevant to `query`. Two sources, deduped by
 * content: semantic match across all memory kinds + the top recent reflections.
 * `opts.touch` writes `last_used_at = now()` on the recalled ids (decay input).
 */
export async function recallMemoryRefs(
  supabase: SupabaseClient,
  userId: string,
  agentSlug: string,
  query: string,
  // WM-F1: the ACTIVE workspace. Recall is scoped to it (a multi-workspace user
  // recalls only this workspace, not everything they own). null = no workspace
  // filter (legacy / single-workspace behavior). The recall RPCs treat a NULL
  // memory.workspace_id as global, so untagged rows stay recallable everywhere.
  // WM-F2: for paid accounts this widens to pool across the account's workspaces,
  // resolved internally from the workspace's account tier (see resolvePoolAccountId).
  workspaceId: string | null,
  opts?: { maxItems?: number; touch?: boolean },
): Promise<RecalledMemory> {
  const maxItems = opts?.maxItems ?? 8;
  const lines: string[] = [];
  const refs: MemoryRef[] = [];
  const seenContent = new Set<string>();
  const seenId = new Set<string>();
  const push = (id: unknown, content: unknown) => {
    if (typeof content !== "string") return;
    const t = content.trim();
    if (!t || seenContent.has(t)) return;
    seenContent.add(t);
    lines.push(t);
    if (typeof id === "string" && id && !seenId.has(id)) {
      seenId.add(id);
      refs.push({ id, summary: t.slice(0, SUMMARY_LEN) });
    }
  };

  // WM-F2: pool recall across the account's workspaces for paid tiers; null = single.
  const poolAccountId = await resolvePoolAccountId(supabase, workspaceId);

  try {
    const v = await embedOne(query, { supabase, userId, surfaceRef: "memory-recall" });
    const matchArgs = {
      query_embedding: v as unknown as string,
      for_user: userId,
      for_agent_slug: agentSlug,
      match_count: 5,
    };
    const baseArgs = { ...matchArgs, for_workspace: workspaceId };
    let res = await supabase.rpc(
      "match_agent_memory",
      poolAccountId ? { ...baseArgs, for_account: poolAccountId } : baseArgs,
    );
    // Pre-migration tolerance: PGRST202 means that overload does not exist yet (the
    // deploy window before the migration applies). Step the signature back so recall
    // never goes dark: drop for_account (pre-WM-F2), then for_workspace (pre-WM-F1).
    // Degrading a paid account to single-workspace recall in the window is safe — it
    // never WIDENS recall. Any OTHER error stays non-fatal with no fallback, so a
    // transient error can never silently widen recall. Post-migration none of this runs.
    if (res.error?.code === "PGRST202" && poolAccountId) {
      res = await supabase.rpc("match_agent_memory", baseArgs);
    }
    if (res.error?.code === "PGRST202") {
      res = await supabase.rpc("match_agent_memory", matchArgs);
    }
    (res.data ?? []).forEach((m: { id?: string; content: string }) => push(m.id, m.content));
  } catch {
    /* embed/RPC failure is non-fatal */
  }

  try {
    const reflArgs = { for_user: userId, for_agent_slug: agentSlug, match_count: 3 };
    const baseRefl = { ...reflArgs, for_workspace: workspaceId };
    let res = await supabase.rpc(
      "recent_agent_reflections",
      poolAccountId ? { ...baseRefl, for_account: poolAccountId } : baseRefl,
    );
    if (res.error?.code === "PGRST202" && poolAccountId) {
      res = await supabase.rpc("recent_agent_reflections", baseRefl);
    }
    if (res.error?.code === "PGRST202") {
      res = await supabase.rpc("recent_agent_reflections", reflArgs);
    }
    (res.data ?? []).forEach((m: { id?: string; content: string }) => push(m.id, m.content));
  } catch {
    /* non-fatal */
  }

  const out: RecalledMemory = { lines: lines.slice(0, maxItems), refs: refs.slice(0, maxItems) };
  if (opts?.touch && out.refs.length) {
    await touchMemory(
      supabase,
      out.refs.map((r) => r.id),
    );
  }
  return out;
}

/** Mark recalled memories as used — feeds `last_used_at` decay sweeps. Non-fatal. */
export async function touchMemory(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await supabase
      .from("agent_memory")
      .update({ last_used_at: new Date().toISOString() })
      .in("id", ids);
  } catch (e) {
    console.error("touchMemory failed:", e);
  }
}

/**
 * Persist a recorded outcome as a durable, searchable, GLOBAL-scope memory so
 * EVERY future agent run recalls it (v6 Phase 2 — close the compounding loop).
 * Embedded so it surfaces via `match_agent_memory`; metadata entity-links the
 * PRD / opportunity / learning that produced it. Idempotent on re-record: a
 * prior outcome memory for the same PRD is replaced, not duplicated. Best-effort
 * — returns null (and never throws) so it can never break outcome recording.
 */
export async function rememberOutcome(
  supabase: SupabaseClient,
  args: {
    userId: string;
    workspaceId: string | null;
    prdId: string;
    opportunityId: string | null;
    learningId: string | null;
    content: string;
    importance: number;
    verdict: string;
    priorIce: number | null;
    newIce: number | null;
    prdTitle: string | null;
    oppTitle: string | null;
  },
): Promise<{ id: string } | null> {
  try {
    // A memory the loop can't recall is worse than none: match_agent_memory
    // hard-filters `embedding IS NOT NULL` and there is no re-embed sweep. So if
    // we can't produce an embedding, skip the write entirely — never insert an
    // unrecallable ghost row, and never delete a prior good row to replace it
    // with one. (embedOne can also return a sparse/undefined value — coerce it.)
    let emb: number[] | null = null;
    try {
      const v = await embedOne(args.content, { supabase, userId: args.userId, surfaceRef: "outcome-memory" });
      emb = Array.isArray(v) && v.length > 0 ? v : null;
    } catch {
      emb = null;
    }
    if (!emb) return null;

    // Idempotent on re-record: drop any prior outcome memory for this PRD, then
    // insert the fresh one. (Repo jsonb-filter convention: `.filter("col->>key")`.)
    await supabase
      .from("agent_memory")
      .delete()
      .eq("user_id", args.userId)
      .filter("metadata->>source", "eq", "outcome")
      .filter("metadata->>prd_id", "eq", args.prdId);
    const { data, error } = await supabase
      .from("agent_memory")
      .insert({
        user_id: args.userId,
        agent_id: null,
        agent_slug: null,
        scope: "global",
        kind: OUTCOME_MEMORY_KIND,
        content: args.content,
        importance: args.importance,
        metadata: {
          source: "outcome",
          workspace_id: args.workspaceId,
          prd_id: args.prdId,
          opportunity_id: args.opportunityId,
          learning_id: args.learningId,
          verdict: args.verdict,
          prior_ice: args.priorIce,
          new_ice: args.newIce,
          prd_title: args.prdTitle,
          opp_title: args.oppTitle,
        },
        embedding: emb as unknown as string,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // WM-F1: tag the row with its workspace (the column is nullable and has no
    // DEFAULT bridge, so a plain insert leaves it null). Done as a separate,
    // error-tolerant update so it stays pre-migration safe: before the column
    // exists the update simply no-ops, and a null workspace_id recalls as global.
    if (args.workspaceId && (data as { id?: string } | null)?.id) {
      try {
        await supabase
          .from("agent_memory")
          .update({ workspace_id: args.workspaceId })
          .eq("id", (data as { id: string }).id);
      } catch {
        /* column not present yet (pre-migration) — non-fatal */
      }
    }
    return data as { id: string };
  } catch (e) {
    console.error("rememberOutcome failed:", e);
    return null;
  }
}

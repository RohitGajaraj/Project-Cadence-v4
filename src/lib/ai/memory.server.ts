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

export type MemoryRef = { id: string; summary?: string };
export type RecalledMemory = { lines: string[]; refs: MemoryRef[] };

const SUMMARY_LEN = 140;

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

  try {
    const v = await embedOne(query);
    const matchArgs = {
      query_embedding: v as unknown as string,
      for_user: userId,
      for_agent_slug: agentSlug,
      match_count: 5,
    };
    let res = await supabase.rpc("match_agent_memory", {
      ...matchArgs,
      for_workspace: workspaceId,
    });
    // Pre-migration tolerance: PGRST202 means the for_workspace overload does not
    // exist yet (the deploy window before the WM-F1 migration applies). Retry the
    // legacy call so recall never goes dark. Any OTHER error stays non-fatal and we
    // do NOT fall back, so a transient error can never silently widen recall to all
    // workspaces. Post-migration this branch never runs.
    if (res.error?.code === "PGRST202") {
      res = await supabase.rpc("match_agent_memory", matchArgs);
    }
    (res.data ?? []).forEach((m: { id?: string; content: string }) => push(m.id, m.content));
  } catch {
    /* embed/RPC failure is non-fatal */
  }

  try {
    const reflArgs = { for_user: userId, for_agent_slug: agentSlug, match_count: 3 };
    let res = await supabase.rpc("recent_agent_reflections", {
      ...reflArgs,
      for_workspace: workspaceId,
    });
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
      const v = await embedOne(args.content);
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

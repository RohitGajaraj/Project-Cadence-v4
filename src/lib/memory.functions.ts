// /memory - the compounding-memory view (the moat made visible).
//
// Read-only window onto agent_memory: the semantic store the agent loop writes
// to AND recalls from. This is distinct from the Knowledge > Memory tab, which
// renders the `learnings` table (the human-recorded outcome audit). This surface
// shows what the LOOP stored for itself - reflections agents wrote, outcomes it
// distilled - ranked by what it recalled most recently (last_used_at). A memory
// the loop keeps reaching for is the compounding proof; nothing here claims more
// than the data shows.
//
// agent_memory is owner-scoped (RLS auth.uid() = user_id) with no workspace_id
// column, so the RLS-bound client already scopes every read to the caller - the
// view is the account's whole institutional memory, the same shape as the
// Gauntlet metrics. The explicit user_id filter is defense-in-depth and lets
// Postgres use the (user_id, agent_slug) index.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingRelation } from "@/lib/gauntlet-metrics";
import { summarizeMemory, type MemoryRow, type MemorySummary } from "@/lib/memory-view";

export type { MemoryRow, MemorySummary };

export type AgentMemoryView = {
  /** The recent window, most recently recalled (then most recently created) first. */
  rows: MemoryRow[];
  /** Counts over the window for the header (all real, no estimates). */
  summary: MemorySummary;
  /** All-time count for this owner, so the header is honest when the window is
   *  capped. Falls back to the window length if the count probe errors. */
  totalAll: number;
  /** False only when agent_memory is not present yet (pre-migration on a fresh
   *  environment). The live DB has it; this keeps the surface from hard-crashing
   *  if it ever reads ahead of a sync - it degrades to the empty state. */
  tableReady: boolean;
};

const DEFAULT_LIMIT = 60;

export const getAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(DEFAULT_LIMIT) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<AgentMemoryView> => {
    const { supabase, userId } = context;

    // Recency = most recently recalled, then most recently created. last_used_at
    // climbs each time the loop recalls a memory, so a frequently-recalled lesson
    // stays near the top; never-recalled rows (null) sort after recalled ones.
    const [rowsRes, countRes] = await Promise.all([
      supabase
        .from("agent_memory")
        .select("id,scope,kind,content,agent_slug,importance,last_used_at,created_at")
        .eq("user_id", userId)
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(data.limit),
      supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    if (rowsRes.error) {
      // Pre-migration (or table truly absent): degrade to the empty state rather
      // than throwing. A transient/permission error still surfaces.
      if (isMissingRelation(rowsRes.error as { code?: string; message?: string })) {
        return { rows: [], summary: summarizeMemory([]), totalAll: 0, tableReady: false };
      }
      throw new Error(rowsRes.error.message);
    }

    const rows: MemoryRow[] = (
      (rowsRes.data ?? []) as {
        id: string;
        scope: string;
        kind: string;
        content: string;
        agent_slug: string | null;
        importance: number;
        last_used_at: string | null;
        created_at: string;
      }[]
    ).map((r) => ({
      id: r.id,
      scope: r.scope,
      kind: r.kind,
      content: r.content,
      agentSlug: r.agent_slug,
      importance: r.importance,
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
    }));

    // Honest all-time total. If the count probe errored (but the rows read did
    // not), fall back to what we actually have rather than inventing a number.
    const totalAll = countRes.error ? rows.length : (countRes.count ?? rows.length);

    return { rows, summary: summarizeMemory(rows), totalAll, tableReady: true };
  });

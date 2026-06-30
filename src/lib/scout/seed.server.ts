/**
 * SF-SCOUT Phase 2 — auto-seed scout_targets from workspace context.
 *
 * For workspaces with `auto_scout_enabled` but no targets for a given WatchKind,
 * materializes one query-based target derived from the workspace's current focus,
 * researcher_targets, and top opportunities. Called once per workspace in scout-tick
 * before the target-processing loop, so the Scout works out-of-the-box without
 * requiring the user to manually configure a watch list.
 *
 * Idempotent: never re-seeds a kind that already has at least one target (enabled
 * or not) in the workspace. The seeded targets carry only a `query` (no `url`), so
 * fetchTarget falls back gracefully to the search path for all kinds.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { WATCH_KINDS, KIND_SPECS, type WatchKind } from "./kinds";
import { kindQueries, type WorkspaceCtx } from "./autoquery";

const db = supabaseAdmin as unknown as SupabaseClient;

/** Auto-seed scout_targets for any WatchKind not yet represented in the workspace.
 *  Returns the number of rows inserted (0 means all kinds were already seeded). */
export async function autoSeedTargets(workspaceId: string, userId: string): Promise<number> {
  // Which kinds already have at least one row (enabled or disabled)?
  const { data: existing } = await db
    .from("scout_targets")
    .select("kind")
    .eq("workspace_id", workspaceId);

  const alreadySeeded = new Set((existing ?? []).map((r: { kind: string }) => r.kind));
  const kindsNeeded = WATCH_KINDS.filter((k) => !alreadySeeded.has(k));
  if (kindsNeeded.length === 0) return 0;

  // Read workspace context from workspace_briefs + top opportunities.
  const [{ data: brief }, { data: opps }] = await Promise.all([
    db
      .from("workspace_briefs")
      .select("current_focus, researcher_targets")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    db
      .from("opportunities")
      .select("title")
      .eq("workspace_id", workspaceId)
      .order("impact", { ascending: false })
      .limit(2),
  ]);

  const ctx: WorkspaceCtx = {
    focus: ((brief as { current_focus?: string | null } | null)?.current_focus ?? "").trim(),
    targets: ((brief as { researcher_targets?: string | null } | null)?.researcher_targets ?? "")
      .split(/[,\n]+/)
      .map((t: string) => t.trim())
      .filter(Boolean),
    opps: ((opps ?? []) as { title: string }[]).map((o) => o.title.trim()).filter(Boolean),
  };

  const queries = kindQueries(ctx);

  const toInsert = kindsNeeded
    .filter((k): k is WatchKind => k in queries)
    .map((k) => ({
      workspace_id: workspaceId,
      user_id: userId,
      kind: k,
      label: `Auto: ${KIND_SPECS[k].sourceLabel}`,
      query: queries[k],
      cadence: KIND_SPECS[k].defaultCadence,
      // enabled: true (the column default) — auto-seeded targets are active immediately.
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await db.from("scout_targets").insert(toInsert);
  if (error) {
    // Non-fatal: log and let the next tick retry.
    console.warn("[scout-seed] autoSeedTargets insert failed:", error.message);
    return 0;
  }

  return toInsert.length;
}

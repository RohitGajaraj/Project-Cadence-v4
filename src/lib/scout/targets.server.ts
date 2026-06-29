/**
 * SF-SCOUT — watch-target persistence (server-only).
 *
 * The Scout's due-target query and the post-check bookkeeping (last_checked_at,
 * next_check_at with exponential backoff, the unchanged streak, error stamping).
 * Pure scheduling math lives in diff.ts (backoffNext); this is the thin DB glue.
 *
 * scout_targets / scout_snapshots / scout_runs aren't in the generated Database
 * types yet, so we use the untyped client — same precedent as github-ingest.server.ts
 * and sink.server.ts (`const db = supabaseAdmin as unknown as SupabaseClient`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { backoffNext } from "./diff";
import type { Cadence, WatchKind } from "./kinds";

const db = supabaseAdmin as unknown as SupabaseClient;

/** A row of public.scout_targets (the untyped shape the Scout reads/writes). */
export interface ScoutTargetRow {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: WatchKind;
  label: string;
  url: string | null;
  query: string | null;
  config: Record<string, unknown>;
  cadence: Cadence;
  enabled: boolean;
  last_checked_at: string | null;
  next_check_at: string | null;
  consecutive_unchanged: number;
  error_count: number;
  last_error: string | null;
}

/** Enabled targets in a workspace that are due (next_check_at null or in the past),
 *  oldest-due first. Bounded by `limit` so one tick can never scan a runaway list. */
export async function listDueTargets(
  workspaceId: string,
  limit: number,
): Promise<ScoutTargetRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("scout_targets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true)
    .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as ScoutTargetRow[];
}

/** Record the outcome of one check on a target: stamp last_checked_at, compute the
 *  next check time (back off when unchanged, reset to base cadence on a change), roll
 *  the unchanged streak, and set/clear the error fields. `consecutiveUnchanged` is the
 *  target's value BEFORE this run. */
export async function markChecked(
  targetId: string,
  opts: {
    changed: boolean;
    cadence: Cadence;
    consecutiveUnchanged: number;
    error?: string | null;
  },
): Promise<void> {
  const now = new Date();
  const newConsecutive = opts.changed ? 0 : opts.consecutiveUnchanged + 1;
  const nextCheck = backoffNext(now, opts.cadence, newConsecutive);

  const update: Record<string, unknown> = {
    last_checked_at: now.toISOString(),
    next_check_at: nextCheck.toISOString(),
    consecutive_unchanged: newConsecutive,
  };

  if (opts.error) {
    // Increment error_count; read-modify-write only on the (rare) error path.
    const { data } = await db
      .from("scout_targets")
      .select("error_count")
      .eq("id", targetId)
      .maybeSingle();
    const prev = (data?.error_count as number | undefined) ?? 0;
    update.error_count = prev + 1;
    update.last_error = opts.error.slice(0, 500);
  } else {
    // Clear stale errors on a clean check.
    update.error_count = 0;
    update.last_error = null;
  }

  await db.from("scout_targets").update(update).eq("id", targetId);
}

/**
 * Signal Fabric - the single write path into public.signals.
 *
 * Every source (connectors, the Scout, MCP sources, webhook, manual) funnels its
 * SignalCandidate[] through here. The sink fetches the external_ids already stored
 * for this (user, workspace), runs the pure prepare core (screen + dedup + normalize
 * + stamp source_kind), and inserts. This is the one place dedup, injection-screening,
 * and the source_kind discriminator live, so a new source inherits all three by
 * construction. Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { prepareSignalRows } from "./prepare";
import type { SignalCandidate, SinkResult } from "./kinds";

// external_id / source_kind are not yet in the generated Database types; use the
// generic untyped client - same precedent as github-ingest.server.ts.
const db = supabaseAdmin as unknown as SupabaseClient;

/**
 * Write a batch of candidates as signals for one workspace.
 * Idempotent via external_id; structural injections from untrusted sources are
 * dropped; tags/sentiment are derived when the producer omitted them.
 */
export async function writeSignals(
  userId: string,
  workspaceId: string,
  candidates: SignalCandidate[],
  opts?: { productId?: string | null },
): Promise<SinkResult> {
  if (candidates.length === 0) return { inserted: 0, skipped: 0, quarantined: 0 };

  // Fetch already-seen external_ids for this workspace to skip them cheaply.
  const extIds = candidates.map((c) => c.externalId).filter((id): id is string => Boolean(id));
  let seen = new Set<string>();
  if (extIds.length > 0) {
    const { data: existing } = await db
      .from("signals")
      .select("external_id")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .in("external_id", extIds);
    seen = new Set((existing ?? []).map((r) => r.external_id as string));
  }

  const { rows, skipped, quarantined } = prepareSignalRows(
    userId,
    workspaceId,
    candidates,
    seen,
    opts,
  );

  if (rows.length === 0) return { inserted: 0, skipped, quarantined };

  const { error } = await db.from("signals").insert(rows);
  if (error) throw new Error(`writeSignals insert failed: ${error.message}`);

  return { inserted: rows.length, skipped, quarantined };
}

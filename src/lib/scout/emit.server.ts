/**
 * SF-SCOUT — change → signal emit (server-only).
 *
 * The ONE place the Scout turns a detected change into a signal, and it does so
 * ONLY through the keystone writeSignals (never a direct insert into signals). By
 * funneling through the sink the Scout inherits dedup (external_id), the prompt-
 * injection screen (untrusted web content), tag/sentiment derivation, and the
 * source_kind="web_scout" stamp for free.
 *
 * Idempotency: external_id = scout:<targetId>:<hash16>. The same content-change can
 * never be emitted twice — re-running the tick on identical content is a no-op at
 * the sink. firstSeen never reaches here (the caller stores the baseline and skips).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";
import { KIND_SPECS, sourceLabelFor } from "./kinds";
import type { DiffResult } from "./diff";
import type { ScoutTargetRow } from "./targets.server";
import type { SnapshotRow } from "./snapshot.server";

const db = supabaseAdmin as unknown as SupabaseClient;

/** The snapshot fields the emit actually reads — a projection, so the tick can emit
 *  BEFORE persisting the snapshot row (which has no id yet) and only advance the
 *  baseline after a successful, idempotent emit. */
type SnapshotLike = Pick<SnapshotRow, "content_hash" | "excerpt" | "fetched_url">;

/** Emit a single "changed" signal for a target through the sink. Returns the signal
 *  id (when a new row was inserted) and the deterministic external_id. */
export async function emitChangeSignal(
  t: ScoutTargetRow,
  snap: SnapshotLike,
  diff: DiffResult,
): Promise<{ signalId: string | null; externalId: string }> {
  const externalId = `scout:${t.id}:${snap.content_hash.slice(0, 16)}`;

  const candidate: SignalCandidate = {
    externalId,
    source: sourceLabelFor(t.kind),
    sourceKind: "web_scout",
    title: `${t.label}: changed`,
    content: diff.addedExcerpt || snap.excerpt,
    url: snap.fetched_url,
    tags: [...KIND_SPECS[t.kind].baseTags, `kind:${t.kind}`, "novelty:changed"],
    untrusted: true, // web content — the sink runs the injection screen
  };

  const res = await writeSignals(t.user_id, t.workspace_id, [candidate]);

  // writeSignals returns counts, not the row id; look it up by external_id when a row
  // was actually inserted (skipped/quarantined → no new signal, signalId stays null).
  let signalId: string | null = null;
  if (res.inserted > 0) {
    const { data } = await db
      .from("signals")
      .select("id")
      .eq("user_id", t.user_id)
      .eq("workspace_id", t.workspace_id)
      .eq("external_id", externalId)
      .limit(1)
      .maybeSingle();
    signalId = (data?.id as string | undefined) ?? null;
  }

  return { signalId, externalId };
}

import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withJobRun } from "@/lib/observability";
import { hashContent, diffSnapshots } from "@/lib/scout/diff";
import { listDueTargets, markChecked, type ScoutTargetRow } from "@/lib/scout/targets.server";
import {
  fetchTarget,
  loadLastSnapshot,
  storeSnapshot,
  EXCERPT_CHARS,
} from "@/lib/scout/snapshot.server";
import { emitChangeSignal } from "@/lib/scout/emit.server";

/**
 * SF-SCOUT (Signal Fabric Phase 1) — scout-tick hook.
 *
 * The continuous, watch-list-driven Scout / Watchtower. For each opted-in workspace
 * it walks the DUE targets, fetches each surface, diffs it against the last snapshot,
 * and emits a signal ONLY on a real change — through the keystone writeSignals, so it
 * inherits dedup + the injection screen + source_kind='web_scout'. RULE-BASED only:
 * ZERO recurring AI spend in Slice 0 (the LLM brief is Slice 1).
 *
 * ACTIVATION GATE: exits early when FIRECRAWL_API_KEY is unset (the pg_cron schedule
 * is installed by the migration; the key is the founder's activation step).
 *
 * Cost guards: per-workspace opt-in (auto_scout_enabled, default false), a per-tick
 * workspace cap (MAX_WORKSPACES, oldest-run-first), a per-workspace target cap
 * (MAX_TARGETS_PER_WS), a daily Firecrawl fetch cap (scout_daily_fetch_cap, summed
 * from today's scout_runs), exponential backoff on unchanged targets, and NEVER
 * webCrawl. The first sighting of a target stores a baseline and emits NOTHING.
 */

const MAX_WORKSPACES = 5;
const MAX_TARGETS_PER_WS = 10;

// scout_* tables + the new workspaces.scout columns aren't in the generated Database
// types yet — use the untyped client (same precedent as github-ingest.server.ts / sink).
const db = supabaseAdmin as unknown as SupabaseClient;

type WsRow = {
  id: string;
  owner_id: string | null;
  scout_daily_fetch_cap: number | null;
  last_auto_scout_at: string | null;
};

export const Route = createFileRoute("/api/public/hooks/scout-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        // ACTIVATION GATE: key absent = dormant by design.
        if (!process.env.FIRECRAWL_API_KEY) {
          return json({ ok: true, skipped: true, reason: "scout dormant, no firecrawl key" });
        }

        return withJobRun("ambient.scout-tick", async () => {
          const { data: rawWorkspaces, error } = await db
            .from("workspaces")
            .select("id, owner_id, scout_daily_fetch_cap, last_auto_scout_at")
            .eq("auto_scout_enabled", true)
            .order("last_auto_scout_at", { ascending: true, nullsFirst: true })
            .limit(MAX_WORKSPACES);

          if (error) {
            // Pre-migration tolerance: the scout columns may not exist yet.
            const code = (error as { code?: string }).code;
            if (code === "42703" || code === "PGRST204") {
              return json({ ok: true, processed: 0, note: "auto_scout not migrated yet" });
            }
            return json({ ok: false, error: error.message }, 500);
          }

          const workspaces = (rawWorkspaces ?? []) as unknown as WsRow[];
          const results: Array<Record<string, unknown>> = [];

          for (const ws of workspaces) {
            try {
              const cap = ws.scout_daily_fetch_cap ?? 50;
              const usedToday = await sumTodaysFetches(ws.id);

              if (usedToday >= cap) {
                await recordRun(ws.id, {
                  outcome: "skipped-cap",
                  detail: `daily fetch cap ${cap} reached (${usedToday} today)`,
                });
                await stampWorkspace(ws.id);
                results.push({ workspace_id: ws.id, skipped_cap: true, used_today: usedToday });
                continue;
              }

              let budget = cap - usedToday;
              const targets = await listDueTargets(ws.id, MAX_TARGETS_PER_WS);
              let checked = 0;
              let firstSeen = 0;
              let changed = 0;
              let emitted = 0;
              let errors = 0;

              for (const t of targets) {
                if (budget <= 0) break; // daily cap hit mid-workspace
                // Charge the TRUE Firecrawl credit cost (a /search bills per result, a
                // /scrape bills 1), not a flat per-call unit, so the daily cap bounds
                // real spend. A search may overshoot the remaining budget by < 1 unit;
                // the next iteration's budget<=0 guard then stops the loop.
                const { outcome, cost } = await processTarget(t);
                budget -= cost;
                checked++;
                if (outcome === "first-seen") firstSeen++;
                else if (outcome === "changed") changed++;
                else if (outcome === "error") errors++;
                if (outcome === "emitted") {
                  changed++;
                  emitted++;
                }
              }

              await stampWorkspace(ws.id);
              results.push({
                workspace_id: ws.id,
                checked,
                first_seen: firstSeen,
                changed,
                emitted,
                errors,
              });
            } catch (e) {
              results.push({
                workspace_id: ws.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          return json({ ok: true, processed: workspaces.length, results });
        });
      },
    },
  },
});

/**
 * One target: fetch → hash → load last → diff → (on a real change) emit THEN store →
 * record run → markChecked. Never throws (records an 'error' run + backs the target off
 * instead), so one bad target can't abort the workspace loop. Returns the outcome bucket
 * AND the Firecrawl credit cost of the fetch, so the caller charges the daily cap truly.
 *
 * Order matters on the changed path: emit BEFORE persisting the new baseline. The emit is
 * idempotent via external_id (scout:<targetId>:<hash16>), so a store failure AFTER a
 * successful emit self-heals (the next tick re-detects the change and the sink dedups it),
 * while an emit failure leaves the OLD baseline intact so the change is re-detected and
 * re-emitted next tick — never silently dropped. firstSeen/unchanged stay store-only.
 */
async function processTarget(t: ScoutTargetRow): Promise<{
  outcome: "first-seen" | "unchanged" | "changed" | "emitted" | "error";
  cost: number;
}> {
  try {
    const surface = await fetchTarget(t);
    const cost = surface.creditCost;
    const hash = hashContent(surface.hashBasis);
    const prev = await loadLastSnapshot(t.id);
    const nextExcerpt = surface.markdown.slice(0, EXCERPT_CHARS);
    const diff = diffSnapshots(
      prev ? { content_hash: prev.content_hash, excerpt: prev.excerpt } : null,
      { content_hash: hash, excerpt: nextExcerpt },
    );

    let signalId: string | null = null;
    let outcome: "first-seen" | "unchanged" | "changed";
    if (diff.firstSeen) {
      outcome = "first-seen"; // baseline only — emit NOTHING on day 1
    } else if (diff.changed) {
      // Emit FIRST (the emit only needs content_hash/excerpt/fetched_url, not the row id),
      // then advance the baseline below. See the function doc for the idempotency rationale.
      const emit = await emitChangeSignal(
        t,
        { content_hash: hash, excerpt: nextExcerpt, fetched_url: surface.url || null },
        diff,
      );
      signalId = emit.signalId;
      outcome = "changed";
    } else {
      outcome = "unchanged";
    }

    // Store the snapshot AFTER the emit, so the per-target timeline stays complete (every
    // check is recorded) yet the baseline only advances once a real change is emitted.
    const snap = await storeSnapshot(t, surface, hash);

    await recordRun(t.workspace_id, {
      target_id: t.id,
      kind: t.kind,
      outcome,
      changed: diff.changed,
      signal_id: signalId,
      snapshot_id: snap.id,
      fetch_count: cost,
    });

    await markChecked(t.id, {
      changed: diff.changed,
      cadence: t.cadence,
      consecutiveUnchanged: t.consecutive_unchanged,
    });

    return { outcome: outcome === "changed" && signalId ? "emitted" : outcome, cost };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordRun(t.workspace_id, {
      target_id: t.id,
      kind: t.kind,
      outcome: "error",
      fetch_count: 1, // the fetch was attempted; count one credit against the cost ledger
      detail: msg.slice(0, 500),
    }).catch(() => {});
    await markChecked(t.id, {
      changed: false,
      cadence: t.cadence,
      consecutiveUnchanged: t.consecutive_unchanged,
      error: msg,
    }).catch(() => {});
    return { outcome: "error", cost: 1 };
  }
}

/** Sum fetch_count across today's (UTC) scout_runs for a workspace — the daily cap grain. */
async function sumTodaysFetches(workspaceId: string): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data } = await db
    .from("scout_runs")
    .select("fetch_count")
    .eq("workspace_id", workspaceId)
    .gte("created_at", dayStart.toISOString())
    .limit(2000);
  return (data ?? []).reduce(
    (sum: number, r: { fetch_count?: number | null }) => sum + (r.fetch_count ?? 0),
    0,
  );
}

/** Append one scout_runs audit row. Best-effort (never throws into the loop). */
async function recordRun(
  workspaceId: string,
  row: {
    target_id?: string;
    kind?: string;
    outcome: "first-seen" | "unchanged" | "changed" | "error" | "skipped-cap";
    changed?: boolean;
    signal_id?: string | null;
    snapshot_id?: string | null;
    fetch_count?: number;
    detail?: string;
  },
): Promise<void> {
  await db.from("scout_runs").insert({
    workspace_id: workspaceId,
    target_id: row.target_id ?? null,
    kind: row.kind ?? null,
    outcome: row.outcome,
    changed: row.changed ?? false,
    signal_id: row.signal_id ?? null,
    snapshot_id: row.snapshot_id ?? null,
    fetch_count: row.fetch_count ?? 0,
    detail: row.detail ?? null,
  });
}

/** Stamp last_auto_scout_at so the oldest-run-first scan rotates fairly across ticks. */
async function stampWorkspace(workspaceId: string): Promise<void> {
  await db
    .from("workspaces")
    .update({ last_auto_scout_at: new Date().toISOString() })
    .eq("id", workspaceId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

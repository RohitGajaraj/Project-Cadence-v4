import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEMO_FEED, autoTag, inferSentiment, tagSignalUpdate } from "@/lib/sensing/normalize";
import { ingestGithubSignals } from "@/lib/connectors/providers/github-ingest.server";
import { ingestPostHogAnalytics } from "@/lib/analytics-ingest.server";
import { ingestIntercomSignals } from "@/lib/connectors/providers/intercom-ingest.server";
import { withJobRun } from "@/lib/observability";

/**
 * AMBIENT-SENSE (v11 #3) sense-tick: the continuous-sensing half of the ambient loop. For
 * every workspace that has opted in (auto_sense_enabled = true), with NO human start, it:
 *   1. normalizes + auto-tags the workspace's untagged signals to the ontology (so the
 *      clustering step has analysis-ready input), and
 *   2. tops up a small, deterministic DEMO feed when the workspace is near-empty, so the
 *      loop has something to sense until a real source is bound (SEN-01 / F-CONN, founder-gated).
 * cluster-tick then clusters the now-tagged signals into themes and opportunities.
 *
 * Off by default and bounded, exactly like cluster-tick: no workspace runs until its owner
 * toggles auto_sense_enabled on, and the pg_cron schedule that drives this is a founder
 * activation step. This tick is RULE-BASED only (no AI call), so it commits NO recurring AI
 * spend; AI enrichment would be a later, spend-gated enhancement. Each invocation processes
 * at most 5 workspaces (oldest-run-first) and at most 50 signal updates per workspace.
 */

const MAX_WORKSPACES = 5;
const MAX_TAG_UPDATES = 50;
const SCAN_LIMIT = 100;
const DEMO_TOPUP_THRESHOLD = 3; // top up the demo feed only for a near-empty workspace

export const Route = createFileRoute("/api/public/hooks/sense-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        return withJobRun("ambient.sense-tick", async () => {
          const { data: workspaces, error } = await supabaseAdmin
            .from("workspaces")
            .select("id, owner_id, last_auto_sense_at")
            .eq("auto_sense_enabled", true)
            .order("last_auto_sense_at", { ascending: true, nullsFirst: true })
            .limit(MAX_WORKSPACES);

          if (error) {
            // Pre-migration tolerance: auto_sense_enabled may not exist yet.
            const code = (error as { code?: string }).code;
            if (code === "42703" || code === "PGRST204") {
              return json({ ok: true, processed: 0, note: "auto_sense not migrated yet" });
            }
            return json({ ok: false, error: error.message }, 500);
          }

          const results: Array<{
            workspace_id: string;
            tagged?: number;
            seeded?: number;
            github_inserted?: number;
            github_source?: string;
            intercom_inserted?: number;
            intercom_source?: string;
            posthog_rows?: number;
            posthog_signals?: number;
            posthog_skipped?: boolean;
            error?: string;
          }> = [];

          for (const ws of workspaces ?? []) {
            try {
              if (!ws.owner_id) {
                results.push({ workspace_id: ws.id, error: "no owner" });
                continue;
              }
              const tagged = await tagUntaggedSignals(ws.owner_id, ws.id);
              const seeded = await topUpDemoFeed(ws.owner_id, ws.id);
              const gh = await ingestGithubSignals(ws.owner_id, ws.id).catch(() => null);
              const posthog = await ingestPostHogAnalytics(ws.id, ws.owner_id).catch(() => null);
              const intercom = await ingestIntercomSignals(ws.owner_id, ws.id).catch(() => null);
              await supabaseAdmin
                .from("workspaces")
                .update({ last_auto_sense_at: new Date().toISOString() })
                .eq("id", ws.id);
              results.push({
                workspace_id: ws.id,
                tagged,
                seeded,
                github_inserted: gh?.inserted ?? 0,
                github_source: gh?.source ?? "none",
                intercom_inserted: intercom?.inserted ?? 0,
                intercom_source: intercom?.source ?? "none",
                posthog_rows: posthog?.rowsUpserted ?? 0,
                posthog_signals: posthog?.signalsInserted ?? 0,
                posthog_skipped: posthog?.skipped ?? false,
              });
            } catch (e) {
              results.push({
                workspace_id: ws.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          return json({ ok: true, processed: workspaces?.length ?? 0, results });
        });
      },
    },
  },
});

/** Normalize + auto-tag the workspace's untagged signals (empty tags or missing sentiment).
 *  Workspace-scoped (the auto_sense flag is per-workspace, mirroring cluster-tick). Bounded
 *  scan + bounded updates; every write traces to the pure tagSignalUpdate. */
async function tagUntaggedSignals(ownerId: string, workspaceId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("signals")
    .select("id, title, content, source, tags, sentiment")
    .eq("user_id", ownerId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);
  if (error || !data) return 0;

  let updated = 0;
  for (const row of data) {
    if (updated >= MAX_TAG_UPDATES) break;
    const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
    const hasSentiment =
      row.sentiment === "positive" || row.sentiment === "neutral" || row.sentiment === "negative";
    if (tags.length > 0 && hasSentiment) continue; // already sensed
    const u = tagSignalUpdate({
      title: row.title,
      content: row.content,
      source: row.source,
      tags,
      sentiment: row.sentiment,
    });
    if (!u || !u.changed) continue;
    const { error: upErr } = await supabaseAdmin
      .from("signals")
      .update({ tags: u.tags, sentiment: u.sentiment })
      .eq("id", row.id);
    if (!upErr) updated++;
  }
  return updated;
}

/** Insert the demo feed for a near-empty workspace, idempotently (by exact content match),
 *  so the ambient loop has input until a real source is bound. workspace_id is set explicitly
 *  (NOT NULL with an auth-context default the service-role insert cannot satisfy). */
async function topUpDemoFeed(ownerId: string, workspaceId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .eq("workspace_id", workspaceId);
  if ((count ?? 0) >= DEMO_TOPUP_THRESHOLD) return 0;

  const { data: existing } = await supabaseAdmin
    .from("signals")
    .select("content")
    .eq("user_id", ownerId)
    .eq("workspace_id", workspaceId)
    .limit(500);
  const seen = new Set((existing ?? []).map((r) => (r.content || "").trim()));

  const toInsert = DEMO_FEED.filter((d) => !seen.has(d.content.trim())).map((d) => ({
    user_id: ownerId,
    workspace_id: workspaceId,
    source: d.source,
    title: d.title,
    content: d.content,
    tags: autoTag(`${d.title} ${d.content}`, d.source),
    sentiment: inferSentiment(`${d.title} ${d.content}`),
  }));
  if (toInsert.length === 0) return 0;

  const { error } = await supabaseAdmin.from("signals").insert(toInsert);
  return error ? 0 : toInsert.length;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

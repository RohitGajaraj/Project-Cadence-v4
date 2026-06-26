/**
 * SEN-05 — PostHog inbound: pull product-usage data FROM PostHog into the
 * Cadence signal + product_analytics tables.
 *
 * This is the INBOUND direction (PostHog → Cadence), the complement to AFD-04
 * which is the outbound direction (Cadence → PostHog).
 *
 * Gate: both POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be set.
 * The personal API key (Settings → Personal API Keys in PostHog) is distinct
 * from the project capture key (phc_…). It must have `query:read` scope.
 *
 * Called from sense-tick per workspace; also callable from the admin surface.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** PostHog HogQL query response shape (abridged). */
type HogQLResponse = {
  results: Array<[string, string, number, number]>; // [event, date, distinct_users, count]
  error?: string;
};

type IngestResult = {
  ok: boolean;
  skipped?: true;
  reason?: string;
  rowsUpserted?: number;
  signalsInserted?: number;
};

/**
 * Ingest the last `days` days of PostHog event data for a workspace.
 *
 * Each run upserts rows into `product_analytics` (one per event × date) and
 * inserts a signal for any event that grew >100% week-over-week (usage spike).
 */
export async function ingestPostHogAnalytics(
  workspaceId: string,
  ownerId: string,
  days = 30,
): Promise<IngestResult> {
  const personalKey = (process.env.POSTHOG_PERSONAL_API_KEY ?? "").trim();
  const projectId   = (process.env.POSTHOG_PROJECT_ID   ?? "").trim();
  const host        = (process.env.POSTHOG_HOST          ?? "https://eu.i.posthog.com").trim();

  if (!personalKey || !projectId) {
    return { ok: true, skipped: true, reason: "POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set" };
  }

  // HogQL query: daily event counts for tracked Cadence events over last N days.
  const hogql = `
    SELECT
      event,
      toString(toDate(timestamp)) AS day,
      count(DISTINCT person_id)   AS distinct_users,
      count()                     AS event_count
    FROM events
    WHERE timestamp >= now() - toIntervalDay(${days})
      AND event IN (
        'decision_made','decision_superseded','decision_shipped',
        'mission_started','mission_completed',
        'agent_run_started','agent_run_completed','agent_run_failed',
        'connection_connected','signal_ingested'
      )
    GROUP BY event, day
    ORDER BY day DESC
  `;

  let data: HogQLResponse;
  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${personalKey}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { ok: false, reason: `PostHog API error ${res.status}: ${text.slice(0, 200)}` };
    }
    data = (await res.json()) as HogQLResponse;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  if (!data.results?.length) return { ok: true, rowsUpserted: 0, signalsInserted: 0 };

  // Upsert product_analytics rows.
  // product_analytics is not in generated types yet; cast to any (standard pattern).
  const anyDb = supabaseAdmin as any;

  const rows = data.results.map(([event, day, distinctUsers, eventCount]) => ({
    workspace_id:   workspaceId,
    feature_event:  event,
    cohort_date:    day,
    distinct_users: distinctUsers,
    event_count:    eventCount,
    source:         "posthog",
    updated_at:     new Date().toISOString(),
  }));

  const { error: upsertErr } = await anyDb
    .from("product_analytics")
    .upsert(rows, { onConflict: "workspace_id,feature_event,cohort_date" });
  if (upsertErr) return { ok: false, reason: (upsertErr as { message: string }).message };

  // Detect spikes: events that grew >100% vs the prior 7-day window.
  const signalsInserted = await insertSpikeSignals(workspaceId, ownerId, data.results);

  return { ok: true, rowsUpserted: rows.length, signalsInserted };
}

/** Insert a signal for every event with a >100% week-over-week spike. */
async function insertSpikeSignals(
  workspaceId: string,
  ownerId: string,
  results: HogQLResponse["results"],
): Promise<number> {
  // Sum distinct_users per event for last 7 days vs prior 7 days.
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const priorWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  const byEvent = new Map<string, { recent: number; prior: number }>();
  for (const [event, day, distinctUsers] of results) {
    const e = byEvent.get(event) ?? { recent: 0, prior: 0 };
    if (day >= thisWeekStart) e.recent += distinctUsers;
    else if (day >= priorWeekStart) e.prior += distinctUsers;
    byEvent.set(event, e);
  }

  const spikes = Array.from(byEvent.entries()).filter(([, { recent, prior }]) => {
    if (prior === 0) return recent >= 10; // first-time non-trivial usage
    return recent / prior >= 2;           // 2× or more growth
  });

  if (spikes.length === 0) return 0;

  const signalRows = spikes.map(([event, { recent, prior }]) => ({
    user_id:      ownerId,
    workspace_id: workspaceId,
    source:       "posthog_analytics",
    title:        `Usage spike: ${event}`,
    content:
      prior === 0
        ? `New activity on "${event}": ${recent} distinct users in the last 7 days.`
        : `"${event}" grew ${Math.round((recent / prior - 1) * 100)}% WoW: ${recent} vs ${prior} distinct users.`,
    tags:         ["analytics", "posthog", "spike"],
    sentiment:    "positive",
  }));

  const { error } = await supabaseAdmin.from("signals").insert(signalRows);
  return error ? 0 : signalRows.length;
}

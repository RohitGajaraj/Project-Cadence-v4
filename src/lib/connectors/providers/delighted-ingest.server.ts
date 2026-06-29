// SF-CONNECTORS (Signal Fabric Phase 2) - pull recent Delighted survey responses (NPS /
// CSAT) as signals, through the writeSignals sink (dedup via external_id, source_kind
// "pull_connector"). Customer-written survey comments are UNTRUSTED external input, so
// each item is flagged untrusted and the sink screens it for prompt injection before it
// is stored. Mirrors intercom-ingest.server.ts. Called from sense-tick for any workspace
// with a Delighted credential (env DELIGHTED_API_KEY today; vault/gateway once
// registered). Rule-based, zero AI spend; tier-gated to Pro+ (inflow) like every
// connector. The NPS score maps to sentiment (promoter / passive / detractor).

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { DELIGHTED_API, authHeader } from "./delighted.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type DelightedIngestResult = { inserted: number; skipped: number; source: string };

export type DelightedResponse = {
  id?: string | number;
  score?: number;
  comment?: string;
};

/** PURE - map one Delighted survey response to a SignalCandidate, or null when it has no
 *  id (no idempotency key). untrusted:true routes the customer comment through the
 *  injection screen in writeSignals. The NPS score sets sentiment: 9-10 promoter
 *  (positive), 7-8 passive (neutral), 0-6 detractor (negative). */
export function responseToCandidate(r: DelightedResponse): SignalCandidate | null {
  if (!r.id) return null;
  const score = typeof r.score === "number" ? r.score : null;
  const comment = r.comment || "";
  const title = ("NPS " + (score ?? "?") + ": " + (comment || "no comment").slice(0, 100)).slice(
    0,
    300,
  );
  const content = (comment || "Score " + (score ?? "?") + ", no comment").slice(0, 1500);
  const sentiment =
    score == null ? undefined : score >= 9 ? "positive" : score >= 7 ? "neutral" : "negative";
  const candidate: SignalCandidate = {
    externalId: `delighted:response:${r.id}`,
    source: "delighted",
    sourceKind: "pull_connector",
    title,
    content,
    url: null,
    untrusted: true,
  };
  if (sentiment) candidate.sentiment = sentiment;
  return candidate;
}

async function fetchResponses(apiKey: string): Promise<DelightedResponse[]> {
  const res = await fetch(
    `${DELIGHTED_API}/survey_responses.json?per_page=${MAX_ITEMS}&order=desc`,
    {
      headers: { Accept: "application/json", Authorization: authHeader(apiKey) },
    },
  );
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body) ? (body as DelightedResponse[]) : [];
}

/**
 * Pull recent Delighted survey responses for one workspace and write them as signals.
 * Returns {inserted, skipped, source}; skips cleanly (source "none") when the workspace
 * has no Delighted credential or its plan tier lacks inflow.
 */
export async function ingestDelightedSignals(
  userId: string,
  workspaceId: string,
): Promise<DelightedIngestResult> {
  let apiKey: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "delighted",
      userId,
      workspaceId,
      requiredCapability: "inflow",
    });
    apiKey = tokenBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error - workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!apiKey) return { inserted: 0, skipped: 0, source: "none" };

  const responses = await fetchResponses(apiKey);
  if (responses.length === 0) return { inserted: 0, skipped: 0, source: "delighted" };

  const candidates = responses
    .map(responseToCandidate)
    .filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "delighted" };
}

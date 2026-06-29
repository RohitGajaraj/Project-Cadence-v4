// SF-CONNECTORS (Signal Fabric Phase 2) - pull closed-lost HubSpot deals as signals, through the
// writeSignals sink (dedup via external_id, source_kind "pull_connector"). Only deals whose stage
// reads as "lost" are emitted - the loss reason and amount are the win/loss evidence the product
// learns from. CRM deal text (the recorded loss reason) is external input, so each item is flagged
// UNTRUSTED and screened for prompt injection by the sink before it is stored. Mirrors
// intercom-ingest.server.ts. Called from sense-tick for any workspace with a HubSpot credential
// (env HUBSPOT_ACCESS_TOKEN today; OAuth gateway once registered). Rule-based, zero AI spend;
// tier-gated to Pro+ (inflow) like every connector.

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { HUBSPOT_API } from "./hubspot.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 50;

export type HubSpotIngestResult = { inserted: number; skipped: number; source: string };

export type HubSpotDeal = {
  id?: string;
  properties?: {
    dealname?: string;
    dealstage?: string;
    closed_lost_reason?: string;
    amount?: string;
  };
};

/** PURE - map one HubSpot deal to a SignalCandidate, or null when it has no id or is not a
 *  closed-lost deal (only losses carry win/loss signal). untrusted:true routes the recorded
 *  loss reason through the injection screen in writeSignals. */
export function dealToCandidate(deal: HubSpotDeal): SignalCandidate | null {
  const p = deal.properties ?? {};
  if (!deal.id) return null;
  const stage = String(p.dealstage || "").toLowerCase();
  if (!stage.includes("lost")) return null;
  const reason = p.closed_lost_reason || "";
  const title = ("Deal lost: " + (p.dealname || deal.id)).slice(0, 300);
  const content = (
    "Reason: " +
    (reason || "not specified") +
    ". Amount: " +
    (p.amount || "n/a")
  ).slice(0, 1500);
  return {
    externalId: `hubspot:deal_lost:${deal.id}`,
    source: "hubspot",
    sourceKind: "pull_connector",
    title,
    content,
    url: null,
    untrusted: true,
  };
}

async function fetchDeals(token: string): Promise<HubSpotDeal[]> {
  const res = await fetch(
    `${HUBSPOT_API}/crm/v3/objects/deals?limit=${MAX_ITEMS}&properties=dealname,dealstage,closed_lost_reason,amount&archived=false`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { results?: HubSpotDeal[] };
  return body.results ?? [];
}

/**
 * Pull recent closed-lost HubSpot deals for one workspace and write them as signals.
 * Returns {inserted, skipped, source}; skips cleanly (source "none") when the workspace has no
 * HubSpot credential or its plan tier lacks inflow.
 */
export async function ingestHubSpotSignals(
  userId: string,
  workspaceId: string,
): Promise<HubSpotIngestResult> {
  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "hubspot",
      userId,
      workspaceId,
      requiredCapability: "inflow",
    });
    token = tokenBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error - workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!token) return { inserted: 0, skipped: 0, source: "none" };

  const deals = await fetchDeals(token);
  if (deals.length === 0) return { inserted: 0, skipped: 0, source: "hubspot" };

  const candidates = deals.map(dealToCandidate).filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "hubspot" };
}

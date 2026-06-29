// SF-CONNECTORS (Signal Fabric Phase 2) - pull recent closed-lost Salesforce
// opportunities as signals, through the writeSignals sink (dedup via external_id,
// source_kind "pull_connector"). The Opportunity Name and Description are
// customer/seller-authored free text, so they are UNTRUSTED external input - each item
// is flagged untrusted and screened for prompt injection by the sink before it is
// stored. Mirrors intercom-ingest.server.ts. Called from sense-tick for any workspace
// with a Salesforce credential (token via resolveProviderAuth + the org host from
// process.env.SALESFORCE_INSTANCE_URL). Rule-based, zero AI spend; tier-gated to Pro+
// (inflow) like every connector.

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { SALESFORCE_API_VERSION } from "./salesforce.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type SalesforceIngestResult = { inserted: number; skipped: number; source: string };

export type SalesforceOpportunity = {
  Id?: string;
  Name?: string;
  StageName?: string;
  Amount?: number | null;
  Description?: string | null;
};

const LOST_OPPS_SOQL =
  "SELECT Id,Name,StageName,Amount,Description FROM Opportunity WHERE IsClosed=true AND IsWon=false ORDER BY CloseDate DESC LIMIT 30";

/** PURE - map one closed-lost opportunity to a SignalCandidate, or null when it has no
 *  id (no idempotency key). untrusted:true routes the seller/customer text through the
 *  injection screen in writeSignals. instanceUrl builds the record's deep link. */
export function opportunityToCandidate(
  o: SalesforceOpportunity,
  instanceUrl: string,
): SignalCandidate | null {
  if (!o.Id) return null;
  const title = `Opportunity lost: ${o.Name || o.Id}`.slice(0, 300);
  const content = (
    o.Description || `Stage: ${o.StageName || ""}, Amount: ${o.Amount ?? "n/a"}`
  ).slice(0, 1500);
  return {
    externalId: `salesforce:opp_lost:${o.Id}`,
    source: "salesforce",
    sourceKind: "pull_connector",
    title,
    content: content || title,
    url: `${instanceUrl}/${o.Id}`,
    untrusted: true,
  };
}

async function fetchLostOpps(token: string, instance: string): Promise<SalesforceOpportunity[]> {
  const url = `${instance}/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(
    LOST_OPPS_SOQL,
  )}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { records?: SalesforceOpportunity[] };
  return body.records ?? [];
}

/**
 * Pull recent closed-lost Salesforce opportunities for one workspace and write them as
 * signals. Returns {inserted, skipped, source}; skips cleanly (source "none") when the
 * workspace has no Salesforce credential, SALESFORCE_INSTANCE_URL is unset, or its plan
 * tier lacks inflow.
 */
export async function ingestSalesforceSignals(
  userId: string,
  workspaceId: string,
): Promise<SalesforceIngestResult> {
  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "salesforce",
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

  const instance = process.env.SALESFORCE_INSTANCE_URL;
  if (!instance) return { inserted: 0, skipped: 0, source: "none" };

  const opps = await fetchLostOpps(token, instance);
  if (opps.length === 0) return { inserted: 0, skipped: 0, source: "salesforce" };

  const candidates = opps
    .slice(0, MAX_ITEMS)
    .map((o) => opportunityToCandidate(o, instance))
    .filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "salesforce" };
}

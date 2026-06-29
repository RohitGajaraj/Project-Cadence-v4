// SF-CONNECTORS (Signal Fabric Phase 2) - pull recent Zendesk support tickets as signals,
// through the writeSignals sink (dedup via external_id, source_kind "pull_connector").
// Customer-written ticket text (subject + description) is UNTRUSTED external input, so each
// item is screened for prompt injection by the sink before it is stored. Mirrors
// intercom-ingest.server.ts. Called from sense-tick for any workspace with a Zendesk
// credential (env ZENDESK_API_TOKEN today; OAuth gateway once registered). The subdomain
// and agent email are read from process.env - they are not carried in ResolvedAuth.
// Rule-based, zero AI spend; tier-gated to Pro+ (inflow) like every connector.

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { authHeader } from "./zendesk.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type ZendeskIngestResult = { inserted: number; skipped: number; source: string };

export type ZendeskTicket = {
  id?: number | string;
  subject?: string | null;
  description?: string | null;
};

/** PURE - map one Zendesk ticket to a SignalCandidate, or null when it has no id.
 *  untrusted:true routes the customer text through the injection screen in writeSignals. */
export function ticketToCandidate(t: ZendeskTicket, subdomain: string): SignalCandidate | null {
  if (t.id == null) return null;
  const title = (t.subject || "Zendesk ticket").slice(0, 300);
  const content = (t.description || t.subject || title).slice(0, 1500);
  return {
    externalId: `zendesk:ticket:${t.id}`,
    source: "zendesk",
    sourceKind: "pull_connector",
    title,
    content,
    url: `https://${subdomain}.zendesk.com/agent/tickets/${t.id}`,
    untrusted: true,
  };
}

async function fetchTickets(
  token: string,
  subdomain: string,
  email: string,
): Promise<ZendeskTicket[]> {
  const res = await fetch(
    `https://${subdomain}.zendesk.com/api/v2/tickets.json?sort_by=created_at&sort_order=desc&per_page=${MAX_ITEMS}`,
    { headers: { Accept: "application/json", Authorization: authHeader(email, token) } },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { tickets?: ZendeskTicket[] };
  return body.tickets ?? [];
}

/**
 * Pull recent Zendesk support tickets for one workspace and write them as signals.
 * Returns {inserted, skipped, source}; skips cleanly (source "none") when the workspace
 * has no Zendesk credential, the subdomain/email env is unset, or its plan tier lacks inflow.
 */
export async function ingestZendeskSignals(
  userId: string,
  workspaceId: string,
): Promise<ZendeskIngestResult> {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  if (!subdomain || !email) return { inserted: 0, skipped: 0, source: "none" };

  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "zendesk",
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

  const tickets = await fetchTickets(token, subdomain, email);
  if (tickets.length === 0) return { inserted: 0, skipped: 0, source: "zendesk" };

  const candidates = tickets
    .map((t) => ticketToCandidate(t, subdomain))
    .filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "zendesk" };
}

// SF-INTERCOM (Signal Fabric Phase 1) — pull recent Intercom support conversations as
// signals, through the writeSignals sink (dedup via external_id, source_kind
// "pull_connector"). Customer-written support text is UNTRUSTED external input, so each
// item is screened for prompt injection by the sink before it is stored. Mirrors
// github-ingest.server.ts. Called from sense-tick for any workspace with an Intercom
// credential (env INTERCOM_ACCESS_TOKEN today; OAuth gateway once registered).
// Rule-based, zero AI spend; tier-gated to Pro+ (inflow) like every connector.

import { resolveProviderAuth } from "../resolve.server";
import { intercomBearer, INTERCOM_API, INTERCOM_HEADERS } from "./intercom.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type IntercomIngestResult = { inserted: number; skipped: number; source: string };

export type IntercomConversation = {
  id?: string | number;
  title?: string | null;
  source?: { subject?: string | null; body?: string | null } | null;
};

/** Strip HTML tags + decode the few common entities + collapse whitespace from
 *  Intercom's rich-text conversation bodies. PURE (no I/O), so it is unit-testable. */
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** PURE — map one Intercom conversation to a SignalCandidate, or null when it has no id.
 *  untrusted:true routes the customer text through the injection screen in writeSignals. */
export function conversationToCandidate(c: IntercomConversation): SignalCandidate | null {
  if (c.id == null) return null;
  const subject = (c.source?.subject ?? c.title ?? "").trim();
  const body = stripHtml(c.source?.body ?? "");
  const title = (subject || body || "Intercom conversation").slice(0, 300);
  return {
    externalId: `intercom:conv:${c.id}`,
    source: "intercom",
    sourceKind: "pull_connector",
    title,
    content: (body || subject || title).slice(0, 1500),
    url: `https://app.intercom.com/a/inbox/_/inbox/conversation/${c.id}`,
    untrusted: true,
  };
}

async function fetchConversations(token: string): Promise<IntercomConversation[]> {
  const res = await fetch(`${INTERCOM_API}/conversations?per_page=${MAX_ITEMS}`, {
    headers: { ...INTERCOM_HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { conversations?: IntercomConversation[] };
  return body.conversations ?? [];
}

/**
 * Pull recent Intercom support conversations for one workspace and write them as
 * signals. Returns {inserted, skipped, source}; skips cleanly (source "none") when the
 * workspace has no Intercom credential or its plan tier lacks inflow.
 */
export async function ingestIntercomSignals(
  userId: string,
  workspaceId: string,
): Promise<IntercomIngestResult> {
  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "intercom",
      userId,
      workspaceId,
      resourceKind: "inbox",
      requiredCapability: "inflow",
    });
    token = intercomBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error — workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!token) return { inserted: 0, skipped: 0, source: "none" };

  const convos = await fetchConversations(token);
  if (convos.length === 0) return { inserted: 0, skipped: 0, source: "intercom" };

  const candidates = convos
    .map(conversationToCandidate)
    .filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "intercom" };
}

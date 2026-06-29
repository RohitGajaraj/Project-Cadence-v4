// SF-CONNECTORS (Signal Fabric Phase 2) - pull recent Slack messages from one feedback
// channel as signals, through the writeSignals sink (dedup via external_id, source_kind
// "pull_connector"). The channel id comes from SLACK_SIGNAL_CHANNEL; with no channel set
// there is nothing to read, so we skip cleanly (source "none"). Customer/teammate-written
// chat text is UNTRUSTED external input, so each item is flagged untrusted:true and the
// sink screens it for prompt injection before storing. Mirrors intercom-ingest.server.ts.
// Rule-based, zero AI spend; tier-gated to Pro+ (inflow) like every connector.
//
// Slack quirk: the Web API answers HTTP 200 even on failure - the real result is in
// body.ok, so fetchMessages always checks body.ok, never res.ok alone.

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { SLACK_API } from "./slack.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type SlackIngestResult = { inserted: number; skipped: number; source: string };

export type SlackMessage = { ts?: string; text?: string; subtype?: string };

/** PURE - map one Slack message to a SignalCandidate, or null when it has no stable id
 *  (no ts) or no text. Messages with a subtype (channel joins, bot posts, system notices)
 *  are skipped. untrusted:true routes the chat text through the injection screen in
 *  writeSignals. Takes the channel id so the externalId is stable per (channel, ts). */
export function messageToCandidate(msg: SlackMessage, channel: string): SignalCandidate | null {
  if (!msg.ts || !msg.text || msg.subtype) return null;
  const text = String(msg.text);
  const title = (text.split("\n")[0].slice(0, 120) || "Slack message").slice(0, 300);
  return {
    externalId: `slack:msg:${channel}:${msg.ts}`,
    source: "slack",
    sourceKind: "pull_connector",
    title,
    content: (text.slice(0, 1500) || title).slice(0, 1500),
    url: null,
    untrusted: true,
  };
}

async function fetchMessages(token: string, channel: string): Promise<SlackMessage[]> {
  const res = await fetch(
    `${SLACK_API}/conversations.history?channel=${encodeURIComponent(channel)}&limit=${MAX_ITEMS}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  // Slack normally answers 200 + {ok:false} on logical errors (handled below), but a
  // rate-limit (429) or outage (5xx) can return a non-2xx with an empty/HTML body that
  // would make res.json() throw and escape the connector. Guard the transport layer first
  // so a throttled or down Slack fails safe to [] (mirrors the intercom-ingest pattern).
  if (!res.ok) return [];
  const body = (await res.json()) as { ok?: boolean; messages?: SlackMessage[] };
  if (!body.ok) return [];
  return body.messages ?? [];
}

/**
 * Pull recent Slack messages from the configured feedback channel for one workspace and
 * write them as signals. Returns {inserted, skipped, source}; skips cleanly (source
 * "none") when there is no feedback channel configured, no Slack credential, or the plan
 * tier lacks inflow.
 */
export async function ingestSlackSignals(
  userId: string,
  workspaceId: string,
): Promise<SlackIngestResult> {
  // No feedback channel configured - nothing to read.
  const channel = process.env.SLACK_SIGNAL_CHANNEL;
  if (!channel) return { inserted: 0, skipped: 0, source: "none" };

  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "slack",
      userId,
      workspaceId,
      resourceKind: "channel",
      requiredCapability: "inflow",
    });
    token = tokenBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error - workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!token) return { inserted: 0, skipped: 0, source: "none" };

  const messages = await fetchMessages(token, channel);
  if (messages.length === 0) return { inserted: 0, skipped: 0, source: "slack" };

  const candidates = messages
    .map((m) => messageToCandidate(m, channel))
    .filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "slack" };
}

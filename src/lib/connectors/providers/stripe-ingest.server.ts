// SF-CONNECTORS (Signal Fabric Phase 2) - pull recent Stripe canceled subscriptions as
// churn signals, through the writeSignals sink (dedup via external_id, source_kind
// "pull_connector"). The cancellation feedback enum is Stripe-controlled, but the
// free-text cancellation comment is CUSTOMER-WRITTEN and therefore UNTRUSTED external
// input, so each item is flagged untrusted and screened for prompt injection by the sink
// before it is stored. Mirrors intercom-ingest.server.ts. Called from sense-tick for any
// workspace with a Stripe credential (env STRIPE_API_KEY today; vault connection once
// registered). Rule-based, zero AI spend; tier-gated to Pro+ (inflow) like every connector.

import { resolveProviderAuth } from "../resolve.server";
import { stripeBearer, STRIPE_API } from "./stripe.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type StripeIngestResult = { inserted: number; skipped: number; source: string };

export type StripeSubscription = {
  id?: string;
  cancellation_details?: { feedback?: string | null; comment?: string | null } | null;
};

/** PURE - map one canceled Stripe subscription to a SignalCandidate, or null when it has
 *  no id (no idempotency key). untrusted:true routes the customer-written cancellation
 *  comment through the injection screen in writeSignals. Does ZERO I/O so it is testable. */
export function subscriptionToCandidate(sub: StripeSubscription): SignalCandidate | null {
  if (!sub.id) return null;
  const feedback = sub.cancellation_details?.feedback || "";
  const comment = sub.cancellation_details?.comment || "";
  const title = ("Subscription canceled" + (feedback ? ": " + feedback : "")).slice(0, 300);
  const content = (comment || feedback || "A subscription was canceled.").slice(0, 1500);
  return {
    externalId: `stripe:sub_canceled:${sub.id}`,
    source: "stripe",
    sourceKind: "pull_connector",
    title,
    content,
    url: `https://dashboard.stripe.com/subscriptions/${sub.id}`,
    untrusted: true,
  };
}

async function fetchCanceledSubscriptions(token: string): Promise<StripeSubscription[]> {
  const res = await fetch(`${STRIPE_API}/v1/subscriptions?status=canceled&limit=${MAX_ITEMS}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: StripeSubscription[] };
  return body.data ?? [];
}

/**
 * Pull recent canceled Stripe subscriptions for one workspace and write them as churn
 * signals. Returns {inserted, skipped, source}; skips cleanly (source "none") when the
 * workspace has no Stripe credential or its plan tier lacks inflow.
 */
export async function ingestStripeSignals(
  userId: string,
  workspaceId: string,
): Promise<StripeIngestResult> {
  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "stripe",
      userId,
      workspaceId,
      requiredCapability: "inflow",
    });
    token = stripeBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error - workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!token) return { inserted: 0, skipped: 0, source: "none" };

  const subs = await fetchCanceledSubscriptions(token);
  if (subs.length === 0) return { inserted: 0, skipped: 0, source: "stripe" };

  const candidates = subs
    .map(subscriptionToCandidate)
    .filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "stripe" };
}

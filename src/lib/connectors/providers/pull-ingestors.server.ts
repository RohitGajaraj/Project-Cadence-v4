// SF-CONNECTORS (Signal Fabric Phase 2) — the registry of inside-out pull connectors.
//
// sense-tick iterates THIS list instead of hard-coding one ingest call per provider, so
// adding a customer-voice connector is a single line here (not an edit to the cron route).
// Every entry shares the same contract: ingest(userId, workspaceId) resolves its own
// credential through resolveProviderAuth (inflow capability, tier-gated to Pro+), pulls a
// bounded batch, writes through the writeSignals sink, and FAILS SAFE to source "none" when
// the workspace has no credential or its plan tier lacks inflow — so iterating the whole
// list per workspace is cheap and never throws.
//
// Scope note: GitHub keeps its explicit call in sense-tick (different signature — it ingests
// shipped-work issues, not customer voice), and PostHog analytics is Lovable-owned (SEN-05),
// so neither is registered here. This list is the customer-voice fleet only.

import type { ProviderId } from "../registry";
import { ingestIntercomSignals } from "./intercom-ingest.server";
import { ingestStripeSignals } from "./stripe-ingest.server";
import { ingestSlackSignals } from "./slack-ingest.server";
import { ingestZendeskSignals } from "./zendesk-ingest.server";
import { ingestHubSpotSignals } from "./hubspot-ingest.server";
import { ingestSalesforceSignals } from "./salesforce-ingest.server";
import { ingestCannySignals } from "./canny-ingest.server";
import { ingestProductboardSignals } from "./productboard-ingest.server";
import { ingestDelightedSignals } from "./delighted-ingest.server";

/** The shared shape every pull connector's ingest returns. */
export type PullIngestResult = { inserted: number; skipped: number; source: string };

export type PullIngestor = {
  provider: ProviderId;
  ingest: (userId: string, workspaceId: string) => Promise<PullIngestResult>;
};

/** The inside-out customer-voice connectors, in ingest order. */
export const PULL_INGESTORS: PullIngestor[] = [
  { provider: "intercom", ingest: ingestIntercomSignals },
  { provider: "stripe", ingest: ingestStripeSignals },
  { provider: "slack", ingest: ingestSlackSignals },
  { provider: "zendesk", ingest: ingestZendeskSignals },
  { provider: "hubspot", ingest: ingestHubSpotSignals },
  { provider: "salesforce", ingest: ingestSalesforceSignals },
  { provider: "canny", ingest: ingestCannySignals },
  { provider: "productboard", ingest: ingestProductboardSignals },
  { provider: "delighted", ingest: ingestDelightedSignals },
];

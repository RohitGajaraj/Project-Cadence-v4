// SF-CONNECTORS (Signal Fabric Phase 2) - Salesforce CRM win/loss connector adapter
// (server-only). Validates a Salesforce access token against the org's REST limits
// endpoint. The ingest side (salesforce-ingest.server.ts) pulls closed-lost
// opportunities as signals through writeSignals. The org host is read directly from
// process.env.SALESFORCE_INSTANCE_URL (e.g. https://x.my.salesforce.com); the bearer
// token resolves through resolveProviderAuth like every connector. Mirrors
// intercom.server.ts and imports the shared tokenBearer unwrap from bearer.server.

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

export const SALESFORCE_API_VERSION = "v59.0";

export const salesforceAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const token = tokenBearer(auth);
    if (!token) return { ok: false, detail: "unsupported auth kind for salesforce" };
    const instance = process.env.SALESFORCE_INSTANCE_URL;
    if (!instance) return { ok: false, detail: "SALESFORCE_INSTANCE_URL not set" };
    try {
      const res = await fetch(`${instance}/services/data/${SALESFORCE_API_VERSION}/limits`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return { ok: false, detail: `Salesforce token check failed (${res.status})` };
      return { ok: true, accountLabel: null };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

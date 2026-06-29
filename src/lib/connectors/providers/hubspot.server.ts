// SF-CONNECTORS (Signal Fabric Phase 2) - HubSpot CRM win/loss connector adapter (server-only).
// Validates a HubSpot private-app access token by probing the deals endpoint. The ingest side
// (hubspot-ingest.server.ts) pulls closed-lost deals as signals through writeSignals - the loss
// reason and amount that sales recorded are exactly the win/loss evidence the product needs.
// Mirrors intercom.server.ts. Closed-lost deal text (the loss reason) is operator-entered CRM
// data, but it still originates outside the trust boundary, so the ingest flags it untrusted and
// the sink screens it for prompt injection before storing.

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

export const HUBSPOT_API = "https://api.hubapi.com";

export const hubspotAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const token = tokenBearer(auth);
    if (!token) return { ok: false, detail: "unsupported auth kind for hubspot" };
    try {
      const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals?limit=1`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return { ok: false, detail: `HubSpot token check failed (${res.status})` };
      return { ok: true, accountLabel: null };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

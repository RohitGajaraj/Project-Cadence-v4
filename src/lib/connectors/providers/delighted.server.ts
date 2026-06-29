// SF-CONNECTORS (Signal Fabric Phase 2) - Delighted NPS / CSAT survey connector adapter
// (server-only). Validates a Delighted API key and, on the ingest side
// (delighted-ingest.server.ts), pulls recent survey responses as signals through
// writeSignals. Delighted authenticates with HTTP Basic, the API key as the username
// and an EMPTY password, so the header is "Basic " + base64(apiKey + ":"). Mirrors
// intercom.server.ts. Env fallback today (DELIGHTED_API_KEY); vault/gateway once
// registered. The shared tokenBearer unwrap supplies the raw key.

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

export const DELIGHTED_API = "https://api.delighted.com/v1";

/** Delighted Basic auth: api key is the username, password is empty. */
export function authHeader(apiKey: string): string {
  return "Basic " + btoa(apiKey + ":");
}

export const delightedAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const apiKey = tokenBearer(auth);
    if (!apiKey) return { ok: false, detail: "unsupported auth kind for delighted" };
    try {
      const res = await fetch(`${DELIGHTED_API}/metrics.json`, {
        headers: { Accept: "application/json", Authorization: authHeader(apiKey) },
      });
      if (!res.ok) return { ok: false, detail: `Delighted key check failed (${res.status})` };
      return { ok: true, accountLabel: null };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

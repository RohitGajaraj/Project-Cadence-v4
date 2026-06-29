// SF-CONNECTORS (Signal Fabric Phase 2) - Zendesk support-ticket connector adapter (server-only).
// Validates a Zendesk API token and confirms the agent identity. The ingest side
// (zendesk-ingest.server.ts) pulls recent support tickets as signals through writeSignals.
// Mirrors intercom.server.ts. Zendesk uses HTTP Basic auth with the token form
// "<email>/token:<apiToken>" base64-encoded; the subdomain + email are read from
// process.env (ZENDESK_SUBDOMAIN / ZENDESK_EMAIL) since they are not part of ResolvedAuth -
// only the token itself flows through resolveProviderAuth (env ZENDESK_API_TOKEN today).

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

/**
 * Build the Zendesk Basic auth header. Zendesk API-token auth uses the form
 * "<email>/token:<apiToken>" base64-encoded - btoa is a Workers global.
 */
export function authHeader(email: string, token: string): string {
  return "Basic " + btoa(email + "/token:" + token);
}

export const zendeskAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const token = tokenBearer(auth);
    if (!token) return { ok: false, detail: "unsupported auth kind for zendesk" };
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    const email = process.env.ZENDESK_EMAIL;
    if (!subdomain || !email) {
      return { ok: false, detail: "ZENDESK_SUBDOMAIN / ZENDESK_EMAIL not set" };
    }
    try {
      const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/users/me.json`, {
        headers: { Accept: "application/json", Authorization: authHeader(email, token) },
      });
      if (!res.ok) return { ok: false, detail: `Zendesk token check failed (${res.status})` };
      const body = (await res.json()) as { user?: { name?: string; email?: string } };
      return {
        ok: true,
        accountLabel: body.user?.name ?? null,
        accountEmail: body.user?.email ?? null,
      };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

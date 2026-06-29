// SF-CONNECTORS (Signal Fabric Phase 2) — Productboard customer-feedback connector
// adapter (server-only). Validates a Productboard API token and the companion ingest
// (productboard-ingest.server.ts) pulls customer notes (feature requests / feedback) as
// signals through writeSignals. Productboard requires both an Authorization Bearer token
// AND a fixed "X-Version: 1" header on every request - the version header is part of the
// contract, not optional. Mirrors intercom.server.ts; the raw token is unwrapped by the
// shared tokenBearer helper (env PRODUCTBOARD_API_TOKEN today; OAuth gateway once
// registered).

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

export const PRODUCTBOARD_API = "https://api.productboard.com";
export const PRODUCTBOARD_HEADERS = {
  Accept: "application/json",
  "X-Version": "1",
} as const;

export const productboardAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const token = tokenBearer(auth);
    if (!token) return { ok: false, detail: "unsupported auth kind for productboard" };
    try {
      const res = await fetch(`${PRODUCTBOARD_API}/notes?pageLimit=1`, {
        headers: { ...PRODUCTBOARD_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, detail: `Productboard token check failed (${res.status})` };
      return { ok: true, accountLabel: null };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

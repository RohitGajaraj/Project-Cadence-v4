// SF-CONNECTORS (Signal Fabric Phase 2) — Canny feature-request portal adapter (server-only).
// Validates a Canny API key and (later) lets the ingest side pull recent posts as signals
// through writeSignals. Canny is unusual: the apiKey is sent in the POST BODY (JSON), not in
// an Authorization header — so every call here POSTs { apiKey } rather than setting a bearer.
// The raw key comes from the shared tokenBearer unwrap (env/vault only); gateway-held creds
// return null. The thin slice ships on the env key (CANNY_API_KEY).

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

export const CANNY_API = "https://canny.io/api/v1";
export const CANNY_HEADERS = { "Content-Type": "application/json" } as const;

export const cannyAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const apiKey = tokenBearer(auth);
    if (!apiKey) return { ok: false, detail: "unsupported auth kind for canny" };
    try {
      const res = await fetch(`${CANNY_API}/boards/list`, {
        method: "POST",
        headers: CANNY_HEADERS,
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) return { ok: false, detail: `Canny key check failed (${res.status})` };
      return { ok: true, accountLabel: null };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

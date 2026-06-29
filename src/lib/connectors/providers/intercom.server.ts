// SF-INTERCOM (Signal Fabric Phase 1) — Intercom support connector adapter (server-only).
// Validates an Intercom access token and enumerates admin inboxes. The ingest side
// (intercom-ingest.server.ts) pulls support conversations as signals through writeSignals.
// Mirrors github.server.ts. OAuth-gateway tokens are gateway-held (no directly-usable
// bearer), so the thin slice runs on the env/token credential; full gateway support
// lands with the gateway-proxy work.

import type { ConnectorAdapter, ResourceItem, ValidateResult } from "./types.server";
import type { ResolvedAuth } from "../resolve.server";

export const INTERCOM_API = "https://api.intercom.io";
export const INTERCOM_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "Intercom-Version": "2.11",
} as const;

/**
 * The directly-callable bearer for Intercom: env/token credentials carry the raw
 * token; gateway/github_app do not (the gateway proxies the call), so they return
 * null here. The thin slice ships on the env token (INTERCOM_ACCESS_TOKEN).
 */
export function intercomBearer(auth: ResolvedAuth | null): string | null {
  if (!auth) return null;
  if (auth.kind === "token" || auth.kind === "env") return auth.token;
  return null;
}

export const intercomAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const token = intercomBearer(auth);
    if (!token) return { ok: false, detail: "unsupported auth kind for intercom" };
    try {
      const res = await fetch(`${INTERCOM_API}/me`, {
        headers: { ...INTERCOM_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, detail: `Intercom token check failed (${res.status})` };
      const body = (await res.json()) as {
        name?: string;
        email?: string;
        app?: { name?: string };
      };
      return {
        ok: true,
        accountLabel: body.app?.name ?? body.name ?? null,
        accountEmail: body.email ?? null,
      };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },

  async listResources(auth, kind): Promise<ResourceItem[]> {
    if (kind !== "inbox") return [];
    const token = intercomBearer(auth);
    if (!token) return [];
    try {
      const res = await fetch(`${INTERCOM_API}/admins`, {
        headers: { ...INTERCOM_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        admins?: Array<{ id?: string | number; name?: string; email?: string }>;
      };
      return (body.admins ?? [])
        .filter((a) => a.id != null)
        .map((a) => ({ id: String(a.id), label: a.name ?? a.email ?? String(a.id) }));
    } catch {
      return [];
    }
  },
};

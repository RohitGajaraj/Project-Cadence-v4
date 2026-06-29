// SF-CONNECTORS (Signal Fabric Phase 2) - Stripe billing connector adapter (server-only).
// Validates a Stripe secret key and labels the account. The ingest side
// (stripe-ingest.server.ts) pulls canceled subscriptions as churn signals through
// writeSignals. Mirrors intercom.server.ts. Stripe authenticates with a Bearer secret
// key (env STRIPE_API_KEY); the shared tokenBearer helper unwraps the raw token from a
// vault/env credential (gateway/github_app kinds proxy elsewhere and return null).
// Stripe exposes no bindable resource for this slice, so there is no listResources.

import type { ConnectorAdapter, ValidateResult } from "./types.server";
import { tokenBearer } from "./bearer.server";

export const STRIPE_API = "https://api.stripe.com";

/** Stripe's directly-callable bearer is just the shared token unwrap. */
export const stripeBearer = tokenBearer;

export const stripeAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    const token = stripeBearer(auth);
    if (!token) return { ok: false, detail: "unsupported auth kind for stripe" };
    try {
      const res = await fetch(`${STRIPE_API}/v1/account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, detail: `Stripe token check failed (${res.status})` };
      const body = (await res.json()) as {
        id?: string;
        business_profile?: { name?: string | null } | null;
        settings?: { dashboard?: { display_name?: string | null } | null } | null;
      };
      return {
        ok: true,
        accountLabel:
          body.settings?.dashboard?.display_name ?? body.business_profile?.name ?? body.id ?? null,
      };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};

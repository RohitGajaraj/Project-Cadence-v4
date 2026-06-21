import { createFileRoute } from "@tanstack/react-router";

/**
 * RETIRED 2026-06-21 (M-C-DEDUPE-WEBHOOK). The live Stripe webhook is
 * `src/routes/api/public/payments/webhook.ts` (signature-verified, account-level, tier
 * mapped via billing-tier.ts, credit-aware). This legacy M-C route hardcoded tier 'pro'
 * and wrote `workspaces.plan_tier` + `stripe_*` columns that are now RLS-revoked - a
 * footgun if it were ever wired to a Stripe endpoint. Its logic is gutted to a harmless
 * no-op: a stale endpoint still pointed here gets a 200 (so Stripe does not retry) and
 * NOTHING is written. Do not re-add logic here; extend the canonical webhook instead.
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async () => {
        console.warn(
          "Deprecated /api/stripe/webhook hit; the live webhook is /api/public/payments/webhook. Ignoring.",
        );
        return new Response(
          JSON.stringify({ ok: true, deprecated: true, use: "/api/public/payments/webhook" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});

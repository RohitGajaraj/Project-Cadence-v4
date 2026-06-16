import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePlanTier } from "@/lib/entitlements";

/**
 * M-C Stripe webhook: maps subscription state to workspaces.plan_tier.
 *
 * Stripe sends the raw body + a `stripe-signature` header. We verify the HMAC
 * (Web Crypto, Workers-compatible) before trusting the event, then write the plan
 * via the service-role client, which is the only writer the protect trigger lets
 * change plan_tier.
 *
 * Gated on STRIPE_WEBHOOK_SECRET: returns a 200 no-op until billing is configured,
 * so Stripe is not retried and the route is harmless before setup.
 */

const TOLERANCE_SECONDS = 300;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  // Header shape: "t=<ts>,v1=<sig>[,v1=<sig>...]".
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  // Replay window: reject signatures outside the tolerance.
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Length-then-constant-time compare.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

async function setPlan(
  admin: SupabaseClient,
  workspaceId: string,
  tier: string,
  customer?: string | null,
  subscription?: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    plan_tier: normalizePlanTier(tier),
    plan_updated_at: new Date().toISOString(),
  };
  if (customer) update["stripe_customer_id"] = customer;
  if (subscription !== undefined) update["stripe_subscription_id"] = subscription;
  const { error } = await admin.from("workspaces").update(update).eq("id", workspaceId);
  if (error) throw new Error(error.message);
}

function workspaceIdOf(obj: Record<string, unknown>): string | undefined {
  const direct = obj["client_reference_id"];
  if (typeof direct === "string" && direct) return direct;
  const md = (obj["metadata"] as Record<string, unknown> | undefined) ?? {};
  const fromMeta = md["workspace_id"];
  return typeof fromMeta === "string" && fromMeta ? fromMeta : undefined;
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return json({ ok: false, reason: "not configured" }, 200);

        const sig = request.headers.get("stripe-signature") ?? "";
        const payload = await request.text();
        const valid = await verifyStripeSignature(payload, sig, secret);
        if (!valid) return json({ ok: false, error: "bad signature" }, 400);

        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(payload);
        } catch {
          return json({ ok: false, error: "invalid JSON" }, 400);
        }

        const type = event.type ?? "";
        const obj = (event.data?.object ?? {}) as Record<string, unknown>;
        const admin = supabaseAdmin as unknown as SupabaseClient;

        try {
          if (type === "checkout.session.completed") {
            const workspaceId = workspaceIdOf(obj);
            if (workspaceId) {
              await setPlan(
                admin,
                workspaceId,
                "pro",
                obj["customer"] as string | undefined,
                obj["subscription"] as string | undefined,
              );
            }
          } else if (
            type === "customer.subscription.updated" ||
            type === "customer.subscription.created"
          ) {
            const workspaceId = workspaceIdOf(obj);
            const status = obj["status"] as string | undefined;
            const tier = status === "active" || status === "trialing" ? "pro" : "free";
            if (workspaceId) {
              await setPlan(
                admin,
                workspaceId,
                tier,
                obj["customer"] as string | undefined,
                obj["id"] as string | undefined,
              );
            }
          } else if (type === "customer.subscription.deleted") {
            const workspaceId = workspaceIdOf(obj);
            if (workspaceId) {
              await setPlan(
                admin,
                workspaceId,
                "free",
                obj["customer"] as string | undefined,
                null,
              );
            }
          }
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});

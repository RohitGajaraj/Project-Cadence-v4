import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  creditsFromLookupKey,
  effectiveTierForStatus,
  subscriptionStatusGrantsCredits,
  tierFromLookupKey,
} from "@/lib/billing-tier";
import {
  buildSubscriptionUpdate,
  buildSubscriptionUpsert,
  isRenewalInvoice,
  isTopupCheckout,
  resolvePriceLookup,
  resolveTopupCredits,
} from "@/lib/billing-webhook";

import { invoiceSubscriptionId } from "@/lib/stripe-invoice";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

/**
 * Flip plan_tier on the user's account (and the workspaces shim for back-compat).
 * Service-role client, so RLS does not block. No-op if we cannot derive a tier
 * (e.g. top-up checkout, unrecognized lookup key) or the user has no account row.
 */
async function applyTierForUser(userId: string, lookupKey: string | undefined, status: string) {
  if (!lookupKey) return;
  const tier = tierFromLookupKey(lookupKey);
  if (!tier) return;
  // Keep paid access through dunning (past_due); downgrade to free on real termination.
  // The rule is the tested `effectiveTierForStatus` so the three subscription handlers can't drift.
  const effectiveTier = effectiveTierForStatus(tier, status);
  const sb = getSupabase();
  // Account-level (preferred): every account row owned by this user.
  const { data: accounts } = await sb
    .from("accounts" as any)
    .select("id")
    .eq("owner_id", userId);
  const accountIds = (accounts as Array<{ id: string }> | null)?.map((a) => a.id) ?? [];
  if (accountIds.length) {
    await sb
      .from("accounts" as any)
      .update({ plan_tier: effectiveTier })
      .in("id", accountIds);
  }
  // Workspaces shim: any workspace owned by this user.
  await sb
    .from("workspaces" as any)
    .update({ plan_tier: effectiveTier })
    .eq("owner_id", userId);
}

/** Resolve the caller's account id (service-role; creates the default account if missing). */
async function resolveAccountId(userId: string): Promise<string | null> {
  try {
    const admin = getSupabase() as unknown as SupabaseClient;
    const { data } = await admin.rpc("ensure_user_default_account", { _user_id: userId });
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("resolveAccountId failed:", e);
    return null;
  }
}

/**
 * Grant the bundle's monthly credit allowance to the user's account on an active
 * subscription. The grant RPC is idempotent (a no-op when the allowance already matches,
 * so retries and status-only updates do not re-grant) and UNGATED: it only sets the
 * included balance, which is harmless while metering is off and keeps balances correct for
 * the go-live flip. Credits resolve from the bundle's lookup_key, so any catalog bundle
 * grants the right amount.
 */
async function grantForSubscription(
  userId: string | undefined,
  lookupKey: string | undefined,
  status: string,
): Promise<void> {
  if (!userId || !lookupKey) return;
  // Only a genuinely paying state mints credits; past_due keeps access but not a fresh allowance.
  if (!subscriptionStatusGrantsCredits(status)) return;
  const credits = creditsFromLookupKey(lookupKey);
  if (!credits || credits <= 0) return;
  const accountId = await resolveAccountId(userId);
  if (!accountId) return;
  try {
    const admin = getSupabase() as unknown as SupabaseClient;
    await admin.rpc("grant_subscription_credits", { _account_id: accountId, _credits: credits });
  } catch (e) {
    console.error("grantForSubscription failed:", e);
  }
}

async function handleSubscriptionCreated(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("Webhook: subscription has no userId metadata", sub.id);
    return;
  }
  const priceId = resolvePriceLookup(sub.items?.data?.[0]);

  await getSupabase()
    .from("subscriptions")
    .upsert(buildSubscriptionUpsert(sub, env, new Date().toISOString()), {
      onConflict: "stripe_subscription_id",
    });
  await applyTierForUser(userId, priceId, sub.status);
  await grantForSubscription(userId, priceId, sub.status);
}

async function handleSubscriptionUpdated(sub: any, env: StripeEnv) {
  const priceId = resolvePriceLookup(sub.items?.data?.[0]);

  await getSupabase()
    .from("subscriptions")
    .update(buildSubscriptionUpdate(sub, new Date().toISOString()))
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  const userId = sub.metadata?.userId;
  if (userId) await applyTierForUser(userId, priceId, sub.status);
  await grantForSubscription(userId, priceId, sub.status);
}

async function handleSubscriptionDeleted(sub: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  const userId = sub.metadata?.userId;
  const item = sub.items?.data?.[0];
  const priceId = resolvePriceLookup(item);
  if (userId && priceId) await applyTierForUser(userId, priceId, "canceled");
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (!isTopupCheckout(session)) return;
  const userId = session.metadata?.userId;

  const lineItems = await fetch(
    `https://connector-gateway.lovable.dev/stripe/v1/checkout/sessions/${session.id}/line_items`,
    {
      headers: {
        "X-Connection-Api-Key":
          env === "sandbox"
            ? process.env.STRIPE_SANDBOX_API_KEY!
            : process.env.STRIPE_LIVE_API_KEY!,
        "Lovable-API-Key": process.env.LOVABLE_API_KEY!,
      },
    },
  ).then(
    (r) => r.json() as Promise<{ data: Array<{ price: { lookup_key?: string; id: string } }> }>,
  );

  const lookupKey = lineItems.data?.[0]?.price?.lookup_key;
  // Resolve credits from the bundle's lookup_key first (covers ANY catalog bundle), then
  // the static map as a fallback for legacy keys. Pure + tested in billing-webhook.ts.
  const credits = resolveTopupCredits(lookupKey);
  if (!credits) {
    console.error("Webhook: top-up has unknown lookup_key", lookupKey);
    return;
  }

  const accountId = await resolveAccountId(userId);
  if (!accountId) {
    console.error("Webhook: no account for top-up user", userId);
    return;
  }

  // apply_topup_credits records the purchase, credits the spendable balance, and writes the
  // ledger row atomically + idempotently (exactly once per Stripe session). This is the
  // M-C-TOPUP fix: the old code wrote credit_topups but the credits never reached the
  // balance, so a paying customer's top-up was lost.
  const admin = getSupabase() as unknown as SupabaseClient;
  await admin.rpc("apply_topup_credits", {
    _user_id: userId,
    _account_id: accountId,
    _session_id: session.id,
    _payment_intent_id: session.payment_intent ?? null,
    _credits: credits,
    _amount_cents: session.amount_total ?? 0,
    _currency: session.currency ?? "usd",
    _lookup_key: lookupKey ?? null,
    _env: env,
  });
}

/**
 * Mirror invoice payment outcomes onto subscriptions.status so the dunning
 * banner reacts immediately, without waiting for the next
 * customer.subscription.updated event. We do NOT change plan_tier here:
 * per founder ruling, access is preserved while Stripe retries the card.
 */
async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  // Basil+ removed top-level invoice.subscription; resolve it version-robustly.
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;
  await getSupabase()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
}

async function handleInvoicePaymentSucceeded(invoice: any, env: StripeEnv) {
  // Basil+ removed top-level invoice.subscription; resolve it version-robustly.
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;
  const admin = getSupabase() as unknown as SupabaseClient;
  await admin
    .from("subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
  // On a renewal invoice (not the first), refill the cycle's included allowance. The first
  // invoice is billing_reason 'subscription_create' and is already covered by the
  // grant-on-subscribe path; only 'subscription_cycle' (a true renewal) refills here.
  if (!isRenewalInvoice(invoice)) return;
  const { data: sub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subId)
    .eq("environment", env)
    .maybeSingle();
  const userId = (sub as { user_id?: string } | null)?.user_id;
  if (!userId) return;
  const accountId = await resolveAccountId(userId);
  if (!accountId) return;
  try {
    await admin.rpc("reset_subscription_cycle", { _account_id: accountId });
  } catch (e) {
    console.error("reset_subscription_cycle failed:", e);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, env);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object, env);
      break;
    default:
      console.log("Webhook unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env query param:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

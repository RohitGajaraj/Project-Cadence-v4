import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { type StripeEnv, verifyWebhook } from '@/lib/stripe.server';
import { tierFromLookupKey } from '@/lib/billing-tier';

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

function resolvePriceLookup(item: any): string {
  return item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
}

/**
 * Flip plan_tier on the user's account (and the workspaces shim for back-compat).
 * Service-role client, so RLS does not block. No-op if we cannot derive a tier
 * (e.g. top-up checkout, unrecognized lookup key) or the user has no account row.
 */
async function applyTierForUser(userId: string, lookupKey: string, status: string) {
  const tier = tierFromLookupKey(lookupKey);
  if (!tier) return;
  // Treat anything that is not an active-ish status as "back to free" for tier purposes.
  const effectiveTier = (status === 'active' || status === 'trialing' || status === 'past_due')
    ? tier
    : 'free';
  const sb = getSupabase();
  // Account-level (preferred): every account row owned by this user.
  const { data: accounts } = await sb
    .from('accounts' as any)
    .select('id')
    .eq('owner_id', userId);
  const accountIds = (accounts as Array<{ id: string }> | null)?.map((a) => a.id) ?? [];
  if (accountIds.length) {
    await sb.from('accounts' as any).update({ plan_tier: effectiveTier }).in('id', accountIds);
  }
  // Workspaces shim: any workspace owned by this user.
  await sb.from('workspaces' as any).update({ plan_tier: effectiveTier }).eq('owner_id', userId);
}

async function handleSubscriptionCreated(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error('Webhook: subscription has no userId metadata', sub.id);
    return;
  }
  const item = sub.items?.data?.[0];
  const priceId = resolvePriceLookup(item);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase().from('subscriptions').upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer,
    product_id: productId,
    price_id: priceId,
    status: sub.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end || false,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_subscription_id' });
  await applyTierForUser(userId, priceId, sub.status);
}

async function handleSubscriptionUpdated(sub: any, env: StripeEnv) {
  const item = sub.items?.data?.[0];
  const priceId = resolvePriceLookup(item);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase()
    .from('subscriptions')
    .update({
      status: sub.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', sub.id)
    .eq('environment', env);
  const userId = sub.metadata?.userId;
  if (userId) await applyTierForUser(userId, priceId, sub.status);
}

async function handleSubscriptionDeleted(sub: any, env: StripeEnv) {
  await getSupabase()
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id)
    .eq('environment', env);
  const userId = sub.metadata?.userId;
  const item = sub.items?.data?.[0];
  const priceId = resolvePriceLookup(item);
  if (userId && priceId) await applyTierForUser(userId, priceId, 'canceled');
}

const TOPUP_CREDITS: Record<string, number> = {
  topup_250: 250,
  topup_1k: 1000,
  topup_2_5k: 2500,
};

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.mode !== 'payment') return;
  const userId = session.metadata?.userId;
  const kind = session.metadata?.kind;
  if (!userId || kind !== 'topup') return;

  const lineItems = await fetch(
    `https://connector-gateway.lovable.dev/stripe/v1/checkout/sessions/${session.id}/line_items`,
    {
      headers: {
        'X-Connection-Api-Key': env === 'sandbox'
          ? process.env.STRIPE_SANDBOX_API_KEY!
          : process.env.STRIPE_LIVE_API_KEY!,
        'Lovable-API-Key': process.env.LOVABLE_API_KEY!,
      },
    },
  ).then((r) => r.json() as Promise<{ data: Array<{ price: { lookup_key?: string; id: string } }> }>);

  const lookupKey = lineItems.data?.[0]?.price?.lookup_key;
  const credits = lookupKey ? TOPUP_CREDITS[lookupKey] : undefined;
  if (!credits) {
    console.error('Webhook: top-up has unknown lookup_key', lookupKey);
    return;
  }

  await getSupabase().from('credit_topups').upsert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent,
    price_lookup_key: lookupKey!,
    credits_added: credits,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    status: 'completed',
    environment: env,
  }, { onConflict: 'stripe_session_id' });
}

/**
 * Mirror invoice payment outcomes onto subscriptions.status so the dunning
 * banner reacts immediately, without waiting for the next
 * customer.subscription.updated event. We do NOT change plan_tier here:
 * per founder ruling, access is preserved while Stripe retries the card.
 */
async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  const subId = invoice.subscription;
  if (!subId) return;
  await getSupabase()
    .from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subId)
    .eq('environment', env);
}

async function handleInvoicePaymentSucceeded(invoice: any, env: StripeEnv) {
  const subId = invoice.subscription;
  if (!subId) return;
  await getSupabase()
    .from('subscriptions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subId)
    .eq('environment', env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object, env); break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env); break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env); break;
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object, env); break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object, env); break;
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object, env); break;
    default:
      console.log('Webhook unhandled event:', event.type);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
          console.error('Webhook invalid env query param:', rawEnv);
          return Response.json({ received: true, ignored: 'invalid env' });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error('Webhook error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };
type MySubscription = {
  hasSubscription: boolean;
  stripeSubscriptionId?: string;
  status?: string;
  priceId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};
type MutateResult = { ok: true; cancelAtPeriodEnd: boolean } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error('Invalid userId');
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv; quantity?: number }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error('Invalid priceId');
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { userId, claims } = context;
      const email = (claims as { email?: string })?.email;
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error(`Price not found: ${data.priceId}`);
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === 'recurring';
      const isTopup = data.priceId.startsWith('topup_');

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId = typeof stripePrice.product === 'string'
          ? stripePrice.product
          : stripePrice.product.id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
        mode: isRecurring ? 'subscription' : 'payment',
        ui_mode: 'embedded_page',
        return_url: data.returnUrl,
        customer: customerId,
        ...(!isRecurring && { payment_intent_data: { description: productDescription } }),
        metadata: { userId, kind: isTopup ? 'topup' : (isRecurring ? 'subscription' : 'one_time') },
        ...(isRecurring && {
          subscription_data: { metadata: { userId, price_lookup_key: data.priceId } },
        }),
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return { clientSecret: session.client_secret ?? '' };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .eq('environment', data.environment)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return { error: 'No subscription found' };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * In-app subscription read for the Plan page. Returns the latest row from
 * the subscriptions table for the calling user in the current environment.
 */
export const getMySubscription = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<MySubscription> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .eq('environment', data.environment)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return { hasSubscription: false };
    const s = sub as {
      stripe_subscription_id: string;
      status: string;
      price_id: string;
      current_period_end: string | null;
      cancel_at_period_end: boolean | null;
    };
    return {
      hasSubscription: true,
      stripeSubscriptionId: s.stripe_subscription_id,
      status: s.status,
      priceId: s.price_id,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: !!s.cancel_at_period_end,
    };
  });

async function mutateCancelFlag(
  context: { supabase: import('@supabase/supabase-js').SupabaseClient; userId: string },
  environment: StripeEnv,
  cancelAtPeriodEnd: boolean,
): Promise<MutateResult> {
  const { supabase, userId } = context;
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .eq('environment', environment)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = sub as { stripe_subscription_id?: string; status?: string } | null;
  if (!s?.stripe_subscription_id) return { error: 'No active subscription found.' };
  try {
    const stripe = createStripeClient(environment);
    const updated = await stripe.subscriptions.update(s.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    // Mirror immediately so the UI flips without waiting for the webhook.
    // RLS on `subscriptions` only allows service_role writes, so use the
    // admin client here. We've already verified the caller owns this row
    // via the RLS-scoped SELECT above.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin
      .from('subscriptions')
      .update({ cancel_at_period_end: cancelAtPeriodEnd, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', s.stripe_subscription_id);
    return { ok: true, cancelAtPeriodEnd: !!updated.cancel_at_period_end };
  } catch (error) {
    return { error: getStripeErrorMessage(error) };
  }
}

export const cancelMySubscription = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(({ data, context }): Promise<MutateResult> =>
    mutateCancelFlag(context as never, data.environment, true),
  );

export const resumeMySubscription = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(({ data, context }): Promise<MutateResult> =>
    mutateCancelFlag(context as never, data.environment, false),
  );
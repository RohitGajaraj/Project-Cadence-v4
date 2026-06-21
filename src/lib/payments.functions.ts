import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { computeCreditAttribution } from "@/lib/credits.functions";

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
    throw new Error("Invalid userId");
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

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { priceId: string; returnUrl: string; environment: StripeEnv; quantity?: number }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { userId, claims } = context;
      const email = (claims as { email?: string })?.email;
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error(`Price not found: ${data.priceId}`);
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";
      const isTopup = data.priceId.startsWith("topup_");

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId =
          typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        ...(!isRecurring && { payment_intent_data: { description: productDescription } }),
        metadata: { userId, kind: isTopup ? "topup" : isRecurring ? "subscription" : "one_time" },
        ...(isRecurring && {
          subscription_data: { metadata: { userId, price_lookup_key: data.priceId } },
        }),
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { userId } = context;
    // stripe_customer_id is service-role-only (revoked from authenticated);
    // user is already verified by requireSupabaseAuth and we scope by user_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return { error: "No subscription found" };

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
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<MySubscription> => {
    const { userId } = context;
    // stripe_subscription_id is service-role-only; scope by user_id (authed).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
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
  context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string },
  environment: StripeEnv,
  cancelAtPeriodEnd: boolean,
): Promise<MutateResult> {
  const { userId } = context;
  // stripe_subscription_id is service-role-only; scope by user_id (authed).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = sub as { stripe_subscription_id?: string; status?: string } | null;
  if (!s?.stripe_subscription_id) return { error: "No active subscription found." };
  try {
    const stripe = createStripeClient(environment);
    const updated = await stripe.subscriptions.update(s.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    // Mirror immediately so the UI flips without waiting for the webhook.
    await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: cancelAtPeriodEnd, updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", s.stripe_subscription_id);
    return { ok: true, cancelAtPeriodEnd: !!updated.cancel_at_period_end };
  } catch (error) {
    return { error: getStripeErrorMessage(error) };
  }
}

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(
    ({ data, context }): Promise<MutateResult> =>
      mutateCancelFlag(context as never, data.environment, true),
  );

export const resumeMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(
    ({ data, context }): Promise<MutateResult> =>
      mutateCancelFlag(context as never, data.environment, false),
  );

// ---------------------------------------------------------------------------
// Phase 7: Credits surface (balance, ledger, top-ups).
// Reads the live account_credits / credit_ledger / credit_topups rows via the
// caller's authed (RLS-scoped) client. Top-ups still flow through the same
// Stripe Embedded Checkout — createTopUpCheckout is a thin guard that enforces
// the per-cycle cap before delegating to createCheckoutSession.
// ---------------------------------------------------------------------------

export type CreditsLedgerRow = {
  id: string;
  delta_credits: number;
  reason: string;
  surface: string | null;
  product_id: string | null;
  created_at: string;
};

export type CreditsTopupRow = {
  id: string;
  price_lookup_key: string;
  credits_added: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
};

export type CreditsView = {
  accountId: string | null;
  enabled: boolean;
  balanceCredits: number;
  monthlyGrantCredits: number;
  topupCredits: number;
  cycleAnchor: string | null;
  cycleTopupCredits: number;
  cycleTopupCapCredits: number;
  ledger: CreditsLedgerRow[];
  topups: CreditsTopupRow[];
};

const FALLBACK_TOPUP_CAP = 5000; // when monthly grant is 0 (engine still dormant)

export const getMyCreditsView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<CreditsView> => {
    const { supabase, userId } = context;
    const empty: CreditsView = {
      accountId: null,
      enabled: false,
      balanceCredits: 0,
      monthlyGrantCredits: 0,
      topupCredits: 0,
      cycleAnchor: null,
      cycleTopupCredits: 0,
      cycleTopupCapCredits: FALLBACK_TOPUP_CAP,
      ledger: [],
      topups: [],
    };

    // Resolve the user's default account id (idempotent provisioning).
    let accountId: string | null = null;
    try {
      const { data: acc } = await supabase.rpc(
        "ensure_user_default_account" as never,
        { _user_id: userId } as never,
      );
      accountId = (acc as string | null) ?? null;
    } catch {
      /* RPC missing pre-publish; degrade gracefully */
    }
    if (!accountId) return empty;

    // Is the credits engine flipped on? Reads a public SQL fn that returns
    // bool; defaults to false. We surface this so the UI can label balances
    // as "metering on" vs "metering off" without lying about a 0 balance.
    let enabled = false;
    try {
      const { data: en } = await supabase.rpc("credits_enabled" as never);
      enabled = en === true;
    } catch {
      /* fn missing — treat as off */
    }

    const [credRes, ledRes, topRes] = await Promise.all([
      supabase
        .from("account_credits")
        .select("balance_credits, monthly_grant_credits, topup_credits, cycle_anchor")
        .eq("account_id", accountId)
        .maybeSingle(),
      supabase
        .from("credit_ledger")
        .select("id, delta_credits, reason, surface, product_id, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("credit_topups")
        .select(
          "id, price_lookup_key, credits_added, amount_cents, currency, status, created_at, environment",
        )
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const cred = (credRes.data ?? {}) as {
      balance_credits?: number;
      monthly_grant_credits?: number;
      topup_credits?: number;
      cycle_anchor?: string | null;
    };
    const monthlyGrant = Number(cred.monthly_grant_credits ?? 0);
    const cycleAnchor = (cred.cycle_anchor as string | null) ?? null;
    const topups = (topRes.data ?? []) as CreditsTopupRow[];

    const sinceMs = cycleAnchor ? new Date(cycleAnchor).getTime() : Date.now() - 30 * 86_400_000;
    const cycleTopups = topups
      .filter((t) => t.status === "completed" && new Date(t.created_at).getTime() >= sinceMs)
      .reduce((s, t) => s + Number(t.credits_added || 0), 0);
    const cap = monthlyGrant > 0 ? monthlyGrant * 2 : FALLBACK_TOPUP_CAP;

    return {
      accountId,
      enabled,
      balanceCredits: Number(cred.balance_credits ?? 0),
      monthlyGrantCredits: monthlyGrant,
      topupCredits: Number(cred.topup_credits ?? 0),
      cycleAnchor,
      cycleTopupCredits: cycleTopups,
      cycleTopupCapCredits: cap,
      ledger: (ledRes.data ?? []) as CreditsLedgerRow[],
      topups,
    };
  });

const TOPUP_BUNDLES: Record<string, { credits: number; label: string }> = {
  topup_250: { credits: 250, label: "250 credits" },
  topup_1k: { credits: 1000, label: "1,000 credits" },
  topup_2_5k: { credits: 2500, label: "2,500 credits" },
};

/**
 * Cap-guarded top-up: rejects if this purchase would push the cycle's total
 * top-up credits past the per-cycle cap, otherwise delegates to the standard
 * embedded-checkout session. Same return shape as createCheckoutSession.
 */
export const createTopUpCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^topup_[a-zA-Z0-9_]+$/.test(data.priceId)) throw new Error("Invalid top-up priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId, claims } = context;

    // Resolve bundle: prefer admin-managed catalog (pricing_topup_bundles),
    // fall back to the static map so legacy lookup keys keep working.
    let bundle: { credits: number; label: string } | null =
      TOPUP_BUNDLES[data.priceId] ?? null;
    if (!bundle) {
      const m = data.priceId.match(/^topup_(\d+)(k?)$/);
      if (m) {
        const n = parseInt(m[1], 10) * (m[2] === "k" ? 1000 : 1);
        const { data: row } = await supabase
          .from("pricing_topup_bundles")
          .select("credits")
          .eq("credits", n)
          .eq("active", true)
          .maybeSingle();
        if (row) bundle = { credits: Number(row.credits), label: `${n.toLocaleString()} credits` };
      }
    }
    if (!bundle) return { error: "Unknown top-up bundle." };

    // Inline a tiny version of getMyCreditsView's cap math so we don't have
    // to expose the function-as-RPC machinery internally.
    try {
      const { data: accId } = await supabase.rpc(
        "ensure_user_default_account" as never,
        { _user_id: userId } as never,
      );
      if (accId) {
        const { data: cred } = await supabase
          .from("account_credits")
          .select("monthly_grant_credits, cycle_anchor")
          .eq("account_id", accId as string)
          .maybeSingle();
        const monthlyGrant = Number(
          (cred as { monthly_grant_credits?: number } | null)?.monthly_grant_credits ?? 0,
        );
        const cycleAnchor = (cred as { cycle_anchor?: string | null } | null)?.cycle_anchor ?? null;
        const sinceMs = cycleAnchor
          ? new Date(cycleAnchor).getTime()
          : Date.now() - 30 * 86_400_000;
        const { data: tops } = await supabase
          .from("credit_topups")
          .select("credits_added, status, created_at")
          .eq("user_id", userId)
          .eq("environment", data.environment);
        const cycleSpend = (
          (tops ?? []) as Array<{ credits_added: number; status: string; created_at: string }>
        )
          .filter((t) => t.status === "completed" && new Date(t.created_at).getTime() >= sinceMs)
          .reduce((s, t) => s + Number(t.credits_added || 0), 0);
        const cap = monthlyGrant > 0 ? monthlyGrant * 2 : FALLBACK_TOPUP_CAP;
        if (cycleSpend + bundle.credits > cap) {
          return {
            error: `Top-up limit reached for this cycle (${cap.toLocaleString()} credits). Try a smaller bundle, or wait for the next cycle.`,
          };
        }
      }
    } catch {
      /* if the cap check itself errors, fall through to checkout */
    }

    // Delegate to the canonical session creator (resolves customer, sets
    // metadata.kind='topup', etc.). Re-implementing here would drift.
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) return { error: `Price not found: ${data.priceId}` };
      const stripePrice = prices.data[0];
      const email = (claims as { email?: string })?.email;
      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      const productId =
        typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: product.name },
        metadata: { userId, kind: "topup" },
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// ---------------------------------------------------------------------------
// WM-M16: credit usage attribution (the "where did my credits go" view).
// Reads the account's debit ledger via the caller's RLS-scoped client, rolls it
// up per product + per member (pure, in credits.functions.ts), and enriches
// product ids with their names. Empty until the engine has debits (metering on).
// ---------------------------------------------------------------------------

export type CreditAttributionView = {
  byProduct: { id: string | null; name: string; credits: number }[];
  byMember: { id: string | null; credits: number }[];
  totalDebited: number;
};

export const getCreditAttribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sinceIso?: string | null }) => data ?? {})
  .handler(async ({ data, context }): Promise<CreditAttributionView> => {
    const { supabase, userId } = context;
    const empty: CreditAttributionView = { byProduct: [], byMember: [], totalDebited: 0 };

    let accountId: string | null = null;
    try {
      const { data: acc } = await supabase.rpc(
        "ensure_user_default_account" as never,
        { _user_id: userId } as never,
      );
      accountId = (acc as string | null) ?? null;
    } catch {
      /* RPC missing pre-publish; degrade gracefully */
    }
    if (!accountId) return empty;

    const attr = await computeCreditAttribution(supabase, accountId, {
      sinceIso: data?.sinceIso ?? null,
    });

    // Enrich product ids -> names (best-effort; RLS-scoped, falls back to a label).
    const names = new Map<string, string>();
    const pids = attr.byProduct.map((b) => b.id).filter((x): x is string => !!x);
    if (pids.length) {
      try {
        const { data: rows } = await supabase.from("projects").select("id, name").in("id", pids);
        for (const r of (rows ?? []) as Array<{ id: string; name: string }>) {
          names.set(r.id, r.name);
        }
      } catch {
        /* names are best-effort */
      }
    }

    return {
      byProduct: attr.byProduct.map((b) => ({
        id: b.id,
        name: b.id ? (names.get(b.id) ?? "Untitled product") : "Unattributed",
        credits: b.credits,
      })),
      byMember: attr.byMember,
      totalDebited: attr.totalDebited,
    };
  });

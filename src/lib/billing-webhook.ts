// M-C-BILLING-TESTS — the pure, testable decision/extraction layer of the Stripe
// payments webhook (`src/routes/api/public/payments/webhook.ts`).
//
// The webhook handlers mix three concerns: (1) PURE decisions on the Stripe event
// (which price? how many credits? is this a top-up / a renewal?), (2) timestamp
// shaping, and (3) the DB writes. A bug in (1)/(2) silently mis-bills EVERY
// customer, yet it was untested. This module lifts (1)+(2) out as pure functions so
// they are unit-tested and DRY across the six handlers (they can't drift). The tier
// rules live in the sibling `billing-tier.ts`; the DB writes stay in the route.
//
// Server-free + totally defined: malformed Stripe payloads never throw here.
import { creditsFromLookupKey } from "./billing-tier";

/** Per-bundle top-up credit fallback for legacy lookup keys (catalog keys resolve via creditsFromLookupKey). */
export const TOPUP_CREDITS: Record<string, number> = {
  topup_250: 250,
  topup_1k: 1000,
  topup_2_5k: 2500,
};

/** A minimal shape of a Stripe subscription/line item's price (only the fields we read). */
type PriceLike = {
  price?: {
    lookup_key?: string | null;
    metadata?: { lovable_external_id?: string | null } | null;
    id?: string | null;
  } | null;
} | null | undefined;

/**
 * PURE. Resolve the price key from a subscription line item: prefer the catalog
 * `lookup_key`, then the Lovable external id, then the raw Stripe price id. This is
 * the key every tier/credit decision keys off, so the fallback order is load-bearing
 * (a missed lookup_key must still resolve to SOMETHING, never undefined-mis-tier).
 */
export function resolvePriceLookup(item: PriceLike): string | undefined {
  const price = item?.price;
  return price?.lookup_key || price?.metadata?.lovable_external_id || price?.id || undefined;
}

/**
 * PURE. Credits for a one-time top-up checkout: the catalog amount for the bundle's
 * lookup_key, falling back to the static legacy map. Returns null when neither knows
 * the key (the handler then skips crediting rather than guessing).
 */
export function resolveTopupCredits(lookupKey: string | null | undefined): number | null {
  if (!lookupKey) return null;
  const catalog = creditsFromLookupKey(lookupKey);
  if (catalog && catalog > 0) return catalog;
  const legacy = TOPUP_CREDITS[lookupKey];
  return legacy && legacy > 0 ? legacy : null;
}

/** PURE. Stripe unix-seconds → ISO string, or null when absent/invalid (no fake epoch-0). */
export function unixSecondsToIso(sec: number | null | undefined): string | null {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return null;
  return new Date(sec * 1000).toISOString();
}

/** A minimal Stripe checkout.session shape (only the fields the top-up gate reads). */
type CheckoutSessionLike = {
  mode?: string;
  metadata?: { userId?: string; kind?: string } | null;
} | null | undefined;

/**
 * PURE. True only for a genuine top-up purchase: a one-time `payment` checkout
 * tagged `kind=topup` with a userId. A subscription checkout (`mode=subscription`)
 * or any untagged session must NOT mint top-up credits.
 */
export function isTopupCheckout(session: CheckoutSessionLike): boolean {
  return (
    session?.mode === "payment" &&
    session?.metadata?.kind === "topup" &&
    !!session?.metadata?.userId
  );
}

/**
 * PURE. True only on a true RENEWAL invoice (`subscription_cycle`). The first
 * invoice (`subscription_create`) is already covered by grant-on-subscribe, so
 * refilling on it would double-grant; every other reason refills nothing.
 */
export function isRenewalInvoice(invoice: { billing_reason?: string } | null | undefined): boolean {
  return invoice?.billing_reason === "subscription_cycle";
}

/** PURE. The subscription period window as ISO, preferring the line-item period over the sub-level one. */
export function resolvePeriod(
  item: { current_period_start?: number | null; current_period_end?: number | null } | null | undefined,
  sub: { current_period_start?: number | null; current_period_end?: number | null } | null | undefined,
): { start: string | null; end: string | null } {
  return {
    start: unixSecondsToIso(item?.current_period_start ?? sub?.current_period_start),
    end: unixSecondsToIso(item?.current_period_end ?? sub?.current_period_end),
  };
}

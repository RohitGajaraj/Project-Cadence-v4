/**
 * Stripe Invoice helpers (pure, no IO) — version-robust field resolution.
 *
 * The top-level `invoice.subscription` field was REMOVED in Stripe API version
 * 2025-03-31.basil. Our client is pinned to a post-Basil version
 * (`2026-03-25.dahlia`), so on every real invoice that field is `undefined` and
 * the subscription id now lives under `invoice.parent.subscription_details.
 * subscription` (or, for line-level detail, under the line's
 * `parent.subscription_item_details.subscription`). The webhook's renewal-refill
 * and past_due dunning handlers depend on resolving this id; reading only the
 * removed top-level field made BOTH silently no-op on live traffic.
 *
 * `invoiceSubscriptionId` reads every known location and accepts both the bare
 * string id and an expanded `{ id }` object, so it works regardless of which API
 * version or expansion the connector gateway forwards. Returns null when the
 * invoice is not subscription-related (e.g. a one-off top-up payment).
 */

/** Narrow a candidate (string id or expanded `{id}` object) to a non-empty id. */
function asId(candidate: unknown): string | null {
  if (typeof candidate === "string") return candidate.length > 0 ? candidate : null;
  if (candidate && typeof candidate === "object") {
    const id = (candidate as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

/**
 * Resolve the Stripe subscription id from an Invoice across API versions.
 * Order: pre-Basil top-level → Basil+ parent.subscription_details → first
 * line's subscription_item_details. Returns null for a non-subscription invoice.
 */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== "object") return null;
  const inv = invoice as Record<string, unknown>;

  // 1. Pre-Basil top-level field (string or expanded object).
  const topLevel = asId(inv.subscription);
  if (topLevel) return topLevel;

  // 2. Basil+ canonical location: parent.subscription_details.subscription.
  const parent = inv.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  const fromParent = asId(parent?.subscription_details?.subscription);
  if (fromParent) return fromParent;

  // 3. Line-level fallback: lines.data[].parent.subscription_item_details.subscription.
  const lines = inv.lines as { data?: unknown } | undefined;
  const data = Array.isArray(lines?.data) ? (lines?.data as unknown[]) : [];
  for (const line of data) {
    const lp = (line as { parent?: { subscription_item_details?: { subscription?: unknown } } })
      ?.parent;
    const fromLine = asId(lp?.subscription_item_details?.subscription);
    if (fromLine) return fromLine;
  }

  return null;
}

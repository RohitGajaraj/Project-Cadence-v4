# Credits surface (balance, ledger, top-ups)

> _Created: 2026-06-20 · Last updated: 2026-06-20 (Lovable refresh)_

> Status · UI shipped 2026-06-20 (◐). Page lives at Settings → Credits. Metering still gated by `credits_enabled()` (off); top-ups are logged to `credit_topups` but are NOT yet credited to the spendable balance (known gap, dashboard row M-C-TOPUP-BUG, must be wired before credits go live).

> _Reconciled 2026-06-21 against shipped code: the top-up webhook writes only the `credit_topups` audit row; it never increments `account_credits.topup_credits` or inserts a `credit_ledger` row, so purchased top-ups do not reach the spendable balance even after `credits_enabled()` flips on. Earlier "adds to the balance" wording was wrong._

## Update 2026-06-20 (Lovable cycle: tiered top-up catalog as shipped)

The top-up picker was restyled into a **tiered, deliberate monetization surface** with a "Best value" anchor and two groups (Starter packs vs At scale).

> _Reconciled 2026-06-21 against shipped code: the spendable ladder is 250 / 1k / 2.5k only. The static `TOPUP_CREDITS` map in `src/lib/payments.functions.ts` knows only `topup_250` / `topup_1k` / `topup_2_5k`, so any larger admin-catalog bundle (10k / 50k / 250k) will NOT be credited until the webhook resolves credit amounts from `pricing_topup_bundles` by `lookup_key` instead of the static map. Earlier "6-bundle ladder" wording described the admin catalog, not what the rail can actually grant._

- **Shipped bundle ladder:** 250 / 1,000 / 2,500 credits. Larger admin-catalog rows (10,000 / 50,000 / 250,000) can be displayed but are not yet wired to a credit amount the webhook can grant.
- **Best value badge:** exactly one bundle per group carries it, controlled by the admin pricing console.
- **Group headers:** "Starter packs" and "At scale" with mono-label kickers, so individual buyers and enterprise-volume buyers self-segment.
- **Cap rule unchanged:** server-enforced 2× monthly grant per cycle (5,000-credit fallback when metering is dormant).
- **The "Need more credits?" trailing CTA on the Settings page was removed** - the picker is the surface, not a duplicate link.

**Admin control:** the catalog rows live in `pricing_topup_bundles` and are edited from `/admin` → Pricing tab. "Best value" is a boolean flag per row. (Until the webhook reads credit amounts from these rows by `lookup_key`, only the three statically-mapped bundles actually grant credits.)

## Update 2026-06-20 (security): Stripe-id column lockdown

`stripe_customer_id` and `stripe_subscription_id` columns on `accounts`, `workspaces`, and `subscriptions` are revoked from `anon`/`authenticated`. Reads happen via service-role server fns (`getMySubscription`, `createPortalSession`, `mutateCancelFlag`) after `requireSupabaseAuth` verifies the caller. Migration: `supabase/migrations/20260620225748_*.sql`.

## What it does

The user-facing surface for AI credits, isolated from the main billing page (Anthropic pattern):

- Credit balance + monthly cycle anchor
- One-time top-up bundles (250 / 1k / 2.5k credits)
- Recent grants/debits (last 20 ledger rows)
- Per-cycle cap: top-ups capped at 2× the active monthly bundle

## Where to find it

- **In app:** Settings → Credits (tab on `/settings`). The Plan tab carries only a subtle "Need more credits? Buy a top-up →" link to this tab; top-up bundles no longer appear on the Plan tab itself.

## How it works (as shipped)

- `getMyCreditsView` (in `src/lib/payments.functions.ts`) reads balance + monthly grant + top-up balance + cycle anchor from `account_credits`, the last 20 rows from `credit_ledger`, and the last 10 from `credit_topups`, all via the caller's RLS-scoped client.
- The view also reports `credits_enabled()`; when false (today's default), the balance card surfaces an honest "Metering is off" note instead of pretending a 0 is meaningful.
- "Buy credits" routes through `createTopUpCheckout` (cap-guarded) which delegates to a Stripe Embedded Checkout session with `metadata.kind = 'topup'`. The webhook handler (`handleCheckoutCompleted` in `src/routes/api/public/payments/webhook.ts`) writes the `credit_topups` audit row on `checkout.session.completed`. **It does NOT yet increment `account_credits.topup_credits` or insert a `credit_ledger` row**, so the purchased credits are recorded but never reach the spendable balance (known gap, dashboard row M-C-TOPUP-BUG); this must be wired before credits go live.
- **Cap rule (server-enforced):** rejects if `cycle_topup_credits + bundle.credits > 2 × monthly_grant_credits`. When the engine is dormant (`monthly_grant_credits = 0`), a flat fallback cap of 5,000 credits per cycle applies. The UI also disables bundles that would exceed the cap.

## How to verify

1. Settings → Credits. Balance card renders; activity list shows "No activity yet." on a fresh account.
2. Click any top-up bundle → embedded Stripe Checkout opens. Pay with `4242 4242 4242 4242`.
3. Return to /settings?section=credits → the new top-up appears in the `credit_topups` audit list and "This cycle: X of Y top-up credits used" updates. Note: the credits do NOT appear in the spendable balance, because the webhook does not yet write `account_credits` / `credit_ledger` (M-C-TOPUP-BUG).
4. Try to exceed the cap (e.g. buy the 2,500-credit bundle four times in one cycle): the offending bundle button is disabled, and a manual call returns a typed error.
5. While `credits_enabled()` is false: the balance card shows the "Metering is off" note; this disappears once the engine flips on.

## Test coverage

Only the pure credit math is unit-tested (`src/lib/credits.test.ts` and the related `entitlements.test.ts` / `ai/pricing.test.ts`). The top-up checkout server fn, the webhook DB writes, and the grant path have NO automated tests - they are exercised manually / dry-run only. Wiring the webhook to credit the balance (M-C-TOPUP-BUG) should land with a webhook test (see dashboard row M-C-BILLING-TESTS).

## Related

- [`./billing.md`](./billing.md) — the subscription rail (top-ups live next door, deliberately not in it)
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) - row M-C-PRICE / WM-M16 (pricing, entitlements, top-ups), plus M-C-TOPUP-BUG and M-C-BILLING-TESTS
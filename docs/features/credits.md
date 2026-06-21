# Credits surface (balance, ledger, top-ups)

> _Created: 2026-06-20 · Last updated: 2026-06-21 (Claude: credit engine wired end-to-end)_

> Status · UI shipped 2026-06-20; the credit ENGINE was wired end-to-end by Claude on 2026-06-21 (◐, dormant). Page lives at Settings → Credits. Top-ups now credit the spendable balance, a subscription grants the bundle's monthly credits, and a renewal refills - all via idempotent RPCs called by the payments webhook. Only the DEBIT (metering) stays gated by `credits_enabled()` (OFF), so the engine is fully functional in sandbox and flips on at go-live (see [`../operations/credit-engine-go-live.md`](../operations/credit-engine-go-live.md)).

> _Update 2026-06-21 (Claude takeover): M-C-TOPUP-BUG FIXED. `apply_topup_credits` (migration `20260621120000`) records the purchase, increments `account_credits.topup_credits`, and writes a `credit_ledger` row, idempotent per Stripe session. Grant-on-subscribe (`grant_subscription_credits`) + renewal-refill (`reset_subscription_cycle`) are wired too. The earlier "top-ups do not reach the balance" gap is resolved; all dry-run-verified on the live DB._

## Update 2026-06-20 (Lovable cycle: tiered top-up catalog as shipped)

The top-up picker was restyled into a **tiered, deliberate monetization surface** with a "Best value" anchor and two groups (Starter packs vs At scale).

> _Update 2026-06-21 (Claude): the webhook now resolves the credit amount from the `lookup_key` itself via `creditsFromLookupKey` (the inverse of `lookupKeyFor`), so ANY catalog bundle - including larger admin-added ones - credits the correct amount. The old static 3-entry map remains only as a fallback._

- **Bundle ladder:** the seeded catalog is 250 / 1,000 / 2,500 credits; any larger admin-added bundle also credits correctly now (the webhook parses the credit amount from the lookup_key).
- **Best value badge:** exactly one bundle per group carries it, controlled by the admin pricing console.
- **Group headers:** "Starter packs" and "At scale" with mono-label kickers, so individual buyers and enterprise-volume buyers self-segment.
- **Cap rule unchanged:** server-enforced 2× monthly grant per cycle (5,000-credit fallback when metering is dormant).
- **The "Need more credits?" trailing CTA on the Settings page was removed** - the picker is the surface, not a duplicate link.

**Admin control:** the catalog rows live in `pricing_topup_bundles` and are edited from `/admin` → Pricing tab. "Best value" is a boolean flag per row. (Any bundle credits correctly - the webhook derives the credit amount from the `lookup_key`.)

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
- "Buy credits" routes through `createTopUpCheckout` (cap-guarded) which delegates to a Stripe Embedded Checkout session with `metadata.kind = 'topup'`. On `checkout.session.completed` the webhook (`handleCheckoutCompleted`) calls the `apply_topup_credits` RPC, which records the `credit_topups` row, increments `account_credits.topup_credits`, and writes a `credit_ledger` row - atomically and idempotently (exactly once per Stripe session). A subscription grants the bundle's monthly credits (`grant_subscription_credits`) and a renewal refills (`reset_subscription_cycle`). These balance writes are UNGATED (they only add credits); the DEBIT path stays gated by `credits_enabled()`.
- **Cap rule (server-enforced):** rejects if `cycle_topup_credits + bundle.credits > 2 × monthly_grant_credits`. When the engine is dormant (`monthly_grant_credits = 0`), a flat fallback cap of 5,000 credits per cycle applies. The UI also disables bundles that would exceed the cap.

## How to verify

1. Settings → Credits. Balance card renders; activity list shows "No activity yet." on a fresh account.
2. Click any top-up bundle → embedded Stripe Checkout opens. Pay with `4242 4242 4242 4242`.
3. Return to /settings?section=credits → the new top-up appears in the `credit_topups` audit list, the spendable balance increases by the bundle amount, and a `topup` row appears in the activity ledger.
4. Try to exceed the cap (e.g. buy the 2,500-credit bundle four times in one cycle): the offending bundle button is disabled, and a manual call returns a typed error.
5. While `credits_enabled()` is false: the balance card shows the "Metering is off" note; this disappears once the engine flips on.

## Test coverage

**71 unit tests in CI** across `entitlements.test.ts` / `credits.test.ts` / `billing-tier.test.ts` / `ai/pricing.test.ts` / `stripe.server.test.ts`: the pure credit + entitlement math, `creditsFromLookupKey` (7), the webhook signature gate (7), and a **SQL/TS tier-limit parity guard** (pins `limitFor()` to the SQL `tier_*_limit` fns so they cannot drift). **Live-verified 2026-06-21** (the repo's standard for DB-gated paths): the grant / top-up / renewal RPCs (idempotency + balance math + top-up preservation, then the test account restored); the tier-limit SQL equals the TS for every tier; and the admin-RPC authorization (50 of 51 `admin_*` RPCs gate on `has_role`, the one exception being the intentional `admin_bootstrap_self_as_admin`). Remaining (a repo-wide infra gap, not billing-specific): in-CI DB-integration tests for the webhook DB-writes + voucher redemption, which would need a Supabase mock harness the project does not yet have. Dashboard row `M-C-BILLING-TESTS` (◐).

## Related

- [`./billing.md`](./billing.md) — the subscription rail (top-ups live next door, deliberately not in it)
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) - row M-C-PRICE / WM-M16 (pricing, entitlements, top-ups), plus M-C-TOPUP-BUG and M-C-BILLING-TESTS
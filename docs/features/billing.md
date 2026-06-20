# Billing rail (Stripe, credit-bundle model)

> _Created: 2026-06-20 · Last updated: 2026-06-20 (Lovable cycle: cancel/resume + Stripe-id lockdown)_

> Status · Phase 1-2 landed 2026-06-20 (Stripe enabled in sandbox; admin-editable pricing catalog + service-role billing vault tables). **Phase 5 partial: Stripe Checkout + customer portal + cancel/resume wired.** Webhook handles `checkout.session.completed`, `customer.subscription.{updated,deleted}`. Sandbox env active; live env gated on the founder.

## Update 2026-06-20 (Lovable cycle: cancel / resume / portal as shipped)

- **Server fns (`src/lib/payments.functions.ts`):**
  - `getMySubscription` — reads the active subscription row via service-role after `requireSupabaseAuth` verifies the caller.
  - `createPortalSession` — opens Stripe Customer Portal (new tab; portal cannot embed).
  - `mutateCancelFlag` — sets `cancel_at_period_end` true/false (cancel + resume). End-of-period semantics: a canceled sub keeps access until `current_period_end`.
  - All three load `supabaseAdmin` lazily inside the handler (never at module scope) per the server-runtime rule.
- **UI:** Settings → Plan hosts cancel / resume / "Open portal" inline next to the current-plan card. Destructive cancel goes through `useConfirm()` (per `destructive-actions.md`).
- **Test-mode banner:** a calm banner declares when Stripe is in sandbox so the user is never confused about whether a real charge happened. Component: `src/components/billing/PaymentTestModeBanner.tsx`.
- **Stripe-id column lockdown:** migration `20260620225748_*.sql` revokes `stripe_customer_id` / `stripe_subscription_id` on `accounts`, `workspaces`, `subscriptions` from anon+authenticated. Two EXPOSED_SENSITIVE_DATA findings closed.

## What it does

The end-to-end Stripe subscription + portal rail for Cadence. Tiers are feature gates; the headline price is driven by a per-tier credit-bundle dropdown (Lovable-style). Top-ups live on a separate `/settings/credits` page (Anthropic-style isolation, not the Plan tab). Admin pricing is editable from `/admin/pricing` (inbuilt console; no separate portal).

## Tier shape (placeholder prices, edit from the admin console)

- **Individual:** Star (free, 100/mo) · Cluster / Pro (500 / 1k / 2k / 5k credits @ $15 / $25 / $45 / $99) · Constellation / Max (2k / 5k / 10k / 25k @ $45 / $99 / $179 / $399)
- **Business:** Galaxy / Team (500 / 1k / 2.5k / 5k / 10k per seat @ $20 / $30 / $55 / $99 / $179)
- **Enterprise:** Cosmos (contact sales)
- **Annual** = monthly × 10 (≈17% off) per paid tier.
- **Top-ups** (separate page): 250 / 1k / 2.5k credits at $5 / $18 / $40.

## Where to find it

- **In app:** Settings → Plan (subscription + bundle picker, manage-subscription via portal). Settings → Credits (balance, cycle anchor, top-up bundles, ledger).
- **Public:** `/pricing` reuses the same Settings-Plan component, fed by the public-readable pricing catalog tables.
- **Admin:** `/admin/pricing` (gated by `has_role(uid, 'admin')`).

## How it works

- **Catalog tables** (`pricing_plans`, `pricing_bundles`, `pricing_features`, `pricing_topup_bundles`): public read, service-role write. Seeded with the placeholder shape above. Edits from the admin console clone-and-archive Stripe Prices so existing subscribers stay on their original price.
- **Billing vaults** (`account_billing_secrets`, `workspace_billing_secrets`): service-role-only storage for Stripe customer/subscription ids. Replaces the legacy columns on `accounts` / `workspaces` (column-level SELECT revoked from members; fixes the EXPOSED_SENSITIVE_DATA findings).
- **Admin role** (`public.app_role` enum + `user_roles` table + `has_role()` security-definer fn): canonical separate-table role storage. `/admin/*` routes gate on `has_role(uid,'admin')`.
- **Server fns** (TBD Phase 5): `createCheckoutSession({tier, bundleId, recurrence})`, `createTopUpCheckout({bundleId})`, `createBillingPortalSession()`. All Stripe calls go through `src/lib/stripe.server.ts` via the connector gateway.
- **Webhook** (TBD Phase 5): `/api/public/payments/webhook?env=…` handles `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.{updated,deleted}` → writes vault + `accounts.plan_tier` + calls `grantMonthlyAllowance` / `resetCreditCycle`.

## How to verify (per phase)

- **Phase 2 (done):** `select * from pricing_plans;` returns 5 rows · `select * from pricing_bundles;` returns 13 rows · `select * from pricing_topup_bundles;` returns 3 rows · service-role-only vaults exist with backfilled rows · column-level SELECT revoked on legacy Stripe id columns.
- **Phase 5:** sandbox checkout for each tier × bundle × recurrence creates a Stripe sub and writes vault row · portal opens for an authed customer · webhook flips `plan_tier`.
- **Phase 8:** admin edits Cluster 1k price → new Stripe Price cloned → `/pricing` shows new amount · existing subs untouched.

## Related

- [`./credits.md`](./credits.md) — separate top-up page + credit engine surfaces
- [`./admin-console.md`](./admin-console.md) — `/admin/*` hub + pricing console
- [`./pricing.md`](./pricing.md) — legacy entitlements doc (3-tier shape, superseded by this rail)
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) — board group G12 (this rail)
- [`../../supabase/migrations/`](../../supabase/migrations/) — `stripe_rail_pricing_catalog_and_admin_role`
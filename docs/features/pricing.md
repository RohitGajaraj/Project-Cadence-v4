# M-C: Pricing, plans, and entitlements (the monetization foundation)

> _Created: 2026-06-16 · Last updated: 2026-06-21_

> Status · Foundation built 2026-06-16 (migration `20260616200000` applies on the next Lovable sync). Live charging waits on the founder provisioning Stripe keys. Route: Settings -> Plan (`/settings?section=billing`).

> [!IMPORTANT]
> **SUPERSEDED ENGINE NOTICE (reconciled 2026-06-21 against shipped code).** The original M-C 3-tier engine described in the lower "How it works" / "Configuration" sections (the `free`/`pro`/`team` table, the `createCheckoutSession` in `src/lib/billing.functions.ts`, and especially the webhook `src/routes/api/stripe/webhook.ts`) is retained below only as historical and now-dead code. `src/routes/api/stripe/webhook.ts` is DEAD/legacy: it reads a different env var (`STRIPE_WEBHOOK_SECRET`), hardcodes tier `'pro'`, and writes only `workspaces.plan_tier` plus the now-RLS-revoked `stripe_*` columns. **The live Stripe rail is `src/lib/payments.functions.ts` (`createCheckoutSession`, `createPortalSession`, `getMySubscription`, `cancel/resumeMySubscription`, `createTopUpCheckout`) plus the webhook `src/routes/api/public/payments/webhook.ts`, routed through the Lovable connector gateway (`connector-gateway.lovable.dev/stripe`).** Read-only billing state is `getBillingState` in `src/lib/billing.functions.ts`. For the live engine and credit ledger see [`billing.md`](./billing.md) and [`credits.md`](./credits.md). The shipped tier model is the 5-tier scheme (`free|pro|max|team|enterprise` = Star / Cluster / Constellation / Galaxy / Cosmos), not the 3-tier table below.

## Update 2026-06-20 (Lovable cycle: pricing surface as shipped)

The Settings → Plan picker and the public `/pricing` page now render the **5-tier Constellation scheme** with the founder-directed presentation rules. This block is the current source of truth for the surface; the older sections below describe the underlying engine and remain accurate.

- **Top-level audience toggle:** `Personal` vs `Teams & Enterprise`. Selecting `Personal` shows three cards in one row (Star · Cluster · Constellation). Selecting `Teams & Enterprise` shows two cards in one row (Galaxy · Cosmos). Grid is forced (`repeat(3, 1fr)` / `repeat(2, 1fr)`) so cards never split half-half.
- **Per-tier billing rules** (no global Monthly/Yearly toggle):
  - **Star:** free; no toggle. Copy reads *"Free, upgrade anytime"* (not "Free forever") so the upgrade nudge stays subtle.
  - **Cluster (Pro):** monthly + yearly toggle inside the card.
  - **Constellation (Max):** monthly only. No yearly toggle (founder ruling: Constellation is monthly-only).
  - **Galaxy / Cosmos:** no billing toggle; one-line contact-sales path.
- **"Most popular" badge:** exactly one card carries it at a time, controlled by the admin pricing console's recommended flag. Centered floating pill (no clipping). The previous "Recommended" label is retired.
- **Current plan highlight:** the active tier's card gets a multi-layer ember `box-shadow` glow, a warm orange `color-mix` tint, and a top-border accent so the user always sees which tier they are on.
- **Per-tier features (strictly ascending):** entitlement bullets in `src/lib/entitlements.ts` follow an "Everything in [previous tier], plus:" pattern. Star=5 lines, Cluster=10, Constellation=11, Galaxy=13, Cosmos=14. Cosmos references both Constellation and Galaxy in its lead bullet.
- **CTA copy:** consequence-first per `ui-voice.md` ("Step up to Cluster", "Bring the team into Galaxy", "Talk to our team"). All CTAs centered.
- **Icon spotlights:** 38px ember-tinted tiles with inset glow on every card.
- **Inline membership management:** the Settings page now hosts cancel / resume / open-portal inline next to the picker (per `inline-management.md`); no separate billing route.

**Files of record:** `src/components/billing/PlanPicker.tsx`, `src/lib/entitlements.ts`, `src/routes/_authenticated.settings.tsx`, `src/lib/payments.functions.ts`. Conventions consulted: `engine-room-doctrine.md`, `ui-voice.md`, `destructive-actions.md`, `inline-management.md`, `humanized-output.md`, `data-minimalism.md`.

**Verify:**
1. Settings → Plan as a Free user: see three cards under Personal with Star highlighted; click "Teams & Enterprise" → two cards (Galaxy, Cosmos).
2. Cluster card shows Monthly/Yearly toggle; Constellation card does not.
3. Whichever tier the admin marks "Most popular" carries the centered pill on exactly one card.
4. Current plan card shows the ember glow + tint.
5. Star CTA copy is "Free, upgrade anytime" (not "Free forever").

## What it does

Gives every workspace (now account) a **plan tier** and a single source of truth for what each tier is entitled to. A "Plan" tab in Settings shows the current plan and the tiers, and lets the owner start a Stripe Checkout to upgrade. This is the M-C "monetize" foundation from the v7 canon (section 9).

**The shipped tier model (5 tiers, current):** slugs `free` / `pro` / `max` / `team` / `enterprise`, presented as Star / Cluster / Constellation / Galaxy / Cosmos (`planPresentation` in `src/lib/entitlements.ts`). See the "Update 2026-06-20" block above for the live picker rules and the WM updates below for the credit model.

> **Historical (pre-WM 3-tier model, retained for context):** the original M-C foundation shipped a `free` / `pro` / `team` table (Free $0; Pro ~$39/mo; Team Custom), with the promise centered on **memory persistence** (free memory expires, paid memory compounds; founder course-correction #3, charge for memory not per-seat). That 3-tier table is no longer current; the 5-tier model above is what ships.

> **Update 2026-06-19 (WM initiative):** this model is being expanded to **account-level billing** with **5 tiers** (Constellation: Star / Cluster / Constellation / Galaxy / Cosmos over the stable slugs `free|pro|max|team|enterprise`), generous credit allowances + cheap fair-use top-ups, managed AI credits as the only self-serve path (BYOK removed from self-serve, enterprise-only; model-agnostic routing via our keys preserved), and a 30-day rolling memory decay on free. Full model + build items: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) (§2.4 the tier matrix; WM-M1 / M2 / M3 / M6; and the **credit engine** §4.2.1 / `WM-M10` to `WM-M16`, the cost-to-credit metering, per-tier amounts, capped top-ups, attribution, and the calm legibility layer).
>
> **✅ WM-M1 shipped 2026-06-19 (overnight cycle 26):** `src/lib/entitlements.ts` now carries the full 5-tier matrix (the `PlanTier` slugs above, retention bumped 14 -> 30, workspace/product limits, `crossWorkspaceMemory`, `seats`/`rbac`/`approvalLanes`, the credit fields `creditMultiplier`/`creditMonthlyBase`/`creditTopUps`/`topUpCapPerCycle`/`enterpriseCreditModel`/`priority`, `dataExport`, plus `limitFor`), and `planPresentation` returns the Constellation names + value-framed highlights (credit/price numbers are founder-gated placeholders, plan §7). Legacy fields kept as aliases so billing/pricing/settings/webhook are untouched. The "How it works -> Entitlements" bullet below describes the now-superseded 3-tier shape; the matrix above is current. The Settings BillingTab shows all 5 tiers; the public `pricing.tsx` now shows the catalog-driven ladder with correct prices (Cluster $25 / Constellation $99 / Galaxy $30 per seat), single-sourced 2026-06-21 (M-C-PRICE-SYNC).
>
> **Update 2026-06-19 (pricing strategy, Anthropic-style packaging, deferred):** the founder set the target presentation to mirror Anthropic Claude, tuned to our moat. Documented + scheduled, NOT yet built (picked up after the core elemental builds). Two toggles (Individual: Star / Cluster / Constellation; Business: Galaxy / Cosmos). **Constellation (`max`) becomes one card with two usage variants** at checkout, "5x more usage than Pro" and "20x more usage than Pro" (a Save anchor on 20x). **Galaxy (`team`) becomes one card with two seat variants**, Standard (about 25 to 30 dollars per seat) and Premium, the same 5x / 20x principle per seat. **Star and Cluster are sold on features, never a usage number** (Cluster is the silent reference unit). **Cosmos (`enterprise`)** is per-seat + usage at API rates + per-user credit allocation (on the shipped `WM-M14` caps). Settings -> Plan also gains a "Current plan" tag + "Upgrade" calls to action (no current/base duplication) and a guarded downgrade. Full spec + build items: the bible [§2.4.1](../planning/workspace-tenancy-and-monetization-plan.md) + `WM-M17` / `WM-M18` / `WM-M19` (deferred behind core builds; prices, multipliers, names founder-gated).

## Why it exists

The proof gauntlet (v7 section 8) requires paying PMs. M-C names "plan tier + memory-expiry on free" as the mechanism. This foundation puts the plan tier and entitlement model in place so the rest (enforcement, the PLG funnel) can build on it.

## Where to find it

- **In app:** Settings -> Plan (`/settings?section=billing`). Shows the current plan, the tiers (now the 5-tier picker, see the "Update 2026-06-20" block), and an upgrade path for the owner.
- The flow degrades to an honest "billing is not connected yet" state until Stripe is configured. It currently runs in sandbox/test mode (the `PaymentTestModeBanner` shows the state); nothing is charged for real.

## How it works

- **Schema** (`supabase/migrations/20260616200000_mc_plan_tier.sql`): `workspaces` gains `plan_tier` (free/pro/team, default free, CHECK-constrained), `stripe_customer_id`, `stripe_subscription_id`, `plan_updated_at`. A `BEFORE INSERT OR UPDATE` trigger (`protect_workspace_billing_columns`) makes these columns writable **only by the service-role**: a non-service-role INSERT is forced to free with no billing ids, and a non-service-role UPDATE preserves the prior billing values. So a user cannot self-grant a paid plan by PATCHing or INSERTing the column directly (the "ws owner manage" RLS policy is `FOR ALL`, so both paths had to be guarded).
- **Entitlements** (`src/lib/entitlements.ts`): a pure `entitlementsFor(tier)` map (memory persistence + retention days, Critic everywhere, share links, shared memory, approval lanes) plus `isPlanTier` / `normalizePlanTier` (fail-safe default to free) and `planPresentation` for the UI. Unit-tested (`entitlements.test.ts`).
> _Reconciled 2026-06-21 against shipped code: the two bullets below describe the original (pre-WM) rail. The live rail is now `src/lib/payments.functions.ts` + `src/routes/api/public/payments/webhook.ts` via the Lovable connector gateway. `getBillingState` stays current as the read-only billing-state reader; the legacy `createCheckoutSession` and `src/routes/api/stripe/webhook.ts` are superseded (the latter is dead code). See [`billing.md`](./billing.md) and [`credits.md`](./credits.md)._

- **Server fns** (`src/lib/billing.functions.ts`): `getBillingState` (authed; reads the plan, owner flag, and whether Stripe is configured; pre-migration tolerant, defaults to free) stays current. The original `createCheckoutSession` here (authed, owner-only; Stripe Checkout via the REST API over fetch, gated on `STRIPE_SECRET_KEY` + a price id) is **superseded** by the live `src/lib/payments.functions.ts` rail (`createCheckoutSession`, `createPortalSession`, `getMySubscription`, `cancel/resumeMySubscription`, `createTopUpCheckout`), which resolves price tiers via `lookup_keys` in `src/lib/billing-tier.ts`.
- **Webhook** (`src/routes/api/stripe/webhook.ts`): **RETIRED 2026-06-21 (gutted to a 200 no-op; M-C-DEDUPE-WEBHOOK).** It verifies a Stripe HMAC signature and maps subscription state to `plan_tier`, but it reads a different env var (`STRIPE_WEBHOOK_SECRET`), hardcodes tier `'pro'`, and writes only `workspaces.plan_tier` plus the now-RLS-revoked `stripe_*` columns. The **live** webhook is `src/routes/api/public/payments/webhook.ts`, routed through the Lovable connector gateway (`connector-gateway.lovable.dev/stripe`). Do not treat the `api/stripe/webhook.ts` path as live.
- **UI** (`src/routes/_authenticated.settings.tsx`): the `BillingTab` under the new "Plan" tab.
- **Memory expiry** (`supabase/migrations/20260616210000_mc_memory_expiry.sql`, added 2026-06-16): the "charge for memory persistence" enforcement, **built but DORMANT by default** (founder ruling 2026-06-16: ship the pricing engine, but no plan gate bites at the prototype stage). A `memory_expiry_enabled()` flag returns false; while off, the trigger never stamps an expiry, so every memory row stays `expires_at = NULL` (never expires) and the recall filter and sweep below are automatic no-ops. To turn it on later, `CREATE OR REPLACE` the flag to `SELECT true` in a one-line migration. When enabled: `agent_memory.expires_at` is stamped on insert by a `BEFORE INSERT` trigger from the owner's plan (free = `created_at` + 14 days, pro/team = NULL so it never expires; 14 mirrors `FREE_MEMORY_RETENTION_DAYS`). The `match_agent_memory` recall RPC hard-filters expired rows so the loop never recalls them, and the daily `memory-tick` cron (`src/routes/api/public/hooks/memory-tick.ts`) hard-deletes them. Existing rows are grandfathered (`expires_at` stays NULL), so nothing is retroactively wiped, including the demo seed. The TS write path is unchanged, so it is pre-migration tolerant.

## Configuration (founder, when ready to charge)

> _Reconciled 2026-06-21 against shipped code: the env block below now lists the live `payments.functions.ts` rail (via the Lovable connector gateway), not the dead `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` / `STRIPE_WEBHOOK_SECRET` / `api/stripe/webhook.ts` set. Stripe is live-capable but currently unconfigured (sandbox/test mode; the `PaymentTestModeBanner` reflects the state)._

Set these (server-side secrets never carry the `VITE_` prefix). Price tiers resolve via `lookup_keys` in `src/lib/billing-tier.ts`, not env-pinned price ids.

- `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` (server-side Stripe API keys; sandbox for test mode, live when charging for real)
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET` (signing secrets for the live webhook `src/routes/api/public/payments/webhook.ts`)
- `VITE_PAYMENTS_CLIENT_TOKEN` (client-side publishable token, `pk_test_...` / `pk_live_...`; the one `VITE_`-prefixed value, safe in the browser bundle)
- `LOVABLE_API_KEY` (the calls route through the Lovable connector gateway, `connector-gateway.lovable.dev/stripe`)
- `APP_BASE_URL` (optional fallback for the checkout success/cancel URLs if the origin header is absent)

Point the Stripe webhook at `https://<app>/api/public/payments/webhook` for the `checkout.session.completed`, `customer.subscription.updated/created/deleted` events.

## Deferred (next increments, deliberately not in this foundation)

- **Memory-expiry enforcement: BUILT but DORMANT 2026-06-16** (migration `20260616210000`; see "Memory expiry" under How it works). The mechanic is coded and reviewed but gated off by `memory_expiry_enabled()` (returns false), so no plan gate bites at the prototype stage; flip the flag when ready to enforce. Engine-only for now is the founder ruling: build the pricing engine, do not wire active paywall gates yet.
- **Credit + limit engine: BUILT but DORMANT (reconciled 2026-06-21).** The whole credit and limit engine sits behind `credits_enabled()` / `limit_gates_enabled()` / `memory_expiry_enabled()`, all returning false, so no metering or gate bites yet. Test coverage is pure math only (`entitlements.test.ts`, `credits.test.ts`, `ai/pricing.test.ts`); there are zero automated tests for any Stripe server fn, the webhooks, the admin RPCs, or voucher redemption (tracked as `M-C-BILLING-TESTS` on the dashboard).
- **FIXED 2026-06-21 (`M-C-TOPUP-BUG`):** the top-up webhook (`handleCheckoutCompleted`) now calls the `apply_topup_credits` RPC (records the `credit_topups` row, increments `account_credits.topup_credits`, writes a `credit_ledger` row, idempotent per session), and resolves the credit amount from the `lookup_key` via `creditsFromLookupKey`, so ANY catalog bundle credits correctly. Grant-on-subscribe + renewal-refill are wired (migration `20260621120000`).
- Gating Critic-everywhere and other entitlements in the product surfaces (the map exists; the gates wire incrementally, claim-never-outruns-wiring).
- ~~A public `/pricing` marketing page.~~ **Shipped 2026-06-17** (PLG Phase 1): `src/routes/pricing.tsx` renders the three tiers from `planPresentation` (this module), led by the "charge for memory persistence" positioning; a `PreSignupCTA` (`src/components/plg/PreSignupCTA.tsx`) was added to the public share pages (`/t/$slug`, `/d/$slug`). See `plan.md` §4.

## Verification checklist

- `bun test src/lib/entitlements.test.ts` green (the pure map).
- `bun run build` green; the Settings "Plan" tab renders; the client bundle carries no `STRIPE_SECRET_KEY` / service-role reference.
- After the migration applies: a free workspace reads "Free"; a direct PATCH/INSERT of `plan_tier='pro'` by the owner does not change the stored plan (the trigger holds it free).
- With Stripe configured: the owner's upgrade CTA opens a Stripe Checkout via `src/lib/payments.functions.ts`; on completion the live webhook `src/routes/api/public/payments/webhook.ts` reconciles the subscription. (The legacy `api/stripe/webhook.ts` path is dead, see the superseded notice up top.)

## Related

- [`./billing.md`](./billing.md) and [`./credits.md`](./credits.md): the live Stripe rail (`payments.functions.ts` + `api/public/payments/webhook.ts`) and the credit ledger.
- [`../strategy/v7-agentic-product-os.md`](../strategy/v7-agentic-product-os.md) section 9 (pricing) + section 8 (the gauntlet).
- **Master register:** [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md), row `M-C-PRICE` plus the `M-C-*` / `ADM-*` rows (`F-ADMIN-CONSOLE`, `ADM-DB`, `M-C-TOPUP-BUG`, `M-C-DEDUPE-WEBHOOK`, `M-C-PRICE-SYNC`, `M-C-BILLING-TESTS`, `M-C-DB-HYGIENE`).
- [`../../plan.md`](../../plan.md) section 4 build log.

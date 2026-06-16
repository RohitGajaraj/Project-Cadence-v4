# M-C: Pricing, plans, and entitlements (the monetization foundation)

> Status · Foundation built 2026-06-16 (migration `20260616200000` applies on the next Lovable sync). Live charging waits on the founder provisioning Stripe keys. Route: Settings -> Plan (`/settings?section=billing`).

## What it does

Gives every workspace a **plan tier** (`free` / `pro` / `team`) and a single source of truth for what each tier is entitled to. A "Plan" tab in Settings shows the current plan and the three tiers, and lets the workspace owner start a Stripe Checkout to upgrade. This is the M-C "monetize" foundation from the v7 canon (section 9).

The tiers (v7 section 9):

| Tier | Price | The promise |
| --- | --- | --- |
| Free | $0 | The full daily loop and rituals. Decision memory is kept 14 days, then it expires. |
| Pro | ~$39/mo | Persistent decision memory (never expires), Critic everywhere, shareable links, unlimited ritual. |
| Team | Custom | Everything in Pro + shared workspace memory + per-role approval lanes. Outcome-anchored, in design with partners (a hypothesis, not a set price). |

The core charge is **memory persistence**: free memory expires, paid memory compounds. That is the founder's course-correction #3 (charge for memory, not per-seat).

## Why it exists

The proof gauntlet (v7 section 8) requires paying PMs. M-C names "plan tier + memory-expiry on free" as the mechanism. This foundation puts the plan tier and entitlement model in place so the rest (enforcement, the PLG funnel) can build on it.

## Where to find it

- **In app:** Settings -> Plan (`/settings?section=billing`). Shows the current plan, the three tiers, and an "Upgrade to Pro" button for the workspace owner.
- The button degrades to an honest "billing is not connected yet" message until Stripe keys exist. Nothing is charged.

## How it works

- **Schema** (`supabase/migrations/20260616200000_mc_plan_tier.sql`): `workspaces` gains `plan_tier` (free/pro/team, default free, CHECK-constrained), `stripe_customer_id`, `stripe_subscription_id`, `plan_updated_at`. A `BEFORE INSERT OR UPDATE` trigger (`protect_workspace_billing_columns`) makes these columns writable **only by the service-role**: a non-service-role INSERT is forced to free with no billing ids, and a non-service-role UPDATE preserves the prior billing values. So a user cannot self-grant a paid plan by PATCHing or INSERTing the column directly (the "ws owner manage" RLS policy is `FOR ALL`, so both paths had to be guarded).
- **Entitlements** (`src/lib/entitlements.ts`): a pure `entitlementsFor(tier)` map (memory persistence + retention days, Critic everywhere, share links, shared memory, approval lanes) plus `isPlanTier` / `normalizePlanTier` (fail-safe default to free) and `planPresentation` for the UI. Unit-tested (`entitlements.test.ts`).
- **Server fns** (`src/lib/billing.functions.ts`): `getBillingState` (authed; reads the workspace plan, owner flag, and whether Stripe is configured; pre-migration tolerant, defaults to free) and `createCheckoutSession` (authed, owner-only; creates a Stripe Checkout via the REST API over fetch, gated on `STRIPE_SECRET_KEY` + a price id). No Stripe SDK dependency.
- **Webhook** (`src/routes/api/stripe/webhook.ts`): verifies the Stripe HMAC signature (Web Crypto, with a replay-tolerance window) and maps subscription state to `plan_tier` via the service-role client. Gated on `STRIPE_WEBHOOK_SECRET`: a 200 no-op until configured.
- **UI** (`src/routes/_authenticated.settings.tsx`): the `BillingTab` under the new "Plan" tab.

## Configuration (founder, when ready to charge)

Set these as wrangler secrets (server-side, never `VITE_`):

- `STRIPE_SECRET_KEY` (the Stripe secret key)
- `STRIPE_PRICE_PRO` (the Stripe Price id for the $39 Pro plan; `STRIPE_PRICE_TEAM` optional)
- `STRIPE_WEBHOOK_SECRET` (the signing secret for the `/api/stripe/webhook` endpoint)
- `APP_BASE_URL` (optional fallback for the checkout success/cancel URLs if the origin header is absent)

Point the Stripe webhook at `https://<app>/api/stripe/webhook` for the `checkout.session.completed`, `customer.subscription.updated/created/deleted` events.

## Deferred (next increments, deliberately not in this foundation)

- **Memory-expiry enforcement** (the actual free-memory-expires mechanic). It touches the memory subsystem and is being kept out of this lane to stay file-disjoint from the parallel M-A Slice 2 (Today) work; it lands as a clean additive follow-up (an `expires_at` on memory + a recall-path filter) after Slice 2.
- Gating Critic-everywhere and other entitlements in the product surfaces (the map exists; the gates wire incrementally, claim-never-outruns-wiring).
- A public `/pricing` marketing page.

## Verification checklist

- `bun test src/lib/entitlements.test.ts` green (the pure map).
- `bun run build` green; the Settings "Plan" tab renders; the client bundle carries no `STRIPE_SECRET_KEY` / service-role reference.
- After the migration applies: a free workspace reads "Free"; a direct PATCH/INSERT of `plan_tier='pro'` by the owner does not change the stored plan (the trigger holds it free).
- With Stripe keys set: the owner's "Upgrade to Pro" opens a Stripe Checkout; on completion the webhook flips the workspace to Pro.

## Related

- [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) section 9 (pricing) + section 8 (the gauntlet).
- [`../../plan.md`](../../plan.md) section 4 build log.

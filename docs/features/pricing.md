# M-C: Pricing, plans, and entitlements (the monetization foundation)

> _Created: 2026-06-16 · Last updated: 2026-06-19_

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

> **Update 2026-06-19 (WM initiative):** this model is being expanded to **account-level billing** with **5 tiers** (Constellation: Star / Cluster / Constellation / Galaxy / Cosmos over the stable slugs `free|pro|max|team|enterprise`), generous credit allowances + cheap fair-use top-ups, managed AI credits as the only self-serve path (BYOK removed from self-serve, enterprise-only; model-agnostic routing via our keys preserved), and a 30-day rolling memory decay on free. Full model + build items: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) (§2.4 the tier matrix; WM-M1 / M2 / M3 / M6; and the **credit engine** §4.2.1 / `WM-M10` to `WM-M16`, the cost-to-credit metering, per-tier amounts, capped top-ups, attribution, and the calm legibility layer).

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
- **Memory expiry** (`supabase/migrations/20260616210000_mc_memory_expiry.sql`, added 2026-06-16): the "charge for memory persistence" enforcement, **built but DORMANT by default** (founder ruling 2026-06-16: ship the pricing engine, but no plan gate bites at the prototype stage). A `memory_expiry_enabled()` flag returns false; while off, the trigger never stamps an expiry, so every memory row stays `expires_at = NULL` (never expires) and the recall filter and sweep below are automatic no-ops. To turn it on later, `CREATE OR REPLACE` the flag to `SELECT true` in a one-line migration. When enabled: `agent_memory.expires_at` is stamped on insert by a `BEFORE INSERT` trigger from the owner's plan (free = `created_at` + 14 days, pro/team = NULL so it never expires; 14 mirrors `FREE_MEMORY_RETENTION_DAYS`). The `match_agent_memory` recall RPC hard-filters expired rows so the loop never recalls them, and the daily `memory-tick` cron (`src/routes/api/public/hooks/memory-tick.ts`) hard-deletes them. Existing rows are grandfathered (`expires_at` stays NULL), so nothing is retroactively wiped, including the demo seed. The TS write path is unchanged, so it is pre-migration tolerant.

## Configuration (founder, when ready to charge)

Set these as wrangler secrets (server-side, never `VITE_`):

- `STRIPE_SECRET_KEY` (the Stripe secret key)
- `STRIPE_PRICE_PRO` (the Stripe Price id for the $39 Pro plan; `STRIPE_PRICE_TEAM` optional)
- `STRIPE_WEBHOOK_SECRET` (the signing secret for the `/api/stripe/webhook` endpoint)
- `APP_BASE_URL` (optional fallback for the checkout success/cancel URLs if the origin header is absent)

Point the Stripe webhook at `https://<app>/api/stripe/webhook` for the `checkout.session.completed`, `customer.subscription.updated/created/deleted` events.

## Deferred (next increments, deliberately not in this foundation)

- **Memory-expiry enforcement: BUILT but DORMANT 2026-06-16** (migration `20260616210000`; see "Memory expiry" under How it works). The mechanic is coded and reviewed but gated off by `memory_expiry_enabled()` (returns false), so no plan gate bites at the prototype stage; flip the flag when ready to enforce. Engine-only for now is the founder ruling: build the pricing engine, do not wire active paywall gates yet.
- Gating Critic-everywhere and other entitlements in the product surfaces (the map exists; the gates wire incrementally, claim-never-outruns-wiring).
- ~~A public `/pricing` marketing page.~~ **Shipped 2026-06-17** (PLG Phase 1): `src/routes/pricing.tsx` renders the three tiers from `planPresentation` (this module), led by the "charge for memory persistence" positioning; a `PreSignupCTA` (`src/components/plg/PreSignupCTA.tsx`) was added to the public share pages (`/t/$slug`, `/d/$slug`). See `plan.md` §4.

## Verification checklist

- `bun test src/lib/entitlements.test.ts` green (the pure map).
- `bun run build` green; the Settings "Plan" tab renders; the client bundle carries no `STRIPE_SECRET_KEY` / service-role reference.
- After the migration applies: a free workspace reads "Free"; a direct PATCH/INSERT of `plan_tier='pro'` by the owner does not change the stored plan (the trigger holds it free).
- With Stripe keys set: the owner's "Upgrade to Pro" opens a Stripe Checkout; on completion the webhook flips the workspace to Pro.

## Related

- [`../strategy/v7-agentic-product-os.md`](../strategy/v7-agentic-product-os.md) section 9 (pricing) + section 8 (the gauntlet).
- [`../../plan.md`](../../plan.md) section 4 build log.

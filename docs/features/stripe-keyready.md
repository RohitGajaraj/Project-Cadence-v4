# Stripe / monetization key-readiness

> Status · The monetization engine is **code-complete and key-ready** as of 2026-06-22 (Lane 2). The credit metering engine is already live (see [`credit-engine-golive.md`](./credit-engine-golive.md)); this doc covers the **Stripe checkout/subscription/top-up/voucher** layer — what is built, the defects fixed to make it work when keys are plugged in, and the founder's last-mile go-live checklist. **No live Stripe keys are in the build yet, by founder ruling.** · Owner: monetization

## The build state (audited 2026-06-22, 6-agent readiness sweep)

| Surface | State | Notes |
| --- | --- | --- |
| Checkout session (subscription + top-up) | ✅ complete | Real line items, price-by-`lookup_key`, resolved customer, `return_url`, webhook-reconcilable metadata. Works the moment live keys + the price catalog exist. |
| Webhook handlers | ✅ fixed | All 6 events handled; the Basil-API `invoice.subscription` blocker is fixed (below). |
| Pricing config + entitlements | ✅ defined + parity-tested (product/workspace limits); copy fixed | Free-tier credit copy corrected 100 → 500 to match the engine. |
| Credit-pack top-up | ✅ apply path complete; ◐ cap hardening | Atomic/idempotent/ledgered grant; per-cycle ceiling is a soft pre-checkout guard (see remaining). |
| Vouchers | ✅ engine fixed | Redemption no longer rolls back; race-safe. ◐ no in-app redeem surface yet. |
| Entitlement enforcement | ◐ wired but dormant | Caps defined + DB triggers exist, gated behind `limit_gates_enabled()` (ships `false`). Seat caps unenforced. |

## Defects fixed (buildable code, not key-gated) — 2026-06-22

1. **Webhook renewal refill + dunning were silently dead (BLOCKER).** Both invoice handlers read the top-level `invoice.subscription`, which Stripe **removed in API version `2025-03-31.basil`**; our client is pinned to `2026-03-25.dahlia`, so the field was always `undefined` and both handlers early-returned. Consequence with live keys: a paying customer's monthly credits would never refill on renewal, and `past_due` dunning would never mirror. **Fix:** pure `src/lib/stripe-invoice.ts` `invoiceSubscriptionId(invoice)` reads every API-version location (`invoice.subscription` → `invoice.parent.subscription_details.subscription` → line `subscription_item_details.subscription`), string-or-expanded-object tolerant; wired into both handlers in `webhook.ts`. 8 unit tests.
2. **Every credit voucher rolled back (BLOCKER).** `redeem_voucher` wrote `credit_ledger.reason = 'voucher:CODE'`, which can never satisfy the `reason` CHECK (`grant/reset/debit/topup/adjustment`); the INSERT raised and rolled back the whole redemption. **Fix (migration `20260622040000`, applied to prod):** `reason='grant'` + code carried in the `surface` column; plus a `SELECT … FOR UPDATE` lock on the voucher row and a unique `(voucher_id,user_id)` index to make the cap + single-use checks race-safe.
3. **Free-tier copy contradicted the engine.** Said "100 AI credits per month"; the engine grants 500 (`FREE_MONTHLY_CREDITS`). **Fix (migration `20260622050000`, applied to prod):** the `pricing_features` label now reads "500 AI credits per month".

## Remaining — buildable hardening (no keys needed; not yet done)

- **Top-up per-cycle ceiling not enforced at the grant point.** The cap is only a pre-checkout soft check in `createTopUpCheckout`; `apply_topup_credits` (the atomic grant RPC) does not re-check it, so it is bypassable (concurrent top-ups, or the generic `createCheckoutSession` path). Fix: enforce the ceiling inside `apply_topup_credits` under the existing `account_credits` lock. Deferred to avoid duplicating tier-cap math in SQL for a mild over-purchase guardrail (the customer pays for what they get).
- ~~**No in-app voucher redeem surface.**~~ **SHIPPED 2026-06-22 (Lane 2):** `src/components/settings/RedeemCodeCard.tsx` on **Settings → Credits** (Account scope per the IA rubric) is the user-facing caller for `redeemVoucher` — an "Enter code" input + Redeem button that grants credits / unlocks a plan and refreshes the balance. The whole voucher loop (admin-create → user-redeem → credits granted) is now reachable; combined with the redemption-engine fix above, vouchers work end-to-end. The card live-renders on the next publish.
- **Credit-grant SQL↔TS parity test.** The per-tier grant numbers in `backfill_account_credits` are hand-mirrored from `entitlements.ts creditMonthlyBase` with no drift-guard (unlike the product/workspace limits, which have `entitlements-sql-parity.test.ts`). Add the mirror test.
- **Entitlement enforcement gaps.** Seat caps (`entitlements.seats`) are defined but never checked on invite; the primary AppShell "create workspace/product" buttons insert client-side, bypassing the friendly server pre-check (only the dormant DB trigger guards them). Build the seat check in `create_workspace_invitation` and route creates through a server fn.

## Founder last-mile checklist (the only steps that need YOU — keys/go-live)

1. Provide live Stripe **API keys** + **webhook signing secrets** (`STRIPE_LIVE_API_KEY` / `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `VITE_PAYMENTS_CLIENT_TOKEN`). All code degrades gracefully to "payments not configured" without them.
2. Seed the Stripe **price catalog** with the convention `lookup_key`s the code resolves by: subscriptions `cluster_*` / `constellation_*` / `galaxy_*` (from `lookupKeyFor`), top-ups `topup_250` / `topup_1k` / `topup_2500`. Checkout errors "Price not found" until these active Prices exist.
3. Register the webhook endpoint for exactly these 6 events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
4. When the upgrade path is live, flip `limit_gates_enabled()` to `true` to activate product/workspace cap enforcement (do NOT flip before checkout works, or free users hit caps with no way to upgrade).

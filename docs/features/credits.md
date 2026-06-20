# Credits surface (balance, ledger, top-ups)

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> Status · Skeleton 2026-06-20 alongside Stripe rail Phase 2. UI build is Phase 7 of board group G12.

## What it does

The user-facing surface for AI credits, isolated from the main billing page (Anthropic pattern):

- Credit balance + monthly cycle anchor
- One-time top-up bundles (250 / 1k / 2.5k credits)
- Recent grants/debits (last 20 ledger rows)
- Per-cycle cap: top-ups capped at 2× the active monthly bundle

## Where to find it

- **In app:** Settings → Credits (`/settings/credits`). The Plan tab carries only a subtle "Need more credits? →" link to this page; top-ups never appear on the Plan tab itself.

## How it works (planned, Phase 7)

- Reads balance + anchor from `account_credits` (existing table).
- Reads ledger from `credit_ledger` (existing table).
- Reads top-up SKUs from `pricing_topup_bundles` (Phase 2, seeded).
- "Buy credits" → `createTopUpCheckout({bundleId})` server fn (Phase 5) → Stripe Checkout (one-time payment). Webhook grants credits without touching subscription.
- Cap rule enforced server-side in `createTopUpCheckout`: rejects if `cycle_topup_credits + bundle.credits > 2 × active_monthly_bundle.credits`.

## How to verify (planned)

- Top-up button → Stripe Checkout → success → `account_credits.balance` increments by the bundle size; `credit_ledger` shows a `topup` row.
- Cap breach attempt returns a typed error and surfaces a calm in-page banner ("You've reached the top-up limit for this cycle. Resets <date>.").

## Related

- [`./billing.md`](./billing.md) — the subscription rail (top-ups live next door, deliberately not in it)
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) — G12 Phase 7
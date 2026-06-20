# Credits surface (balance, ledger, top-ups)

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> Status · Phase 7 UI shipped 2026-06-20 (◐). Page lives at Settings → Credits. Metering still gated by `credits_enabled()` (off); top-ups record live to `credit_topups` and add to the balance once metering flips on.

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
- "Buy credits" routes through `createTopUpCheckout` (cap-guarded) which delegates to a Stripe Embedded Checkout session with `metadata.kind = 'topup'`. The webhook handler in `src/routes/api/public/payments/webhook.ts` writes the `credit_topups` row on `checkout.session.completed`.
- **Cap rule (server-enforced):** rejects if `cycle_topup_credits + bundle.credits > 2 × monthly_grant_credits`. When the engine is dormant (`monthly_grant_credits = 0`), a flat fallback cap of 5,000 credits per cycle applies. The UI also disables bundles that would exceed the cap.

## How to verify

1. Settings → Credits. Balance card renders; activity list shows "No activity yet." on a fresh account.
2. Click any top-up bundle → embedded Stripe Checkout opens. Pay with `4242 4242 4242 4242`.
3. Return to /settings?section=credits → activity list shows the new top-up row tagged `topup_*` and `+N credits`; "This cycle: X of Y top-up credits used" updates.
4. Try to exceed the cap (e.g. buy the 2,500-credit bundle four times in one cycle): the offending bundle button is disabled, and a manual call returns a typed error.
5. While `credits_enabled()` is false: the balance card shows the "Metering is off" note; this disappears once the engine flips on.

## Related

- [`./billing.md`](./billing.md) — the subscription rail (top-ups live next door, deliberately not in it)
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) — G12 Phase 7
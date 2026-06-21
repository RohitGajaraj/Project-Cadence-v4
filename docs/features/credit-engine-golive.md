# Credit engine go-live — tested live 2026-06-22 (Lane 1)

> Status: ✅ The credit metering engine was taken LIVE on the published app and verified end-to-end. Metering is currently **ON**. The app has no public customers yet (build phase), so this was a safe full-path test (founder-authorized).

## What was done (the safe go-live sequence)

The credit engine was dormant behind `credits_enabled()` because a prior incident (2026-06-21) flipped it ON with zero credits granted, which made `assertAccountCredits` halt every AI call. The `credit_golive_guard` migration added a one-call backfill + a hard guard. The safe sequence, executed and verified:

1. **Backfill balances first.** `select public.backfill_account_credits();` granted every account its tier's monthly base (free 500, pro 2500, max 10000, team 10000; enterprise skipped = custom), idempotent, writing `grant` ledger rows. Result: 6/6 accounts funded (5× free 500, 1× pro 2500), `unfunded_nonent = 0`.
2. **Arm metering through the real admin path.** `/admin` → Overview → "Credits engine" → **Turn ON** (the demo account is the workspace admin). This calls `admin_set_credits_enabled(true)`, whose incident guard refuses to arm while any non-enterprise account has 0 credits — it passed because step 1 funded everyone. The UI flipped to "Metering is ON"; `credits_enabled()` returned `true`.
3. **Prove an AI call debits, not halts.** Sent a chat message (Gemini 3 Flash, the founder's BYO key) on `/chat`. The reply rendered (no halt) and the demo account's balance went **2500 → 2496**, with `debit:-1, debit:-2, debit:-1` ledger rows beside the `grant:2500`.
4. **Confirm the UI populates.** Settings → Credits now shows **BALANCE 2,496 · MONTHLY GRANT 2,500 · "Where your credits go: 4 credits spent this cycle"** — the previously-empty balance/attribution now reflect real metered usage.

## What this proves (the engine is real)

- **WM-M12 (debit engine):** AI calls meter and debit from the account pool; the ledger records every debit; a funded account is not halted. The empty-pool halt is the same `assertAccountCredits` path the guard exists to protect.
- **WM-M11 (per-tier grant):** the backfill grants the tier-correct allowance (free 500 / pro 2500, matching `entitlements.ts`), sets `cycle_anchor`, and writes `grant` rows; `reset_subscription_cycle` refills on renewal.
- **WM-M14 (attribution):** "Where your credits go" now totals the cycle's metered spend live.
- **WM-M16 (credit UI):** balance / grant / cycle / activity render real numbers.
- **BYO-P4 (managed AI credits):** metered AI on the managed key is live.

## Operating the engine (runbook)

- **Disable instantly:** `/admin` → Overview → "Turn OFF" (or `admin_set_credits_enabled(false)`). One click, fully reversible.
- **Re-fund accounts** (build-phase testing drains a pool): `select public.backfill_account_credits();` — idempotent, only tops up accounts at 0 grant, preserves bundle grants + top-ups. For a specific top-up, the `apply_topup_credits` path (Stripe top-up checkout) credits the balance.
- **Guard:** metering cannot be armed while any non-enterprise account has 0 total credits — the incident that caused the 2026-06-21 outage cannot recur.
- **Credit amounts are founder-tunable placeholders** (`entitlements.ts` / the pricing catalog); the mechanism is final, the numbers are not.

## Caveats / what is NOT yet proven live

- **Subscription webhook → tier/grant** (M-C-PRICE / WM-M3) and the **top-up purchase** (WM-M13) drive through Stripe **test mode** (`pk_test_…`); the credit-application RPCs (`grant_subscription_credits`, `apply_topup_credits`) are wired and the decision rules unit-tested, but a real Stripe-test checkout round-trip is a separate verification.
- **Production go-live for real customers** would additionally need live Stripe keys (`pk_live_…`) so a capped free user has a real upgrade path — a founder go-live decision, distinct from this build-phase test.

## Related
- `supabase/migrations/20260621130000_credit_golive_guard.sql` · [`../../src/lib/entitlements.ts`](../../src/lib/entitlements.ts) · [`billing-db-hygiene.md`](./billing-db-hygiene.md) · [`../../plan.md`](../../plan.md) §4 · dashboard rows WM-M11/M12/M13/M14/M16, BYO-P4.

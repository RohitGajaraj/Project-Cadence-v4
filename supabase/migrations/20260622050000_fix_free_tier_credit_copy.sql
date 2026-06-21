-- Fix the free-tier credit marketing copy (STRIPE-KEYREADY, Lane 2, 2026-06-22).
--
-- The seeded pricing_features label said "100 AI credits per month", but the
-- engine grants 500 (entitlements.ts FREE_MONTHLY_CREDITS = 500, and
-- backfill_account_credits funds free accounts to 500). A free user was told 100
-- and actually received 500. Make the copy match the engine. Forward-only +
-- idempotent (matches the exact stale string, no-op once corrected).
update public.pricing_features
set label = '500 AI credits per month'
where tier = 'free' and label = '100 AI credits per month';

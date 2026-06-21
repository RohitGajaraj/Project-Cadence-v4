-- Credit-engine + billing-secret grant lockdown (M-C-DB-HYGIENE / WM-M12 security).
--
-- Found by a live prod grant audit (2026-06-22, lane 2): seven SECURITY DEFINER
-- credit-mutation RPCs were EXECUTABLE by anon/authenticated (some via an explicit
-- grant, two via the default PUBLIC grant), with NO internal authorization check.
-- They are called ONLY server-side with the service-role client (debit_account_credits
-- from runtime.server.ts; grant_subscription_credits / apply_topup_credits /
-- reset_subscription_cycle from the Stripe webhook), so a client could have called
-- e.g. `POST /rest/v1/rpc/grant_subscription_credits` to mint itself credits, or
-- `debit_account_credits` to drain a victim's balance, once metering goes live.
-- Metering is dormant today (credits OFF), so there was no live exploitation, but this
-- is a critical pre-go-live fix. Lock every credit-mutation RPC to service_role only.
--
-- The prod fix was applied directly via the Lovable DB the same session; this migration
-- keeps the repo source in lockstep and makes a fresh apply land in the same secure state.
-- Idempotent + forward-only. `revoke ... from public, anon, authenticated` covers every
-- grant path; the explicit `grant ... to service_role` guarantees the backend keeps execute.

revoke execute on function public.debit_account_credits(uuid, bigint, uuid, text, uuid, uuid) from public, anon, authenticated;
grant  execute on function public.debit_account_credits(uuid, bigint, uuid, text, uuid, uuid) to service_role;

revoke execute on function public.grant_subscription_credits(uuid, bigint) from public, anon, authenticated;
grant  execute on function public.grant_subscription_credits(uuid, bigint) to service_role;

revoke execute on function public.apply_topup_credits(uuid, uuid, text, text, bigint, integer, text, text, text) from public, anon, authenticated;
grant  execute on function public.apply_topup_credits(uuid, uuid, text, text, bigint, integer, text, text, text) to service_role;

revoke execute on function public.reset_subscription_cycle(uuid) from public, anon, authenticated;
grant  execute on function public.reset_subscription_cycle(uuid) to service_role;

revoke execute on function public.backfill_account_credits() from public, anon, authenticated;
grant  execute on function public.backfill_account_credits() to service_role;

revoke execute on function public._ensure_account_credits(uuid) from public, anon, authenticated;
grant  execute on function public._ensure_account_credits(uuid) to service_role;

revoke execute on function public.check_mission_caps(uuid, integer, numeric) from public, anon, authenticated;
grant  execute on function public.check_mission_caps(uuid, integer, numeric) to service_role;

-- The billing-secret vaults are RLS-locked (0 policies => service-role-only) but still carried
-- the default anon/authenticated SELECT grant; revoke it so the secrets never rest solely on RLS.
revoke select on public.account_billing_secrets   from anon, authenticated;
revoke select on public.workspace_billing_secrets from anon, authenticated;

-- NOTE (deliberately NOT changed here): accounts/workspaces/subscriptions.stripe_customer_id /
-- stripe_subscription_id still report anon-readable at the COLUMN level, but anon is denied every
-- ROW by RLS (is_account_member / own-row policies), so there is no live leak. A true column
-- lockdown needs the revoke-table-then-grant-column-list pattern (anon holds table-wide SELECT),
-- which is invasive; left as an RLS-mitigated hardening follow-up.

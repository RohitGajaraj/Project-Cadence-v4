-- Credit-flow apply: grant-on-subscribe + top-up balance propagation (the WM-M11 grant
-- side + the M-C-TOPUP-BUG fix). These RPCs only ADD/SET the granted + purchased balance;
-- they are intentionally NOT gated by credits_enabled() (adding credits is harmless while
-- metering is off, and keeps every account's balance correct for the founder's go-live
-- flip). The DEBIT path (runtime.server.ts assertAccountCredits/debitAccountCredits) stays
-- gated by credits_enabled(), so no live user is ever blocked until go-live. Service-role
-- only (called by the Stripe webhook).

-- Align the purchase-record column with the bigint balance it credits (was integer).
alter table public.credit_topups alter column credits_added type bigint;

-- Ensure an account_credits row exists for an account (idempotent).
create or replace function public._ensure_account_credits(_account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.account_credits (account_id, balance_credits, monthly_grant_credits, topup_credits)
  values (_account_id, 0, 0, 0)
  on conflict (account_id) do nothing;
end;
$$;

-- Idempotent top-up application: record the purchase, credit the purchased balance, and
-- write a 'topup' ledger row -- EXACTLY ONCE per Stripe session. Safe on every webhook
-- retry (a duplicate session is a no-op). The credit_topups unique(stripe_session_id) is
-- the idempotency key.
create or replace function public.apply_topup_credits(
  _user_id uuid,
  _account_id uuid,
  _session_id text,
  _payment_intent_id text,
  _credits bigint,
  _amount_cents integer,
  _currency text,
  _lookup_key text,
  _env text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _inserted integer;
begin
  if _account_id is null or _session_id is null or _credits is null or _credits <= 0 then
    return jsonb_build_object('applied', false, 'reason', 'bad_args');
  end if;

  insert into public.credit_topups (
    user_id, account_id, stripe_session_id, stripe_payment_intent_id,
    price_lookup_key, credits_added, amount_cents, currency, status, environment
  ) values (
    _user_id, _account_id, _session_id, _payment_intent_id,
    _lookup_key, _credits, coalesce(_amount_cents, 0), coalesce(_currency, 'usd'), 'completed', _env
  )
  on conflict (stripe_session_id) do nothing;

  get diagnostics _inserted = row_count;
  if _inserted = 0 then
    return jsonb_build_object('applied', false, 'reason', 'duplicate');
  end if;

  perform public._ensure_account_credits(_account_id);

  update public.account_credits
     set topup_credits = coalesce(topup_credits, 0) + _credits,
         updated_at = now()
   where account_id = _account_id;

  insert into public.credit_ledger (account_id, user_id, delta_credits, reason)
  values (_account_id, _user_id, _credits, 'topup');

  return jsonb_build_object('applied', true, 'credits', _credits);
end;
$$;

-- Idempotent grant-on-subscribe: set the account's INCLUDED monthly allowance to the
-- bundle's credit volume. A no-op when the grant already equals that volume (so webhook
-- retries and status-only subscription updates do NOT re-anchor the cycle or double-grant).
-- A real bundle change (upgrade/downgrade) re-grants and writes a 'grant' ledger row for
-- the net included-balance movement. Purchased top-ups are preserved.
create or replace function public.grant_subscription_credits(_account_id uuid, _credits bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _cur bigint;
  _grant bigint;
  _delta bigint;
begin
  if _account_id is null or _credits is null or _credits < 0 then
    return jsonb_build_object('granted', false, 'reason', 'bad_args');
  end if;

  perform public._ensure_account_credits(_account_id);

  select coalesce(balance_credits, 0), coalesce(monthly_grant_credits, 0)
    into _cur, _grant
  from public.account_credits
  where account_id = _account_id
  for update;

  if _grant = _credits then
    return jsonb_build_object('granted', false, 'reason', 'unchanged');
  end if;

  _delta := _credits - _cur;

  update public.account_credits
     set balance_credits = _credits,
         monthly_grant_credits = _credits,
         cycle_anchor = now(),
         updated_at = now()
   where account_id = _account_id;

  if _delta <> 0 then
    insert into public.credit_ledger (account_id, delta_credits, reason)
    values (_account_id, _delta, 'grant');
  end if;

  return jsonb_build_object('granted', true, 'credits', _credits, 'delta', _delta);
end;
$$;

-- Renewal refill: on a billing-cycle renewal, reset the INCLUDED balance back up to the
-- account's stored monthly grant, preserving purchased top-ups. Idempotent (no ledger row
-- when already at the grant). Ungated, same safety rationale as the grant. The webhook
-- calls this only on invoice.payment_succeeded with billing_reason='subscription_cycle'
-- (i.e. renewals, not the first invoice, which is covered by grant_subscription_credits).
create or replace function public.reset_subscription_cycle(_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _cur bigint;
  _grant bigint;
  _delta bigint;
begin
  if _account_id is null then
    return jsonb_build_object('reset', false, 'reason', 'bad_args');
  end if;
  perform public._ensure_account_credits(_account_id);
  select coalesce(balance_credits, 0), coalesce(monthly_grant_credits, 0)
    into _cur, _grant
  from public.account_credits
  where account_id = _account_id
  for update;
  if _grant <= 0 then
    return jsonb_build_object('reset', false, 'reason', 'no_grant');
  end if;
  _delta := _grant - _cur;
  update public.account_credits
     set balance_credits = _grant, cycle_anchor = now(), updated_at = now()
   where account_id = _account_id;
  if _delta <> 0 then
    insert into public.credit_ledger (account_id, delta_credits, reason)
    values (_account_id, _delta, 'reset');
  end if;
  return jsonb_build_object('reset', true, 'credits', _grant, 'delta', _delta);
end;
$$;

revoke all on function public._ensure_account_credits(uuid) from public;
revoke all on function public.reset_subscription_cycle(uuid) from public;
grant execute on function public.reset_subscription_cycle(uuid) to service_role;
revoke all on function public.apply_topup_credits(uuid, uuid, text, text, bigint, integer, text, text, text) from public;
revoke all on function public.grant_subscription_credits(uuid, bigint) from public;
grant execute on function public._ensure_account_credits(uuid) to service_role;
grant execute on function public.apply_topup_credits(uuid, uuid, text, text, bigint, integer, text, text, text) to service_role;
grant execute on function public.grant_subscription_credits(uuid, bigint) to service_role;

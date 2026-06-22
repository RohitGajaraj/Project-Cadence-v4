-- Top-up per-cycle cap: enforce at the grant point (STRIPE-KEYREADY, Lane 2, 2026-06-22).
--
-- The per-cycle top-up ceiling was checked ONLY in createTopUpCheckout BEFORE the Stripe
-- session is created (a TOCTOU pre-check). The grant RPC apply_topup_credits enforced nothing, so
-- two near-simultaneous top-ups could each pass the pre-check (neither yet a completed row) and
-- then both credit, blowing past the ceiling. (The other bypass — hitting the generic
-- createCheckoutSession with a topup_* key — is closed in payments.functions.ts.)
--
-- This adds the same cap check INSIDE apply_topup_credits, under a FOR UPDATE lock on
-- account_credits so concurrent grants for the account serialize: the second sees the first's
-- completed row in the cycle sum and is rejected. It mirrors the pre-check's cap (monthly_grant*2,
-- else a 5000 fallback) and its user+environment+cycle scoping, so a top-up that legitimately
-- passed the pre-check is NOT rejected here — only a genuine over-cap (race / direct bypass) is.
-- A rejected top-up is marked status='capped' (it then drops out of the cycle sum and leaves an
-- audit trail for the operator to refund). Forward-only; behavior-identical for an in-budget grant.

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
  _grant bigint;
  _anchor timestamptz;
  _cap bigint;
  _spend bigint;
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

  -- Per-cycle cap backstop. Lock the account_credits row so concurrent grants serialize;
  -- the cycle sum below then includes the just-inserted completed row(s).
  select monthly_grant_credits, cycle_anchor into _grant, _anchor
    from public.account_credits where account_id = _account_id for update;
  _cap := case when coalesce(_grant, 0) > 0 then _grant * 2 else 5000 end;
  select coalesce(sum(credits_added), 0) into _spend
    from public.credit_topups
    where user_id = _user_id
      and status = 'completed'
      and environment = _env
      and created_at >= coalesce(_anchor, now() - interval '30 days');
  if _spend > _cap then
    -- Over the ceiling (race / bypass): do NOT grant. Mark this row so it drops out of the
    -- cycle sum and leaves an audit trail (the payment needs operator reconciliation).
    update public.credit_topups set status = 'capped' where stripe_session_id = _session_id;
    return jsonb_build_object('applied', false, 'reason', 'cap_exceeded', 'cap', _cap);
  end if;

  update public.account_credits
     set topup_credits = coalesce(topup_credits, 0) + _credits,
         updated_at = now()
   where account_id = _account_id;

  insert into public.credit_ledger (account_id, user_id, delta_credits, reason)
  values (_account_id, _user_id, _credits, 'topup');

  return jsonb_build_object('applied', true, 'credits', _credits);
end;
$$;

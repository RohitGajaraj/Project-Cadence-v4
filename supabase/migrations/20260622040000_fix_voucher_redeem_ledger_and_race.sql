-- Fix the voucher redemption engine (STRIPE-KEYREADY, Lane 2, 2026-06-22).
--
-- Two real defects made every credit-bearing voucher unredeemable / unsafe:
--
--  (1) credit_ledger.reason CHECK violation. redeem_voucher wrote
--      reason = 'voucher:'||code, but credit_ledger.reason is constrained to
--      ('grant','reset','debit','topup','adjustment'). The 'voucher:CODE' string
--      can never satisfy the CHECK, so the INSERT raised inside the function and
--      rolled back the ENTIRE redemption (balance bump + redemption row). Net:
--      no credit_grant / signup-with-credits voucher ever granted anything.
--      Fix: reason = 'grant' (an allowed value) and carry the code in the
--      existing credit_ledger.surface column for provenance.
--
--  (2) TOCTOU race + no DB backstop. The max_redemptions cap check and the
--      per-user double-redeem check were unlocked reads, and voucher_redemptions
--      had no unique (voucher_id, user_id) constraint, so two concurrent
--      redemptions (or a double-click) could both pass and both grant.
--      Fix: a unique index on (voucher_id, user_id) as the DB backstop, and a
--      SELECT ... FOR UPDATE lock on the voucher row so the cap + double-redeem
--      checks are serialized per voucher.
--
-- Forward-only, idempotent. plan_upgrade vouchers were unaffected (no ledger
-- write) but the lock + provenance still apply.

-- (2) DB backstop: one redemption per (voucher, user). The redeem path has been
-- broken (no credit voucher ever redeemed), so no existing duplicates can block
-- this; created as a unique index so it is a no-op on re-apply.
create unique index if not exists voucher_redemptions_voucher_user_uniq
  on public.voucher_redemptions (voucher_id, user_id);

create or replace function public.redeem_voucher(_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _v public.vouchers;
  _count int;
  _aid uuid;
  _new_balance bigint;
begin
  if _uid is null then raise exception 'auth required'; end if;
  -- Lock the voucher row so concurrent redemptions of the same code serialize:
  -- the cap + double-redeem checks below are then race-safe.
  select * into _v from public.vouchers where code = upper(_code) for update;
  if _v is null then return jsonb_build_object('ok', false, 'error', 'Invalid code'); end if;
  if not _v.active then return jsonb_build_object('ok', false, 'error', 'Code is no longer active'); end if;
  if _v.expires_at is not null and _v.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Code expired');
  end if;
  if _v.max_redemptions is not null then
    select count(*) into _count from public.voucher_redemptions where voucher_id = _v.id;
    if _count >= _v.max_redemptions then
      return jsonb_build_object('ok', false, 'error', 'Code fully redeemed');
    end if;
  end if;
  -- Prevent double-redeem by same user (now race-safe under the row lock; the
  -- unique index is the ultimate backstop).
  if exists (select 1 from public.voucher_redemptions where voucher_id = _v.id and user_id = _uid) then
    return jsonb_build_object('ok', false, 'error', 'Already redeemed');
  end if;

  if _v.kind = 'credit_grant' then
    select id into _aid from public.accounts where owner_id = _uid order by created_at asc limit 1;
    if _aid is null then return jsonb_build_object('ok', false, 'error', 'No account'); end if;
    insert into public.account_credits (account_id, balance_credits) values (_aid, 0) on conflict (account_id) do nothing;
    update public.account_credits set balance_credits = balance_credits + coalesce(_v.credits,0), updated_at = now()
      where account_id = _aid returning balance_credits into _new_balance;
    insert into public.credit_ledger (account_id, user_id, delta_credits, reason, surface)
      values (_aid, _uid, coalesce(_v.credits,0), 'grant', 'voucher:' || _v.code);
  elsif _v.kind = 'plan_upgrade' then
    update public.subscriptions
      set plan_override_tier = _v.plan_tier,
          plan_override_expires_at = _v.expires_at,
          plan_override_reason = 'voucher:' || _v.code
      where user_id = _uid;
    if not found then
      insert into public.subscriptions (user_id, plan_override_tier, plan_override_expires_at, plan_override_reason)
      values (_uid, _v.plan_tier, _v.expires_at, 'voucher:' || _v.code);
    end if;
  elsif _v.kind = 'signup' then
    -- For already-signed-in users, treat signup-kind as credit + plan
    if _v.plan_tier is not null then
      update public.subscriptions set plan_override_tier = _v.plan_tier,
          plan_override_expires_at = _v.expires_at, plan_override_reason = 'voucher:'||_v.code
        where user_id = _uid;
      if not found then
        insert into public.subscriptions (user_id, plan_override_tier, plan_override_expires_at, plan_override_reason)
        values (_uid, _v.plan_tier, _v.expires_at, 'voucher:'||_v.code);
      end if;
    end if;
    if coalesce(_v.credits,0) > 0 then
      select id into _aid from public.accounts where owner_id = _uid order by created_at asc limit 1;
      if _aid is not null then
        insert into public.account_credits (account_id, balance_credits) values (_aid, 0) on conflict (account_id) do nothing;
        update public.account_credits set balance_credits = balance_credits + _v.credits, updated_at = now()
          where account_id = _aid returning balance_credits into _new_balance;
        insert into public.credit_ledger (account_id, user_id, delta_credits, reason, surface)
          values (_aid, _uid, _v.credits, 'grant', 'voucher:'||_v.code);
      end if;
    end if;
  end if;

  insert into public.voucher_redemptions (voucher_id, user_id, meta)
    values (_v.id, _uid, jsonb_build_object('code', _v.code, 'kind', _v.kind));

  return jsonb_build_object('ok', true, 'kind', _v.kind, 'credits', _v.credits, 'plan_tier', _v.plan_tier);
end $$;

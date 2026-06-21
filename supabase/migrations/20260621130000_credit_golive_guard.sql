-- Go-live safety for the credit engine (incident-prevention).
-- On 2026-06-21 the admin "credits engine" toggle was flipped ON with ZERO credits granted,
-- so assertAccountCredits halted EVERY AI call on the live app (balance 0 < projected). This
-- migration makes that impossible to repeat and gives the founder a one-call backfill so
-- go-live is safe.
--
-- (1) backfill_account_credits(): grant every account its tier's monthly base allowance
--     (free 500, pro 2500, max 10000, team 10000; enterprise = custom, skipped), but only
--     where the account has not already been granted (monthly_grant_credits = 0), preserving
--     any bundle grant from a subscription and any purchased top-ups. Writes 'grant' ledger
--     rows. Idempotent. Service-role only (the founder/ops runs it at go-live).
-- (2) admin_set_credits_enabled(): add a guard that REFUSES to enable metering while any
--     non-enterprise account still has 0 total credits - the exact state that caused the
--     outage. The admin must run the backfill (and/or let subscriptions grant) first.

create or replace function public.backfill_account_credits()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _granted integer := 0;
begin
  with base as (
    select c.account_id,
           case a.plan_tier
             when 'free' then 500
             when 'pro' then 2500
             when 'max' then 10000
             when 'team' then 10000
             else 0
           end as amount
    from public.account_credits c
    join public.accounts a on a.id = c.account_id
    where coalesce(c.monthly_grant_credits, 0) = 0
  ),
  upd as (
    update public.account_credits c
       set monthly_grant_credits = b.amount,
           balance_credits = b.amount,
           cycle_anchor = now(),
           updated_at = now()
      from base b
     where c.account_id = b.account_id and b.amount > 0
    returning c.account_id, b.amount
  )
  insert into public.credit_ledger (account_id, delta_credits, reason)
  select account_id, amount, 'grant' from upd;
  get diagnostics _granted = row_count;
  return jsonb_build_object('granted_accounts', _granted);
end;
$$;

revoke all on function public.backfill_account_credits() from public;
grant execute on function public.backfill_account_credits() to service_role;

create or replace function public.admin_set_credits_enabled(_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _unfunded integer;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Incident guard: never arm metering while a non-enterprise account has 0 credits, or
  -- assertAccountCredits would block every AI call for that account the moment it runs.
  if _enabled then
    select count(*) into _unfunded
    from public.account_credits c
    join public.accounts a on a.id = c.account_id
    where a.plan_tier <> 'enterprise'
      and coalesce(c.balance_credits, 0) + coalesce(c.topup_credits, 0)
          + coalesce(c.monthly_grant_credits, 0) = 0;
    if _unfunded > 0 then
      raise exception
        'refusing to enable credit metering: % account(s) have 0 credits granted. Run backfill_account_credits() (and confirm subscriptions have granted) before enabling, or AI calls will be blocked.',
        _unfunded
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('credits_enabled', to_jsonb(_enabled), now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  return _enabled;
end;
$$;

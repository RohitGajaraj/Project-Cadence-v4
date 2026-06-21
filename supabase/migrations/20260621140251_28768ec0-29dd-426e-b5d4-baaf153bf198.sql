-- ===== 20260621120000_credit_flow_apply.sql =====
alter table public.credit_topups alter column credits_added type bigint;

create or replace function public._ensure_account_credits(_account_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.account_credits (account_id, balance_credits, monthly_grant_credits, topup_credits)
  values (_account_id, 0, 0, 0)
  on conflict (account_id) do nothing;
end;
$$;

create or replace function public.apply_topup_credits(
  _user_id uuid, _account_id uuid, _session_id text, _payment_intent_id text,
  _credits bigint, _amount_cents integer, _currency text, _lookup_key text, _env text
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare _inserted integer;
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
  ) on conflict (stripe_session_id) do nothing;
  get diagnostics _inserted = row_count;
  if _inserted = 0 then return jsonb_build_object('applied', false, 'reason', 'duplicate'); end if;
  perform public._ensure_account_credits(_account_id);
  update public.account_credits
     set topup_credits = coalesce(topup_credits, 0) + _credits, updated_at = now()
   where account_id = _account_id;
  insert into public.credit_ledger (account_id, user_id, delta_credits, reason)
  values (_account_id, _user_id, _credits, 'topup');
  return jsonb_build_object('applied', true, 'credits', _credits);
end;
$$;

create or replace function public.grant_subscription_credits(_account_id uuid, _credits bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare _cur bigint; _grant bigint; _delta bigint;
begin
  if _account_id is null or _credits is null or _credits < 0 then
    return jsonb_build_object('granted', false, 'reason', 'bad_args');
  end if;
  perform public._ensure_account_credits(_account_id);
  select coalesce(balance_credits, 0), coalesce(monthly_grant_credits, 0)
    into _cur, _grant from public.account_credits where account_id = _account_id for update;
  if _grant = _credits then return jsonb_build_object('granted', false, 'reason', 'unchanged'); end if;
  _delta := _credits - _cur;
  update public.account_credits
     set balance_credits = _credits, monthly_grant_credits = _credits,
         cycle_anchor = now(), updated_at = now()
   where account_id = _account_id;
  if _delta <> 0 then
    insert into public.credit_ledger (account_id, delta_credits, reason)
    values (_account_id, _delta, 'grant');
  end if;
  return jsonb_build_object('granted', true, 'credits', _credits, 'delta', _delta);
end;
$$;

create or replace function public.reset_subscription_cycle(_account_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare _cur bigint; _grant bigint; _delta bigint;
begin
  if _account_id is null then return jsonb_build_object('reset', false, 'reason', 'bad_args'); end if;
  perform public._ensure_account_credits(_account_id);
  select coalesce(balance_credits, 0), coalesce(monthly_grant_credits, 0)
    into _cur, _grant from public.account_credits where account_id = _account_id for update;
  if _grant <= 0 then return jsonb_build_object('reset', false, 'reason', 'no_grant'); end if;
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
revoke all on function public.apply_topup_credits(uuid, uuid, text, text, bigint, integer, text, text, text) from public;
revoke all on function public.grant_subscription_credits(uuid, bigint) from public;
grant execute on function public._ensure_account_credits(uuid) to service_role;
grant execute on function public.reset_subscription_cycle(uuid) to service_role;
grant execute on function public.apply_topup_credits(uuid, uuid, text, text, bigint, integer, text, text, text) to service_role;
grant execute on function public.grant_subscription_credits(uuid, bigint) to service_role;

-- ===== 20260621130000_credit_golive_guard.sql =====
create or replace function public.backfill_account_credits()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare _granted integer := 0;
begin
  with base as (
    select c.account_id,
           case a.plan_tier
             when 'free' then 500 when 'pro' then 2500
             when 'max' then 10000 when 'team' then 10000
             else 0
           end as amount
    from public.account_credits c
    join public.accounts a on a.id = c.account_id
    where coalesce(c.monthly_grant_credits, 0) = 0
  ),
  upd as (
    update public.account_credits c
       set monthly_grant_credits = b.amount, balance_credits = b.amount,
           cycle_anchor = now(), updated_at = now()
      from base b where c.account_id = b.account_id and b.amount > 0
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
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare _unfunded integer;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _enabled then
    select count(*) into _unfunded
    from public.account_credits c
    join public.accounts a on a.id = c.account_id
    where a.plan_tier <> 'enterprise'
      and coalesce(c.balance_credits, 0) + coalesce(c.topup_credits, 0)
          + coalesce(c.monthly_grant_credits, 0) = 0;
    if _unfunded > 0 then
      raise exception
        'refusing to enable credit metering: % account(s) have 0 credits granted. Run backfill_account_credits() first.',
        _unfunded using errcode = 'check_violation';
    end if;
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('credits_enabled', to_jsonb(_enabled), now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  return _enabled;
end;
$$;

-- ===== 20260621170000_fnd05_agent_tool_cap.sql =====
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS max_tool_risk text
  CHECK (max_tool_risk IS NULL OR max_tool_risk IN ('low', 'medium', 'high'));

-- ===== 20260621200000_l2_announcements.sql =====
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'pending', 'published')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_workspace_status_idx
  on public.announcements (workspace_id, status, created_at desc);
create index if not exists announcements_slug_idx on public.announcements (slug);

grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
grant select on public.announcements to anon;

alter table public.announcements enable row level security;

drop policy if exists "announcements members read" on public.announcements;
create policy "announcements members read"
  on public.announcements for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "announcements public read published" on public.announcements;
create policy "announcements public read published"
  on public.announcements for select
  using (status = 'published');

drop policy if exists "announcements members create draft" on public.announcements;
create policy "announcements members create draft"
  on public.announcements for insert
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
    and status = 'draft'
    and created_by = auth.uid()
  );

drop policy if exists "announcements members update" on public.announcements;
create policy "announcements members update"
  on public.announcements for update
  using (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
    and status in ('draft', 'pending')
  )
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
    and status in ('draft', 'pending')
  );

drop trigger if exists trg_announcements_updated on public.announcements;
create trigger trg_announcements_updated
  before update on public.announcements
  for each row execute function public.set_updated_at();

create or replace function public.publish_announcement(
  _announcement_id uuid, _workspace_id uuid
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.can_manage_workspace(_workspace_id) then
    raise exception 'Only workspace owners and admins can publish announcements.';
  end if;
  update public.announcements
    set status = 'published', published_at = now()
  where id = _announcement_id and workspace_id = _workspace_id and status = 'pending';
  if not found then
    raise exception 'Announcement not found, not pending, or workspace mismatch.';
  end if;
end;
$$;

revoke execute on function public.publish_announcement(uuid, uuid) from public, anon;
grant execute on function public.publish_announcement(uuid, uuid) to authenticated, service_role;

-- Admin RPCs (SECURITY DEFINER, has_role-gated) for Phase 8 admin console:
-- manage credits engine toggle, edit pricing/topup bundles, manage admins.

-- app_settings: admin read/write policy (writes already go through RPC)
alter table public.app_settings enable row level security;
drop policy if exists "admins manage app_settings" on public.app_settings;
create policy "admins manage app_settings" on public.app_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
grant select on public.app_settings to authenticated;

-- Upsert a pricing bundle (a credit point in a tier)
create or replace function public.admin_upsert_bundle(
  _id uuid,
  _tier text,
  _credits int,
  _monthly_cents int,
  _yearly_cents int,
  _stripe_price_id_monthly text,
  _stripe_price_id_yearly text,
  _recommended boolean,
  _active boolean,
  _sort_order int
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _id is null then
    insert into public.pricing_bundles
      (tier, credits, monthly_cents, yearly_cents, stripe_price_id_monthly, stripe_price_id_yearly, recommended, active, sort_order)
    values (_tier, _credits, _monthly_cents, _yearly_cents, _stripe_price_id_monthly, _stripe_price_id_yearly, coalesce(_recommended,false), coalesce(_active,true), coalesce(_sort_order,0))
    on conflict (tier, credits) do update
      set monthly_cents = excluded.monthly_cents,
          yearly_cents = excluded.yearly_cents,
          stripe_price_id_monthly = excluded.stripe_price_id_monthly,
          stripe_price_id_yearly = excluded.stripe_price_id_yearly,
          recommended = excluded.recommended,
          active = excluded.active,
          sort_order = excluded.sort_order
    returning id into v_id;
  else
    update public.pricing_bundles set
      tier = coalesce(_tier, tier),
      credits = coalesce(_credits, credits),
      monthly_cents = coalesce(_monthly_cents, monthly_cents),
      yearly_cents = coalesce(_yearly_cents, yearly_cents),
      stripe_price_id_monthly = _stripe_price_id_monthly,
      stripe_price_id_yearly = _stripe_price_id_yearly,
      recommended = coalesce(_recommended, recommended),
      active = coalesce(_active, active),
      sort_order = coalesce(_sort_order, sort_order)
    where id = _id
    returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.admin_upsert_bundle(uuid,text,int,int,int,text,text,boolean,boolean,int) to authenticated;

create or replace function public.admin_delete_bundle(_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.pricing_bundles where id = _id;
  return true;
end $$;
grant execute on function public.admin_delete_bundle(uuid) to authenticated;

-- Topup bundle upsert
create or replace function public.admin_upsert_topup_bundle(
  _id uuid,
  _credits int,
  _price_cents int,
  _stripe_price_id text,
  _active boolean,
  _sort_order int
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _id is null then
    insert into public.pricing_topup_bundles (credits, price_cents, stripe_price_id, active, sort_order)
    values (_credits, _price_cents, _stripe_price_id, coalesce(_active,true), coalesce(_sort_order,0))
    on conflict (credits) do update
      set price_cents = excluded.price_cents,
          stripe_price_id = excluded.stripe_price_id,
          active = excluded.active,
          sort_order = excluded.sort_order
    returning id into v_id;
  else
    update public.pricing_topup_bundles set
      credits = coalesce(_credits, credits),
      price_cents = coalesce(_price_cents, price_cents),
      stripe_price_id = _stripe_price_id,
      active = coalesce(_active, active),
      sort_order = coalesce(_sort_order, sort_order)
    where id = _id
    returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.admin_upsert_topup_bundle(uuid,int,int,text,boolean,int) to authenticated;

create or replace function public.admin_delete_topup_bundle(_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.pricing_topup_bundles where id = _id;
  return true;
end $$;
grant execute on function public.admin_delete_topup_bundle(uuid) to authenticated;

-- Admins management
create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select ur.user_id, u.email::text, ur.created_at
    from public.user_roles ur
    join auth.users u on u.id = ur.user_id
    where ur.role = 'admin'
    order by ur.created_at asc;
end $$;
grant execute on function public.admin_list_admins() to authenticated;

create or replace function public.admin_add_admin_by_email(_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if v_uid is null then
    raise exception 'no user with that email' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role) values (v_uid, 'admin')
  on conflict (user_id, role) do nothing;
  return v_uid;
end $$;
grant execute on function public.admin_add_admin_by_email(text) to authenticated;

create or replace function public.admin_remove_admin(_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into v_count from public.user_roles where role = 'admin';
  if v_count <= 1 then
    raise exception 'cannot remove the last admin' using errcode = '23514';
  end if;
  delete from public.user_roles where user_id = _user_id and role = 'admin';
  return true;
end $$;
grant execute on function public.admin_remove_admin(uuid) to authenticated;

-- One-time bootstrap: if there are zero admins yet, the first authenticated
-- caller of admin_bootstrap_self_as_admin promotes themselves. After that
-- the function refuses, so it cannot be used to escalate later.
create or replace function public.admin_bootstrap_self_as_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  select count(*) into v_count from public.user_roles where role = 'admin';
  if v_count > 0 then
    raise exception 'admin already exists' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
  on conflict (user_id, role) do nothing;
  return true;
end $$;
grant execute on function public.admin_bootstrap_self_as_admin() to authenticated;

-- Fix legacy plaintext api_key column on user_api_keys: drop after one last
-- nullify pass so any remaining row stops returning the plaintext.
update public.user_api_keys set api_key = null where api_key is not null;
alter table public.user_api_keys drop column if exists api_key;

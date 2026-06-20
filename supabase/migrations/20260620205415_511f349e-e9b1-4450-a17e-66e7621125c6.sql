create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
drop policy if exists "app_settings admin read" on public.app_settings;
create policy "app_settings admin read" on public.app_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

insert into public.app_settings (key, value)
values ('credits_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.credits_enabled()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.app_settings where key = 'credits_enabled'),
    false
  )
$$;
revoke execute on function public.credits_enabled() from public;
grant execute on function public.credits_enabled() to anon, authenticated, service_role;

create or replace function public.admin_set_credits_enabled(_enabled boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('credits_enabled', to_jsonb(_enabled), now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  return _enabled;
end $$;
revoke execute on function public.admin_set_credits_enabled(boolean) from public;
grant execute on function public.admin_set_credits_enabled(boolean) to authenticated;

create or replace function public.admin_upsert_topup_bundle(
  _id uuid,
  _credits int,
  _price_cents int,
  _sort_order int,
  _active boolean
) returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _credits is null or _credits <= 0 then raise exception 'credits must be > 0'; end if;
  if _price_cents is null or _price_cents <= 0 then raise exception 'price_cents must be > 0'; end if;
  if _id is null then
    insert into public.pricing_topup_bundles (credits, price_cents, sort_order, active)
    values (_credits, _price_cents, coalesce(_sort_order, 0), coalesce(_active, true))
    on conflict (credits) do update
      set price_cents = excluded.price_cents,
          sort_order = excluded.sort_order,
          active = excluded.active,
          updated_at = now()
    returning id into new_id;
  else
    update public.pricing_topup_bundles
      set credits = _credits,
          price_cents = _price_cents,
          sort_order = coalesce(_sort_order, sort_order),
          active = coalesce(_active, active),
          updated_at = now()
      where id = _id
      returning id into new_id;
  end if;
  return new_id;
end $$;
revoke execute on function public.admin_upsert_topup_bundle(uuid, int, int, int, boolean) from public;
grant execute on function public.admin_upsert_topup_bundle(uuid, int, int, int, boolean) to authenticated;

create or replace function public.admin_set_bundle_active(_id uuid, _active boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.pricing_bundles set active = _active, updated_at = now() where id = _id;
  return _active;
end $$;
revoke execute on function public.admin_set_bundle_active(uuid, boolean) from public;
grant execute on function public.admin_set_bundle_active(uuid, boolean) to authenticated;
-- M-C-EXPIRY: wire memory_expiry_enabled() to app_settings so the admin
-- can flip the gate from the Admin > Platform surface without a migration.
--
-- The original function (20260616210000) was IMMUTABLE SELECT false.
-- This replaces it with the same app_settings pattern used by
-- observability_enabled() / admin_set_observability_enabled().
-- Existing behaviour is unchanged: the gate defaults to false; no memory
-- has ever been stamped with an expires_at (because the trigger was always
-- a no-op), so enabling this starts expiry on new free-tier inserts only.
-- Existing rows without expires_at are grandfathered (never expire).

create or replace function public.memory_expiry_enabled()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    (select (value->>'enabled')::boolean
       from public.app_settings
      where key = 'memory_expiry_enabled'),
    false
  );
$$;
revoke execute on function public.memory_expiry_enabled() from public;
grant execute on function public.memory_expiry_enabled() to anon, authenticated, service_role;

create or replace function public.admin_set_memory_expiry_enabled(_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('memory_expiry_enabled', jsonb_build_object('enabled', _enabled), now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  insert into public.admin_audit_log (actor_user_id, action, target_kind, target_id, payload)
  values (auth.uid(), 'memory_expiry.set_enabled', 'app_settings', 'memory_expiry_enabled',
          jsonb_build_object('enabled', _enabled));
  return _enabled;
end;
$$;
revoke execute on function public.admin_set_memory_expiry_enabled(boolean) from public;
grant execute on function public.admin_set_memory_expiry_enabled(boolean) to authenticated, service_role;

-- Seed the initial false value so the read-path never gets null on a fresh DB.
insert into public.app_settings (key, value, updated_at)
values ('memory_expiry_enabled', '{"enabled": false}', now())
on conflict (key) do nothing;

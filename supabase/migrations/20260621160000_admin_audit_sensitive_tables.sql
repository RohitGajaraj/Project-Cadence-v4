-- Complete the admin audit trail (F-ADMIN-AUDIT-V1GAP).
-- The v2 admin RPCs already call admin_audit() in-RPC, but the v1 pricing-catalog CRUD, the
-- admin ROSTER (add/remove platform admin), and the credits-engine toggle write their tables
-- with NO audit row - so the two highest-stakes actions (granting platform admin, flipping
-- metering on/off) had zero trail. Rather than hand-edit ~11 SECURITY DEFINER functions, audit
-- at the DATA layer: one trigger fn + AFTER triggers on the sensitive tables. This is
-- bypass-proof (catches every write path, incl. direct writes + any future RPC), records actor
-- + old/new + timestamp, and SKIPS system/service-role/migration writes (no JWT -> auth.uid()
-- null). No double-logging: the v2 RPCs mutate different tables. No secrets live in these tables
-- (Stripe ids are in the *_billing_secrets vaults, which are NOT triggered here). Dry-run-verified
-- on the live DB: a no-JWT write is skipped; a real admin write logs actor+kind+old/new.

-- The audit log's target_kind CHECK only knew the v2 semantic kinds; extend it for the data
-- layer (role / setting / plan / pricing) so the trigger's rows are accepted.
alter table public.admin_audit_log drop constraint if exists admin_audit_log_target_kind_check;
alter table public.admin_audit_log add constraint admin_audit_log_target_kind_check
  check (target_kind = any (array[
    'user', 'workspace', 'voucher', 'invitation', 'domain', 'signup_approval',
    'flag', 'banner', 'subscription', 'role', 'setting', 'plan', 'pricing'
  ]));

create or replace function public._admin_audit_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _actor uuid := auth.uid();
  _rec jsonb;
  _kind text;
begin
  -- Only audit real user-driven (admin) writes; system/service-role/migration writes have no JWT.
  if _actor is null then
    return coalesce(NEW, OLD);
  end if;
  _kind := case TG_TABLE_NAME
    when 'user_roles' then 'role'
    when 'app_settings' then 'setting'
    when 'pricing_plans' then 'plan'
    when 'pricing_bundles' then 'pricing'
    when 'pricing_topup_bundles' then 'pricing'
    else 'setting'
  end;
  _rec := to_jsonb(coalesce(NEW, OLD));
  insert into public.admin_audit_log (actor_user_id, action, target_kind, target_id, payload)
  values (
    _actor,
    lower(TG_OP) || '_' || TG_TABLE_NAME,
    _kind,
    coalesce(_rec ->> 'id', _rec ->> 'key', _rec ->> 'tier', _rec ->> 'user_id'),
    jsonb_build_object(
      'op', TG_OP,
      'old', case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end,
      'new', case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end
    )
  );
  return coalesce(NEW, OLD);
end;
$$;

revoke all on function public._admin_audit_change() from public;

drop trigger if exists _audit_user_roles on public.user_roles;
create trigger _audit_user_roles
  after insert or update or delete on public.user_roles
  for each row execute function public._admin_audit_change();

drop trigger if exists _audit_app_settings on public.app_settings;
create trigger _audit_app_settings
  after insert or update or delete on public.app_settings
  for each row execute function public._admin_audit_change();

drop trigger if exists _audit_pricing_plans on public.pricing_plans;
create trigger _audit_pricing_plans
  after insert or update or delete on public.pricing_plans
  for each row execute function public._admin_audit_change();

drop trigger if exists _audit_pricing_bundles on public.pricing_bundles;
create trigger _audit_pricing_bundles
  after insert or update or delete on public.pricing_bundles
  for each row execute function public._admin_audit_change();

drop trigger if exists _audit_pricing_topup_bundles on public.pricing_topup_bundles;
create trigger _audit_pricing_topup_bundles
  after insert or update or delete on public.pricing_topup_bundles
  for each row execute function public._admin_audit_change();

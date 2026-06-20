-- Admin Console v2 — Step 1: schema, GRANTs, RLS, helper fns

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_kind text not null check (target_kind in ('user','workspace','voucher','invitation','domain','signup_approval','flag','banner','subscription')),
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_kind, target_id);
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
drop policy if exists "admin_audit_log admin read" on public.admin_audit_log;
create policy "admin_audit_log admin read"
  on public.admin_audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_audit(
  _action text, _target_kind text, _target_id text, _payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.admin_audit_log (actor_user_id, action, target_kind, target_id, payload)
  values (auth.uid(), _action, _target_kind, _target_id, coalesce(_payload, '{}'::jsonb))
  returning id into _id;
  return _id;
end $$;

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('signup','credit_grant','plan_upgrade')),
  plan_tier text references public.pricing_plans(tier) on delete set null,
  credits integer,
  auto_login boolean not null default false,
  max_redemptions integer,
  expires_at timestamptz,
  campaign_tag text,
  created_by uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vouchers_active_idx on public.vouchers (active);
grant select, insert, update, delete on public.vouchers to authenticated;
grant all on public.vouchers to service_role;
alter table public.vouchers enable row level security;
drop policy if exists "vouchers admin all" on public.vouchers;
create policy "vouchers admin all" on public.vouchers for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  redeemed_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);
create index if not exists voucher_redemptions_voucher_idx on public.voucher_redemptions (voucher_id);
create index if not exists voucher_redemptions_user_idx on public.voucher_redemptions (user_id);
grant select on public.voucher_redemptions to authenticated;
grant all on public.voucher_redemptions to service_role;
alter table public.voucher_redemptions enable row level security;
drop policy if exists "voucher_redemptions admin read" on public.voucher_redemptions;
create policy "voucher_redemptions admin read" on public.voucher_redemptions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "voucher_redemptions self read" on public.voucher_redemptions;
create policy "voucher_redemptions self read" on public.voucher_redemptions for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  workspace_id uuid,
  role text not null default 'member',
  token text not null unique,
  state text not null default 'pending' check (state in ('pending','accepted','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_state_idx on public.invitations (state);
create index if not exists invitations_email_idx on public.invitations (lower(email));
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
drop policy if exists "invitations admin all" on public.invitations;
create policy "invitations admin all" on public.invitations for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.get_invitation_by_token(_token text)
returns table (id uuid, email text, workspace_id uuid, role text, state text, expires_at timestamptz)
language sql security definer stable set search_path = public as $$
  select i.id, i.email, i.workspace_id, i.role, i.state, i.expires_at
  from public.invitations i where i.token = _token
$$;

create table if not exists public.auto_approve_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  workspace_id uuid,
  default_role text not null default 'member',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.auto_approve_domains to authenticated;
grant all on public.auto_approve_domains to service_role;
alter table public.auto_approve_domains enable row level security;
drop policy if exists "auto_approve_domains admin all" on public.auto_approve_domains;
create policy "auto_approve_domains admin all" on public.auto_approve_domains for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.signup_approvals (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  requested_workspace_id uuid,
  state text not null default 'pending' check (state in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists signup_approvals_state_idx on public.signup_approvals (state);
grant select, insert, update, delete on public.signup_approvals to authenticated;
grant all on public.signup_approvals to service_role;
alter table public.signup_approvals enable row level security;
drop policy if exists "signup_approvals admin all" on public.signup_approvals;
create policy "signup_approvals admin all" on public.signup_approvals for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;
alter table public.feature_flags enable row level security;
drop policy if exists "feature_flags admin all" on public.feature_flags;
create policy "feature_flags admin all" on public.feature_flags for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.get_flag(_key text)
returns table (enabled boolean, payload jsonb)
language sql security definer stable set search_path = public as $$
  select coalesce(f.enabled,false), coalesce(f.payload,'{}'::jsonb)
  from public.feature_flags f where f.key = _key
$$;

create table if not exists public.system_banner (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  level text not null default 'info' check (level in ('info','warn','alert')),
  active boolean not null default true,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.system_banner to authenticated;
grant all on public.system_banner to service_role;
alter table public.system_banner enable row level security;
drop policy if exists "system_banner admin all" on public.system_banner;
create policy "system_banner admin all" on public.system_banner for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.get_active_banner()
returns table (id uuid, message text, level text, expires_at timestamptz)
language sql security definer stable set search_path = public as $$
  select b.id, b.message, b.level, b.expires_at from public.system_banner b
  where b.active = true and (b.expires_at is null or b.expires_at > now())
  order by b.updated_at desc limit 1
$$;

grant execute on function public.get_active_banner() to anon, authenticated;
grant execute on function public.get_flag(text) to anon, authenticated;
grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
grant execute on function public.admin_audit(text, text, text, jsonb) to authenticated;

alter table public.profiles add column if not exists suspended boolean not null default false;

alter table public.subscriptions
  add column if not exists plan_override_tier text references public.pricing_plans(tier) on delete set null,
  add column if not exists plan_override_expires_at timestamptz,
  add column if not exists plan_override_reason text;

do $$ begin
  if not exists (select 1 from pg_proc where proname='update_updated_at_column' and pronamespace='public'::regnamespace) then
    create function public.update_updated_at_column() returns trigger
    language plpgsql set search_path = public as $f$
    begin new.updated_at = now(); return new; end $f$;
  end if;
end $$;

drop trigger if exists vouchers_updated_at on public.vouchers;
create trigger vouchers_updated_at before update on public.vouchers
  for each row execute function public.update_updated_at_column();
drop trigger if exists feature_flags_updated_at on public.feature_flags;
create trigger feature_flags_updated_at before update on public.feature_flags
  for each row execute function public.update_updated_at_column();
drop trigger if exists system_banner_updated_at on public.system_banner;
create trigger system_banner_updated_at before update on public.system_banner
  for each row execute function public.update_updated_at_column();

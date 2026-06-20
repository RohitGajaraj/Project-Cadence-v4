
do $$ begin
  create type public.app_role as enum ('admin','member');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table if not exists public.account_billing_secrets (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);
grant all on public.account_billing_secrets to service_role;
alter table public.account_billing_secrets enable row level security;

create table if not exists public.workspace_billing_secrets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);
grant all on public.workspace_billing_secrets to service_role;
alter table public.workspace_billing_secrets enable row level security;

insert into public.account_billing_secrets (account_id, stripe_customer_id, stripe_subscription_id)
select id, stripe_customer_id, stripe_subscription_id from public.accounts
where stripe_customer_id is not null or stripe_subscription_id is not null
on conflict (account_id) do nothing;

insert into public.workspace_billing_secrets (workspace_id, stripe_customer_id, stripe_subscription_id)
select id, stripe_customer_id, stripe_subscription_id from public.workspaces
where stripe_customer_id is not null or stripe_subscription_id is not null
on conflict (workspace_id) do nothing;

revoke select (stripe_customer_id, stripe_subscription_id) on public.accounts from anon, authenticated;
revoke select (stripe_customer_id, stripe_subscription_id) on public.workspaces from anon, authenticated;

create table if not exists public.pricing_plans (
  tier text primary key,
  display_name text not null,
  tagline text,
  audience text not null default 'individual' check (audience in ('individual','business','enterprise')),
  sort_order int not null default 0,
  recommended boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_bundles (
  id uuid primary key default gen_random_uuid(),
  tier text not null references public.pricing_plans(tier) on delete cascade,
  credits int not null,
  monthly_cents int not null,
  yearly_cents int not null,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  recommended boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tier, credits)
);

create table if not exists public.pricing_features (
  id uuid primary key default gen_random_uuid(),
  tier text not null references public.pricing_plans(tier) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_topup_bundles (
  id uuid primary key default gen_random_uuid(),
  credits int not null unique,
  price_cents int not null,
  stripe_price_id text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.pricing_plans          to anon, authenticated;
grant select on public.pricing_bundles        to anon, authenticated;
grant select on public.pricing_features       to anon, authenticated;
grant select on public.pricing_topup_bundles  to anon, authenticated;
grant all    on public.pricing_plans          to service_role;
grant all    on public.pricing_bundles        to service_role;
grant all    on public.pricing_features       to service_role;
grant all    on public.pricing_topup_bundles  to service_role;

alter table public.pricing_plans          enable row level security;
alter table public.pricing_bundles        enable row level security;
alter table public.pricing_features       enable row level security;
alter table public.pricing_topup_bundles  enable row level security;

create policy "pricing_plans public read"         on public.pricing_plans         for select using (true);
create policy "pricing_bundles public read"       on public.pricing_bundles       for select using (active);
create policy "pricing_features public read"      on public.pricing_features      for select using (active);
create policy "pricing_topup_bundles public read" on public.pricing_topup_bundles for select using (active);

insert into public.pricing_plans (tier, display_name, tagline, audience, sort_order, recommended) values
  ('free',       'Star',          'Daily loop, free forever',                 'individual', 10, false),
  ('pro',        'Cluster',       'For makers shipping every week',           'individual', 20, true ),
  ('max',        'Constellation', 'For operators running the whole loop',     'individual', 30, false),
  ('team',       'Galaxy',        'For teams with shared memory & approvals', 'business',   40, false),
  ('enterprise', 'Cosmos',        'For organizations on outcome-based terms', 'enterprise', 50, false)
on conflict (tier) do nothing;

insert into public.pricing_bundles (tier, credits, monthly_cents, yearly_cents, recommended, sort_order) values
  ('pro',  500,   1500,   15000,  false, 10),
  ('pro',  1000,  2500,   25000,  true,  20),
  ('pro',  2000,  4500,   45000,  false, 30),
  ('pro',  5000,  9900,   99000,  false, 40),
  ('max',  2000,  4500,   45000,  false, 10),
  ('max',  5000,  9900,   99000,  true,  20),
  ('max',  10000, 17900,  179000, false, 30),
  ('max',  25000, 39900,  399000, false, 40),
  ('team', 500,   2000,   20000,  false, 10),
  ('team', 1000,  3000,   30000,  true,  20),
  ('team', 2500,  5500,   55000,  false, 30),
  ('team', 5000,  9900,   99000,  false, 40),
  ('team', 10000, 17900,  179000, false, 50)
on conflict (tier, credits) do nothing;

insert into public.pricing_features (tier, label, sort_order) values
  ('free', 'Daily loop and rituals',                  10),
  ('free', '100 AI credits per month',                20),
  ('free', 'Decision memory, 30 day rolling',         30),
  ('pro',  'Everything in Star, plus:',                5),
  ('pro',  'Persistent decision memory',              10),
  ('pro',  'Critic agent everywhere',                 20),
  ('pro',  'Shareable links',                         30),
  ('pro',  'Choose your monthly credit bundle',       40),
  ('max',  'Everything in Cluster, plus:',             5),
  ('max',  'High-volume credit bundles',              10),
  ('max',  'Priority routing',                        20),
  ('max',  'Extended memory retention',               30),
  ('team', 'Everything in Constellation, plus:',       5),
  ('team', 'Shared workspace memory',                 10),
  ('team', 'Per-role approval lanes',                 20),
  ('team', 'Per-seat credit pooling',                 30),
  ('enterprise', 'Everything in Galaxy, plus:',        5),
  ('enterprise', 'SSO and SAML',                      10),
  ('enterprise', 'Per-user credit allocation',        20),
  ('enterprise', 'Outcome-anchored pricing',          30),
  ('enterprise', 'Dedicated success engineer',        40);

insert into public.pricing_topup_bundles (credits, price_cents, sort_order) values
  (250,  500,  10),
  (1000, 1800, 20),
  (2500, 4000, 30)
on conflict (credits) do nothing;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists touch_pricing_plans on public.pricing_plans;
create trigger touch_pricing_plans before update on public.pricing_plans for each row execute function public.touch_updated_at();
drop trigger if exists touch_pricing_bundles on public.pricing_bundles;
create trigger touch_pricing_bundles before update on public.pricing_bundles for each row execute function public.touch_updated_at();
drop trigger if exists touch_pricing_topup_bundles on public.pricing_topup_bundles;
create trigger touch_pricing_topup_bundles before update on public.pricing_topup_bundles for each row execute function public.touch_updated_at();
drop trigger if exists touch_account_billing_secrets on public.account_billing_secrets;
create trigger touch_account_billing_secrets before update on public.account_billing_secrets for each row execute function public.touch_updated_at();
drop trigger if exists touch_workspace_billing_secrets on public.workspace_billing_secrets;
create trigger touch_workspace_billing_secrets before update on public.workspace_billing_secrets for each row execute function public.touch_updated_at();

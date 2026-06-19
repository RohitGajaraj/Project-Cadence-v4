-- WM-M2: accounts table + billing relocation + credit pool shell + rolling decay.
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-M2).
-- Relocates billing from the workspace to a new ACCOUNT level (the flywheel, §2.2),
-- adds the dormant credit pool shell (account_credits + credit_ledger), widens the
-- tier ladder to 5 slugs, and moves memory decay to a 30-day window that rolls off
-- last_used_at. Everything monetization stays DORMANT (no Stripe writes, credits_enabled()
-- = false, memory_expiry_enabled() still false) so the live app is unchanged until the
-- founder flips the flags + provisions secrets.
--
-- Mirrors the existing patterns: is_workspace_member (SECURITY DEFINER membership helper),
-- protect_workspace_billing_columns (service-role-only billing writes), the tenancy_c
-- assert-then-NOT-NULL backfill, ensure_user_default_workspace (idempotent provisioning).
--
-- Idempotent: re-runnable (IF NOT EXISTS / OR REPLACE / DROP-then-CREATE guarded).

-- ---------------------------------------------------------------------------
-- 1. Dormancy flag + account membership helper (mirror memory_expiry_enabled /
--    is_workspace_member). credits_enabled() gates the whole credit engine off.
-- ---------------------------------------------------------------------------
create or replace function public.credits_enabled()
returns boolean
language sql
immutable
set search_path to 'public'
as $$ select false $$;

-- ---------------------------------------------------------------------------
-- 2. accounts + account_members (the billing boundary). No protect trigger yet:
--    it is added in §6, AFTER the backfill, so the migration role (no JWT) cannot
--    clobber backfilled tiers to free.
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_tier text not null default 'free'
    check (plan_tier = any (array['free','pro','max','team','enterprise'])),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role = any (array['owner','admin','member','viewer'])),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 3. account_credits (the pool shell) + credit_ledger (service-role-write-only).
--    Included vs purchased top-up are distinct balances (WM-M11/M12 draw included
--    first, then top-up). Numbers stay 0 until the engine grants (WM-M11).
-- ---------------------------------------------------------------------------
create table if not exists public.account_credits (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  balance_credits bigint not null default 0,
  monthly_grant_credits bigint not null default 0,
  topup_credits bigint not null default 0,
  cycle_anchor timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  delta_credits bigint not null,
  reason text not null
    check (reason = any (array['grant','reset','debit','topup','adjustment'])),
  surface text,
  ai_event_id uuid,
  product_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. ensure_user_default_account: idempotent per-user account provisioning
--    (mirror ensure_user_default_workspace). Derives from owner_id, never auth.uid(),
--    so it is service-role-safe. Always leaves the account + owner member + a credits
--    shell row in place.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_default_account(_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  existing_id uuid;
  created_id uuid;
begin
  select m.account_id into existing_id
  from public.account_members m
  where m.user_id = _user_id
  order by m.created_at
  limit 1;
  if existing_id is not null then
    return existing_id;
  end if;

  select a.id into existing_id
  from public.accounts a
  where a.owner_id = _user_id
  order by a.created_at
  limit 1;
  if existing_id is not null then
    insert into public.account_members (account_id, user_id, role)
    values (existing_id, _user_id, 'owner')
    on conflict (account_id, user_id) do nothing;
    insert into public.account_credits (account_id)
    values (existing_id)
    on conflict (account_id) do nothing;
    return existing_id;
  end if;

  insert into public.accounts (owner_id)
  values (_user_id)
  returning id into created_id;
  insert into public.account_members (account_id, user_id, role)
  values (created_id, _user_id, 'owner')
  on conflict (account_id, user_id) do nothing;
  insert into public.account_credits (account_id)
  values (created_id)
  on conflict (account_id) do nothing;
  return created_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Backfill: one account per existing workspace owner, carrying their best plan.
--    DISTINCT ON picks, per owner, the highest tier (then any Stripe, then newest).
--    All current workspaces are free / no-Stripe, so this is a clean free backfill,
--    but the logic is correct on a paid DB too.
-- ---------------------------------------------------------------------------
insert into public.accounts (owner_id, plan_tier, stripe_customer_id, stripe_subscription_id, plan_updated_at)
select distinct on (w.owner_id)
  w.owner_id,
  w.plan_tier,
  w.stripe_customer_id,
  w.stripe_subscription_id,
  w.plan_updated_at
from public.workspaces w
where not exists (select 1 from public.accounts a where a.owner_id = w.owner_id)
order by
  w.owner_id,
  case w.plan_tier
    when 'enterprise' then 5 when 'team' then 4 when 'max' then 3 when 'pro' then 2 else 1
  end desc,
  (w.stripe_customer_id is not null) desc,
  w.plan_updated_at desc nulls last,
  w.created_at;

insert into public.account_members (account_id, user_id, role)
select a.id, a.owner_id, 'owner'
from public.accounts a
on conflict (account_id, user_id) do nothing;

insert into public.account_credits (account_id)
select a.id from public.accounts a
on conflict (account_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. protect_account_billing_columns (mirror the workspace trigger). Created AFTER
--    the backfill so it never touches the seeded rows. Non-service-role writes to the
--    billing columns are forced back to the prior/free values.
-- ---------------------------------------------------------------------------
create or replace function public.protect_account_billing_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if TG_OP = 'INSERT' then
      NEW.plan_tier := 'free';
      NEW.stripe_customer_id := null;
      NEW.stripe_subscription_id := null;
      NEW.plan_updated_at := null;
    else
      NEW.plan_tier := OLD.plan_tier;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.plan_updated_at := OLD.plan_updated_at;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_account_billing_columns on public.accounts;
create trigger trg_protect_account_billing_columns
  before insert or update on public.accounts
  for each row execute function public.protect_account_billing_columns();

-- keep accounts.updated_at / account_credits.updated_at fresh (shared set_updated_at).
drop trigger if exists trg_accounts_set_updated_at on public.accounts;
create trigger trg_accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_account_credits_set_updated_at on public.account_credits;
create trigger trg_account_credits_set_updated_at
  before update on public.account_credits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. workspaces.account_id: add, backfill, assert, auto-fill trigger, NOT NULL.
--    Every workspace has a NOT NULL owner_id, so account_id is derivable and the
--    BEFORE INSERT trigger guarantees future rows are linked (unlike agent_memory's
--    many service-role insert paths, which is why WM-F1 kept that column nullable).
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

update public.workspaces w
set account_id = a.id
from public.accounts a
where a.owner_id = w.owner_id and w.account_id is null;

do $$
declare n bigint;
begin
  select count(*) into n from public.workspaces where account_id is null;
  if n > 0 then
    raise exception 'WM-M2 backfill incomplete: % workspaces still have a null account_id', n;
  end if;
end $$;

create or replace function public.set_workspace_account()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if NEW.account_id is null then
    NEW.account_id := public.ensure_user_default_account(NEW.owner_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_workspace_account on public.workspaces;
create trigger trg_set_workspace_account
  before insert on public.workspaces
  for each row execute function public.set_workspace_account();

alter table public.workspaces alter column account_id set not null;

-- ---------------------------------------------------------------------------
-- 8. Widen the workspaces plan_tier CHECK to the 5-tier ladder (it stays the derived
--    compat shim during the transition; the webhook moves to accounts in WM-M3).
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.workspaces drop constraint if exists workspaces_plan_tier_check;
  alter table public.workspaces
    add constraint workspaces_plan_tier_check
    check (plan_tier = any (array['free','pro','max','team','enterprise']));
end $$;

-- ---------------------------------------------------------------------------
-- 9. Memory decay: 14 -> 30 days, rolling off last_used_at, paid-list widened to all
--    paid slugs. Still gated behind memory_expiry_enabled() (= false), so zero live
--    effect; the INSERT-OR-UPDATE shape lets a recall touch (which moves last_used_at)
--    refresh the window when the engine is eventually enabled.
-- ---------------------------------------------------------------------------
create or replace function public.set_agent_memory_expiry()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_paid boolean;
begin
  if not public.memory_expiry_enabled() then return NEW; end if;
  -- service-role inserts that set an explicit expiry are honored (INSERT path only).
  if TG_OP = 'INSERT'
     and coalesce(auth.role(), '') = 'service_role'
     and NEW.expires_at is not null then
    return NEW;
  end if;
  -- on UPDATE, only recompute when a recall touch moved last_used_at (the rolling refresh).
  if TG_OP = 'UPDATE' and NEW.last_used_at is not distinct from OLD.last_used_at then
    return NEW;
  end if;
  select exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.user_id = NEW.user_id
      and w.plan_tier in ('pro', 'max', 'team', 'enterprise')
  ) into v_paid;
  if v_paid then
    NEW.expires_at := null;
  else
    NEW.expires_at := coalesce(NEW.last_used_at, NEW.created_at, now()) + interval '30 days';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_agent_memory_expiry on public.agent_memory;
create trigger trg_set_agent_memory_expiry
  before insert or update on public.agent_memory
  for each row execute function public.set_agent_memory_expiry();

-- ---------------------------------------------------------------------------
-- 10. is_account_member helper + RLS. Members read their account / members / credits /
--     ledger; all writes are service-role only (no write policies) except the billing
--     columns, which the protect trigger guards. SECURITY DEFINER avoids RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_account_member(account uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = account and m.user_id = auth.uid()
  );
$$;

alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.account_credits enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "account members read account" on public.accounts;
create policy "account members read account" on public.accounts
  for select using (public.is_account_member(id));

drop policy if exists "account members read membership" on public.account_members;
create policy "account members read membership" on public.account_members
  for select using (public.is_account_member(account_id));

drop policy if exists "account members read credits" on public.account_credits;
create policy "account members read credits" on public.account_credits
  for select using (public.is_account_member(account_id));

drop policy if exists "account members read ledger" on public.credit_ledger;
create policy "account members read ledger" on public.credit_ledger
  for select using (public.is_account_member(account_id));

-- ---------------------------------------------------------------------------
-- 11. Indexes for the lookups the app will run.
-- ---------------------------------------------------------------------------
create index if not exists accounts_owner_id_idx on public.accounts (owner_id);
create index if not exists account_members_user_id_idx on public.account_members (user_id);
create index if not exists workspaces_account_id_idx on public.workspaces (account_id);
create index if not exists credit_ledger_account_created_idx on public.credit_ledger (account_id, created_at desc);
create index if not exists credit_ledger_product_idx on public.credit_ledger (product_id);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id);

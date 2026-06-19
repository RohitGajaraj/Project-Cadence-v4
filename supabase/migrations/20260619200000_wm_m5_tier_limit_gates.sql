-- WM-M5: tier limit gates (product + workspace).
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-M5).
-- Enforce the entitlements caps (free vs paid) at product + workspace creation.
-- The client inserts products straight from the browser (AppShell), so a
-- server-only check is bypassable. The triggers here are the AUTHORITATIVE,
-- unbypassable guard; the server pre-check (src/lib/limits.functions.ts) is the
-- friendly path that throws a typed LimitReachedError before this ever fires.
--
-- The product cap is ACCOUNT-WIDE (products counted across all the account's
-- workspaces), so a paid user with pooled workspaces cannot dodge a cap by
-- spreading products across many workspaces. The FIRST workspace is never gated
-- (the count of existing workspaces is 0, below every cap >= 1), so onboarding
-- and ensure_user_default_workspace are unaffected.
--
-- Limit numbers MIRROR src/lib/entitlements.ts (limitFor) -- the single TS source
-- of truth. Keep tier_product_limit / tier_workspace_limit in sync with it:
--   product:   free 2 . pro 3 . max 5 . team/enterprise unlimited (null)
--   workspace: free 1 . every paid tier pooled/unlimited (null)
--
-- DORMANT by default: gated behind limit_gates_enabled() (= false), mirroring
-- credits_enabled() / memory_expiry_enabled(). The mechanism ships now; the
-- founder flips the flag once a live upgrade path (Stripe) exists, so a free user
-- is never capped without a way to upgrade. Until flipped, both triggers no-op
-- and behavior is byte-identical to today.
--
-- Depends on WM-M2 (accounts, accounts.plan_tier, workspaces.account_id) and the
-- B5 projects.archived_at column. Idempotent (OR REPLACE / DROP-then-CREATE).

-- ---------------------------------------------------------------------------
-- 1. Dormancy flag (mirror credits_enabled / memory_expiry_enabled).
-- ---------------------------------------------------------------------------
create or replace function public.limit_gates_enabled()
returns boolean
language sql
immutable
set search_path to 'public'
as $$ select false $$;

-- ---------------------------------------------------------------------------
-- 2. Pure tier -> limit functions (mirror entitlements.ts; null = unlimited).
-- ---------------------------------------------------------------------------
create or replace function public.tier_product_limit(_tier text)
returns int
language sql
immutable
set search_path to 'public'
as $$
  select case _tier
    when 'free' then 2
    when 'pro' then 3
    when 'max' then 5
    else null  -- team, enterprise, or unknown -> generous/unlimited
  end;
$$;

create or replace function public.tier_workspace_limit(_tier text)
returns int
language sql
immutable
set search_path to 'public'
as $$
  select case _tier
    when 'free' then 1
    else null  -- every paid tier -> pooled/unlimited
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. enforce_product_limit: BEFORE INSERT on projects. Resolve the owning
--    account + tier from the target workspace, count the account's active
--    (non-archived) products, block at/over the cap. Fail-open when the account
--    is unresolved (pre-backfill) so a legitimate create is never wrongly blocked.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account uuid;
  v_tier text;
  v_limit int;
  v_count bigint;
begin
  if not public.limit_gates_enabled() then
    return NEW;  -- dormant: no enforcement until the founder flips the flag.
  end if;

  select w.account_id into v_account
  from public.workspaces w
  where w.id = NEW.workspace_id;

  if v_account is null then
    return NEW;  -- unlinked/pre-backfill workspace: the account model is not live here.
  end if;

  select a.plan_tier into v_tier from public.accounts a where a.id = v_account;
  v_limit := public.tier_product_limit(coalesce(v_tier, 'free'));
  if v_limit is null then
    return NEW;  -- generous/unlimited tier.
  end if;

  select count(*) into v_count
  from public.projects p
  join public.workspaces w on w.id = p.workspace_id
  where w.account_id = v_account
    and p.archived_at is null;

  if v_count >= v_limit then
    raise exception
      'Product limit reached for this plan (% allowed). Upgrade your plan to add more products.', v_limit
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_product_limit on public.projects;
create trigger trg_enforce_product_limit
  before insert on public.projects
  for each row execute function public.enforce_product_limit();

-- ---------------------------------------------------------------------------
-- 4. enforce_workspace_limit: BEFORE INSERT on workspaces. Resolve the account
--    by NEW.account_id (set by trg_set_workspace_account) or by owner_id (robust
--    to BEFORE-trigger fire-order, which is alphabetical: enforce runs before
--    set_account, so NEW.account_id may still be null here). Count existing
--    workspaces, block at/over the cap. The first workspace is never gated
--    (existing count 0 < every cap >= 1); fail-open when no account exists yet.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account uuid;
  v_tier text;
  v_limit int;
  v_count bigint;
begin
  if not public.limit_gates_enabled() then
    return NEW;  -- dormant: no enforcement until the founder flips the flag.
  end if;

  v_account := coalesce(
    NEW.account_id,
    (select a.id from public.accounts a where a.owner_id = NEW.owner_id order by a.created_at limit 1)
  );

  if v_account is null then
    return NEW;  -- first workspace, account not provisioned yet: never gate it.
  end if;

  select a.plan_tier into v_tier from public.accounts a where a.id = v_account;
  v_limit := public.tier_workspace_limit(coalesce(v_tier, 'free'));
  if v_limit is null then
    return NEW;  -- pooled/unlimited tier.
  end if;

  select count(*) into v_count
  from public.workspaces w
  where w.account_id = v_account;

  if v_count >= v_limit then
    raise exception
      'Workspace limit reached for this plan (% allowed). Upgrade your plan for pooled workspaces.', v_limit
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_workspace_limit on public.workspaces;
create trigger trg_enforce_workspace_limit
  before insert on public.workspaces
  for each row execute function public.enforce_workspace_limit();

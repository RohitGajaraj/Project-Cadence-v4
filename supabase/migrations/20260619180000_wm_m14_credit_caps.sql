-- WM-M14: per-product / per-member credit caps (optional, owner-set spend ceilings).
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-M14).
-- The account credit pool (WM-M2) is shared. This lets an owner OPTIONALLY cap how many
-- credits a single PRODUCT or a single MEMBER may draw within a window, so one product or
-- member cannot drain the whole account pool. Enforcement lives in runtime.server.ts
-- (assertCreditCaps, called inside assertAccountCredits): it reads the enabled caps for the
-- call's account and sums the window's credit_ledger debits for that product/member, then
-- halts ONLY that scope while the account pool still has credits. The whole credit engine
-- stays dormant behind credits_enabled() until the founder flips it, so this table is inert
-- until then (and there are no caps until an owner sets one; the WM-M16 settings surface +
-- its owner-write policy land that path).
--
-- Also adds two composite credit_ledger indexes so the per-product / per-member window sums
-- (cap enforcement) AND the WM-M14 attribution rollup (computeCreditAttribution) stay
-- index-served: the WM-M2 (account_id, created_at) and (product_id) indexes do not cover
-- the scoped (account_id + dimension + time) access pattern.
--
-- Idempotent (CREATE ... IF NOT EXISTS / OR REPLACE). Depends on WM-M2 (accounts,
-- credit_ledger, is_account_member, set_updated_at). Service-role write only (no write
-- policy); members may READ their own account's caps via RLS.

-- 1. credit_caps: optional per-product / per-member ceilings on an account's pool.
create table if not exists public.credit_caps (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  scope text not null check (scope in ('product', 'member')),
  target_id uuid not null,
  cap_credits bigint not null check (cap_credits >= 0),
  window_kind text not null default 'cycle' check (window_kind in ('cycle', 'day', 'month')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, scope, target_id, window_kind)
);

-- One enabled cap lookup per call (cap enforcement) is by (account_id, scope, enabled).
create index if not exists credit_caps_account_scope_idx
  on public.credit_caps (account_id, scope, enabled);

-- Keep updated_at fresh via the shared set_updated_at trigger (defined before WM-M2).
drop trigger if exists trg_credit_caps_set_updated_at on public.credit_caps;
create trigger trg_credit_caps_set_updated_at
  before update on public.credit_caps
  for each row execute function public.set_updated_at();

-- 2. RLS: members read their account's caps; writes are service-role-only for now (the
--    owner-set write path + UI arrive with WM-M16, which adds the owner-write policy).
alter table public.credit_caps enable row level security;

drop policy if exists "account members read caps" on public.credit_caps;
create policy "account members read caps" on public.credit_caps
  for select using (public.is_account_member(account_id));

-- 3. Composite credit_ledger indexes for the scoped window sums (caps) + attribution
--    rollup. Both filter (account_id, <dimension>, created_at); the existing single-column
--    indexes do not serve that shape.
create index if not exists credit_ledger_account_user_created_idx
  on public.credit_ledger (account_id, user_id, created_at desc);

create index if not exists credit_ledger_account_product_created_idx
  on public.credit_ledger (account_id, product_id, created_at desc);

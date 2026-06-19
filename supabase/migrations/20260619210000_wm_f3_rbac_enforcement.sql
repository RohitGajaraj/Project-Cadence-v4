-- WM-F3: RBAC enforcement (owner/admin/member/viewer roles).
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F3).
-- Adds SECURITY DEFINER role-check helpers for workspace and account membership,
-- swaps domain RLS policies to role-keyed checks, and adds a trigger to prevent
-- accidental owner demotion. Roles: owner (billing/delete/transfer), admin
-- (members/create-delete workspace+product/approvals/brief+guardrails), member
-- (content/missions), viewer (read-only).
--
-- Idempotent: re-runnable (IF NOT EXISTS / OR REPLACE / DROP-then-CREATE guarded).

-- ---------------------------------------------------------------------------
-- 1. Widen workspace_members.role CHECK to support all 4 roles (was default-only).
-- ---------------------------------------------------------------------------
alter table public.workspace_members
drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
add constraint workspace_members_role_check
check (role = any (array['owner','admin','member','viewer']));

-- ---------------------------------------------------------------------------
-- 2. RBAC helper functions (SECURITY DEFINER, so auth context is not exposed).
-- ---------------------------------------------------------------------------

-- Check if the current user has any of the given roles in a workspace.
-- Returns true if the user is a member with one of the specified roles.
-- Gracefully returns false if not a member or on missing data.
create or replace function public.has_workspace_role(ws uuid, required_roles text[])
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
    and m.user_id = auth.uid()
    and m.role = any (required_roles)
  );
$$;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

-- Check if the current user has any of the given roles in an account.
-- Returns true if the user is a member with one of the specified roles.
-- Gracefully returns false if not a member or on missing data.
create or replace function public.has_account_role(account uuid, required_roles text[])
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = account
    and m.user_id = auth.uid()
    and m.role = any (required_roles)
  );
$$;
grant execute on function public.has_account_role(uuid, text[]) to authenticated;

-- Shorthand: is the current user the owner of a workspace?
create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select public.has_workspace_role(ws, array['owner']);
$$;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- Shorthand: can the current user manage this workspace (owner or admin)?
create or replace function public.can_manage_workspace(ws uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select public.has_workspace_role(ws, array['owner', 'admin']);
$$;
grant execute on function public.can_manage_workspace(uuid) to authenticated;

-- Shorthand: is the current user the owner of an account?
create or replace function public.is_account_owner(account uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select public.has_account_role(account, array['owner']);
$$;
grant execute on function public.is_account_owner(uuid) to authenticated;

-- Shorthand: can the current user manage this account (owner only)?
-- (Only account owners can manage billing/plan.)
create or replace function public.can_manage_account(account uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select public.has_account_role(account, array['owner']);
$$;
grant execute on function public.can_manage_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Prevent owner demotion trigger for workspace_members.
--    An owner cannot demote themself (or be demoted by a rogue admin) to a
--    lesser role, which would orphan workspace management.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_workspace_owner_demotion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ws_owner_id uuid;
begin
  -- Get the workspace owner.
  select w.owner_id into v_ws_owner_id from public.workspaces w where w.id = new.workspace_id;

  if v_ws_owner_id is null then
    return new; -- Workspace doesn't exist (will fail later in FK check).
  end if;

  -- If this row is for the workspace owner and the new role is not 'owner', block it.
  if new.user_id = v_ws_owner_id and new.role != 'owner' then
    raise exception 'The workspace owner cannot be demoted to a lesser role.';
  end if;

  return new;
end;
$$;

grant execute on function public.prevent_workspace_owner_demotion() to authenticated, service_role;

create trigger prevent_workspace_owner_demotion_trigger
before update on public.workspace_members
for each row
execute function public.prevent_workspace_owner_demotion();

-- ---------------------------------------------------------------------------
-- 4. Swap workspace write policies to role-based checks.
--
-- The old policy "ws owner manage" allowed auth.uid() = owner_id.
-- New policies grant write access based on role.
-- ---------------------------------------------------------------------------

-- Workspaces: owner or admin can manage.
drop policy if exists "ws owner manage" on public.workspaces;
create policy "ws owner admin manage" on public.workspaces
  for all
  using (public.has_workspace_role(id, array['owner', 'admin']))
  with check (public.has_workspace_role(id, array['owner', 'admin']));

-- Workspace members: only owner can manage.
drop policy if exists "owner manages members" on public.workspace_members;
create policy "owner manages members" on public.workspace_members
  for all
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Account-level RLS setup (enable RLS, create base policies).
-- ---------------------------------------------------------------------------

alter table public.account_members enable row level security;

-- Members can see their own account membership.
create policy if not exists "account members see own" on public.account_members
  for select
  using (user_id = auth.uid());

-- Account owner manages all members.
create policy if not exists "account owner manages members" on public.account_members
  for all
  using (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()));

alter table public.accounts enable row level security;

-- Account members can see the account.
create policy if not exists "account members read" on public.accounts
  for select
  using (exists (select 1 from public.account_members m where m.account_id = id and m.user_id = auth.uid()));

-- Only owner can update account (plan/billing).
create policy if not exists "account owner manage" on public.accounts
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


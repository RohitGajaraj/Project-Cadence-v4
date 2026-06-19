-- WM-F4: workspace ownership transfer (transactional, audited).
-- Build bible: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F4).
--
-- Today `leaveWorkspace` blocks the owner with "transfer it first", but no transfer exists.
-- This adds a transactional SECURITY DEFINER RPC that hands a workspace to another member:
-- it reassigns workspaces.owner_id, flips the workspace_members roles (new owner -> owner,
-- old owner -> admin), and writes a workspace_audit_log row, all atomically (the function
-- body is one transaction; either every write lands or none does).
--
-- ORDERING (load-bearing): the WM-F3 `prevent_workspace_owner_demotion` BEFORE-UPDATE trigger
-- blocks demoting the row whose user_id = workspaces.owner_id. So we reassign owner_id FIRST
-- (the new owner becomes the workspace owner), THEN demote the OLD owner's member row to
-- admin (it is no longer the owner, so the trigger allows it) and set the new owner's member
-- row to owner (allowed: it IS the owner now). WM-F3 (210000) applies before this (250000),
-- so the trigger is live when this RPC runs on publish.
--
-- SAFETY: only the current workspace owner may transfer (service-role, auth.uid() null, is
-- trusted for automated/admin transfers); the new owner must already be a workspace member;
-- a same-owner call is a no-op. Idempotent / additive / forward-only.

-- Append-only audit trail for workspace administrative actions (transfer, and future ones).
create table if not exists public.workspace_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workspace_audit_log_ws_idx
  on public.workspace_audit_log (workspace_id, created_at desc);

alter table public.workspace_audit_log enable row level security;
-- Members can read their own workspace's audit log; writes happen only through the
-- SECURITY DEFINER RPC below (no write policy = no direct client writes).
drop policy if exists "ws members read audit" on public.workspace_audit_log;
create policy "ws members read audit" on public.workspace_audit_log
  for select using (public.is_workspace_member(workspace_id));

create or replace function public.transfer_workspace_ownership(
  _workspace_id uuid,
  _new_owner_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current_owner uuid;
begin
  -- Lock the workspace row so a concurrent transfer cannot race the reassignment.
  select owner_id into v_current_owner from public.workspaces where id = _workspace_id for update;
  if not found then
    raise exception 'Workspace not found.';
  end if;

  -- Only the current workspace owner may transfer. auth.uid() is null under service-role
  -- (trusted: automated/admin path), so this gates authenticated callers only.
  if auth.uid() is not null and auth.uid() <> v_current_owner then
    raise exception 'Only the workspace owner can transfer ownership.';
  end if;

  -- No-op if transferring to the current owner.
  if _new_owner_id = v_current_owner then
    return;
  end if;

  -- The new owner must already be a member of the workspace.
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _new_owner_id
  ) then
    raise exception 'The new owner must be a member of the workspace.';
  end if;

  -- Reassign ownership FIRST (see ORDERING note above), then flip the member roles.
  update public.workspaces set owner_id = _new_owner_id where id = _workspace_id;
  update public.workspace_members set role = 'owner'
    where workspace_id = _workspace_id and user_id = _new_owner_id;
  update public.workspace_members set role = 'admin'
    where workspace_id = _workspace_id and user_id = v_current_owner;

  insert into public.workspace_audit_log (workspace_id, actor_id, action, detail)
  values (
    _workspace_id,
    coalesce(auth.uid(), v_current_owner),
    'ownership_transfer',
    jsonb_build_object('from', v_current_owner, 'to', _new_owner_id)
  );
end;
$$;

revoke execute on function public.transfer_workspace_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated, service_role;

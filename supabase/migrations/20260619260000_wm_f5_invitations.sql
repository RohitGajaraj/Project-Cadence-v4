-- WM-F5: workspace invitations (invite / accept / revoke), backend.
-- Build bible: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F5).
--
-- There is no invite flow today; membership is manual. This adds a workspace_invitations
-- table + a SECURITY DEFINER accept RPC so a not-yet-member can redeem a token. The invite
-- and management server fns are RLS-gated to workspace managers (owner/admin via WM-F3's
-- can_manage_workspace). The accept path CANNOT use membership RLS (the invitee is not a
-- member yet), so it goes through the definer RPC, which validates the token, binds it to
-- the invited email, and adds the membership atomically.
--
-- The accept UI (join route) + the Settings members UI are deferred to the one design pass
-- (founder ruling 2026-06-19): this migration + the server fns are the headless backend.
--
-- Depends on WM-M2 (accounts/workspaces) + WM-F3 (can_manage_workspace), both of which apply
-- before this (260000) on publish. Idempotent / additive / forward-only.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role = any (array['admin','member','viewer'])),
  token text not null unique default gen_random_uuid()::text,
  status text not null default 'pending' check (status = any (array['pending','accepted','revoked','expired'])),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists workspace_invitations_ws_idx on public.workspace_invitations (workspace_id, status);
create index if not exists workspace_invitations_token_idx on public.workspace_invitations (token);

alter table public.workspace_invitations enable row level security;
-- Only workspace managers (owner/admin) can read/create/revoke their workspace's invitations.
-- The invitee (not yet a member) has NO direct read; they redeem via the accept RPC below,
-- so a pending invitation never leaks workspace data to a non-member.
drop policy if exists "ws managers manage invitations" on public.workspace_invitations;
create policy "ws managers manage invitations" on public.workspace_invitations
  for all
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

-- Redeem an invitation token: validate (pending + unexpired), bind to the invited email,
-- add the membership with the invited role, mark accepted (single-use). SECURITY DEFINER
-- because the caller is not a workspace member yet, so membership RLS would block the read.
create or replace function public.accept_workspace_invitation(_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inv public.workspace_invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation.';
  end if;

  -- Lock the invitation row so two concurrent accepts cannot both redeem it.
  select * into v_inv from public.workspace_invitations where token = _token for update;
  if not found then
    raise exception 'Invitation not found.';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'This invitation is no longer valid.';
  end if;
  if v_inv.expires_at < now() then
    update public.workspace_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'This invitation has expired.';
  end if;

  -- Bind the token to the invited email: the signed-in user's email must match, so a
  -- leaked or forwarded token cannot be redeemed by a different account.
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null or lower(v_email) <> lower(v_inv.email) then
    raise exception 'This invitation was sent to a different email address.';
  end if;

  -- Add (or refresh) the membership with the invited role.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_inv.workspace_id, auth.uid(), v_inv.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  -- Single-use: flip to accepted so the token cannot be redeemed again.
  update public.workspace_invitations
    set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    where id = v_inv.id;

  return v_inv.workspace_id;
end;
$$;

revoke execute on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.accept_workspace_invitation(text) to authenticated, service_role;

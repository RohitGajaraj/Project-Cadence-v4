-- WM-F2: account-level memory pooling (paid).
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F2).
--
-- For paid accounts, agent memory should compound across all the account's workspaces,
-- enabling the decision-layer moat flywheel (the more workspaces, the deeper the memory).
-- Free accounts stay single-workspace.
--
-- Mechanism:
--   1. Add is_account_member(account_id, user_id) helper (SECURITY DEFINER) so recall RPCs
--      can check membership before pooling.
--   2. Rewrite match_agent_memory + recent_agent_reflections to take an optional for_account
--      parameter: if provided, span all workspaces in that account (after membership check);
--      otherwise use the current single-workspace logic with for_workspace.
--   3. Update memory.server.ts to pass for_account when pooling is desired; default unchanged.
--
-- Idempotent / additive / forward-only. Depends on WM-M2 (workspaces.account_id exists).
-- Backward compatible: callers that don't pass for_account get the same behavior.

-- Helper: is_account_member(account_id, user_id) → boolean.
-- Returns true if the user is a member of the account (as an account_member row).
-- Used by the pooled recall RPCs to gate access before spanning workspaces.
create or replace function public.is_account_member(account_id uuid, user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return exists(
    select 1 from public.account_members
    where account_members.account_id = $1
      and account_members.user_id = $2
  );
end;
$$;

-- Rewrite match_agent_memory to support account-level pooling.
-- Signature: match_agent_memory(vector, uuid, text, integer, uuid, uuid)
--   - query_embedding (vector)
--   - for_user (uuid)
--   - for_agent_slug (text)
--   - match_count (integer)
--   - for_workspace (uuid, optional, default null) — existing single-workspace param
--   - for_account (uuid, optional, default null) — NEW: if provided, pool across account's workspaces
--
-- Logic:
--   - If for_account is provided: check membership, then match across all workspaces in that account
--   - Else if for_workspace is provided: match only that workspace (existing behavior)
--   - Else: match null workspace_id rows (legacy global memory)
drop function if exists public.match_agent_memory(vector, uuid, text, integer, uuid);
drop function if exists public.match_agent_memory(vector, uuid, text, integer, uuid, uuid);

create or replace function public.match_agent_memory(
  query_embedding vector,
  for_user uuid,
  for_agent_slug text,
  match_count integer,
  for_workspace uuid default null,
  for_account uuid default null
)
returns table(id uuid, content text, similarity real)
language plpgsql
security definer
set search_path = 'public'
stable
as $$
begin
  -- Account-level pooling: if for_account is provided, span the account's workspaces.
  if for_account is not null then
    -- Check membership before pooling (safety check inside SECURITY DEFINER).
    if not public.is_account_member(for_account, for_user) then
      return; -- No rows; the user is not a member of this account.
    end if;
    return query
      select
        m.id,
        m.content,
        (m.embedding <=> query_embedding)::real as similarity
      from public.agent_memory m
      where m.user_id = for_user
        and m.agent_slug = for_agent_slug
        and m.workspace_id in (
          select id from public.workspaces where account_id = for_account
        )
      order by m.embedding <=> query_embedding
      limit match_count;
  else
    -- Existing single-workspace or null behavior.
    return query
      select
        m.id,
        m.content,
        (m.embedding <=> query_embedding)::real as similarity
      from public.agent_memory m
      where m.user_id = for_user
        and m.agent_slug = for_agent_slug
        and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null)
      order by m.embedding <=> query_embedding
      limit match_count;
  end if;
end;
$$;

-- Grant execute to the right roles.
revoke execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) from public, anon;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) to authenticated;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) to service_role;

-- Rewrite recent_agent_reflections to support account-level pooling (same pattern).
drop function if exists public.recent_agent_reflections(uuid, text, integer, uuid);
drop function if exists public.recent_agent_reflections(uuid, text, integer, uuid, uuid);

create or replace function public.recent_agent_reflections(
  for_user uuid,
  for_agent_slug text,
  match_count integer,
  for_workspace uuid default null,
  for_account uuid default null
)
returns table(id uuid, content text, created_at timestamp)
language plpgsql
security definer
set search_path = 'public'
stable
as $$
begin
  -- Account-level pooling.
  if for_account is not null then
    if not public.is_account_member(for_account, for_user) then
      return;
    end if;
    return query
      select
        r.id,
        r.content,
        r.created_at
      from public.agent_memory r
      where r.user_id = for_user
        and r.agent_slug = for_agent_slug
        and r.kind = 'reflection'
        and r.workspace_id in (
          select id from public.workspaces where account_id = for_account
        )
      order by r.created_at desc
      limit match_count;
  else
    -- Existing single-workspace or null behavior.
    return query
      select
        r.id,
        r.content,
        r.created_at
      from public.agent_memory r
      where r.user_id = for_user
        and r.agent_slug = for_agent_slug
        and r.kind = 'reflection'
        and (for_workspace is null or r.workspace_id = for_workspace or r.workspace_id is null)
      order by r.created_at desc
      limit match_count;
  end if;
end;
$$;

revoke execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) from public, anon;
grant execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) to authenticated;
grant execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) to service_role;

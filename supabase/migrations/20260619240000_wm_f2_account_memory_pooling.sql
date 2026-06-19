-- WM-F2: account-level memory pooling (paid tiers).
-- Build bible: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F2).
--
-- WM-F1 scoped recall to the ACTIVE workspace. For PAID accounts the moat object
-- (decision memory) should COMPOUND across all the account's workspaces (the
-- flywheel); free stays single-workspace (and a free account has one workspace, so
-- pooling there is a no-op anyway).
--
-- READ-SIDE ONLY: writes stay workspace-scoped (rememberOutcome still tags the active
-- workspace). This adds an OPTIONAL trailing for_account to the two recall RPCs. When
-- for_account is non-null the workspace filter spans that account's workspaces; when
-- null the recall is byte-identical to WM-F1 (single-workspace). The app
-- (memory.server.ts) passes for_account ONLY when the account's tier grants
-- crossWorkspaceMemory, so "which tiers pool" stays in entitlements.ts (the single
-- source of truth) and is never duplicated here.
--
-- SAFETY (no cross-account / cross-user leak) -- every WM-F1 invariant is preserved:
--   * m.user_id = coalesce(auth.uid(), for_user): recall returns ONLY the caller's own
--     memory, so even a spoofed for_account returns nothing of another user (their rows
--     carry a different user_id). This pin (added by WM-F1 to close a cross-user read on
--     these SECURITY DEFINER RPCs) is the core protection and MUST NOT be reverted to a
--     bare for_user.
--   * is_account_member(for_account) gates the pooled branch (defense in depth).
--   * the per-row is_workspace_member(m.workspace_id) guard is preserved.
--   * expiry (expires_at) + global-scope (scope='global') + embedding-not-null filters
--     are all preserved; recall must never surface expired or unembedded memory, and
--     global memory must stay recallable by every agent.
--   * service-role (auth.uid() null) stays trusted (the autonomous loop), so background
--     recall never goes dark.
--
-- is_account_member(uuid) already exists (WM-M2); it is reused, not redefined.
-- The RPC return shapes are kept identical to WM-F1 (id, content, kind, importance,
-- agent_slug, similarity / id, content, importance, metadata, created_at) so no caller
-- contract changes. Additive / forward-only / idempotent (architecture/data.md).

-- match_agent_memory: drop the WM-F1 5-arg signature, recreate with a trailing
-- for_account. A new arity would otherwise create a second overload + ambiguous calls.
drop function if exists public.match_agent_memory(vector, uuid, text, integer, uuid);
create or replace function public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text default null,
  match_count integer default 6,
  for_workspace uuid default null,
  for_account uuid default null
) returns table (
  id uuid, content text, kind text, importance integer,
  agent_slug text, similarity double precision
) language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) as similarity
  from public.agent_memory m
  where m.user_id = coalesce(auth.uid(), for_user)
    and m.embedding is not null
    and (m.expires_at is null or m.expires_at > now())
    and (
      -- WM-F2 pooled branch (paid): span all of the account's workspaces. The app sets
      -- for_account only when the tier grants crossWorkspaceMemory.
      (for_account is not null
        and (m.workspace_id is null
             or m.workspace_id in (select w.id from public.workspaces w where w.account_id = for_account)))
      -- WM-F1 single-workspace branch: byte-identical to before when for_account is null.
      or (for_account is null
        and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null))
    )
    and (for_account is null or auth.uid() is null or public.is_account_member(for_account))
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) from public, anon;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) to authenticated;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) to service_role;

-- recent_agent_reflections: same trailing for_account, same pooled/single branches.
drop function if exists public.recent_agent_reflections(uuid, text, integer, uuid);
create or replace function public.recent_agent_reflections(
  for_user uuid,
  for_agent_slug text,
  match_count integer default 5,
  for_workspace uuid default null,
  for_account uuid default null
) returns table (
  id uuid, content text, importance integer, metadata jsonb, created_at timestamptz
) language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.importance, m.metadata, m.created_at
  from public.agent_memory m
  where m.user_id = coalesce(auth.uid(), for_user)
    and m.kind = 'reflection'
    and (
      (for_account is not null
        and (m.workspace_id is null
             or m.workspace_id in (select w.id from public.workspaces w where w.account_id = for_account)))
      or (for_account is null
        and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null))
    )
    and (for_account is null or auth.uid() is null or public.is_account_member(for_account))
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.importance desc, m.created_at desc
  limit greatest(1, least(match_count, 20));
$$;
revoke execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) from public;
grant execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) to authenticated, service_role;

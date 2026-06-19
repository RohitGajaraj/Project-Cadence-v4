-- WM-F1 (core): scope agent memory recall to the workspace.
-- Build bible: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F1).
--
-- The moat object (decision memory) was user-scoped, one level above the boundary
-- the product sells. This adds workspace_id to the agent tables and rewrites the
-- recall RPCs so a multi-workspace user (and, later, a team) recalls only the
-- ACTIVE workspace's memory, not everything they have ever touched.
--
-- SCOPE OF THIS MIGRATION (the safe, additive core):
--   * adds a NULLABLE workspace_id to agents / agent_memory / agent_tools
--     (agent_runs + agent_approvals already carry it), with an FK + index;
--   * backfills every existing row to the owner's default workspace (creating one
--     for any orphan account via ensure_user_default_workspace, so no row is left
--     unscoped); deterministic for multi-workspace owners (earliest membership);
--   * rewrites match_agent_memory + recent_agent_reflections to take an OPTIONAL
--     trailing for_workspace and filter on it, preserving every prior predicate.
--
-- DELIBERATELY DEFERRED to WM-F1b (each needs a per-insert-site workspace_id audit
-- across the ~10 agent_memory write paths, several of which run under service-role):
--   NOT NULL on workspace_id, the RLS swap to membership-keyed policies, and the
--   agents UNIQUE(user_id,slug) -> UNIQUE(workspace_id,slug) swap. Forcing NOT NULL
--   now would break the service-role insert paths that omit workspace_id, and a
--   current_user_default_workspace() DEFAULT bridge ERRORS under service-role
--   (auth.uid() is null, so it would try to insert a null-owner workspace). The
--   column is intentionally NULLABLE and the recall filter treats a NULL
--   workspace_id as global (recallable everywhere) so nothing regresses.
--
-- Additive / forward-only / idempotent (architecture/data.md).

-- 1. Add workspace_id to the three tables that lack it (FK, nullable).
--    ON DELETE SET NULL (not cascade): deleting a workspace must NOT cascade-delete
--    agents (referenced by agent_runs.agent_id / agent_memory.agent_id) or the moat
--    memory; an orphaned row becomes global (workspace_id null), which recall allows.
alter table public.agents
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.agent_memory
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.agent_tools
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- 2. Backfill every row to the owner's default workspace. ensure_user_default_workspace
--    returns the user's earliest workspace, CREATING one if the user has none (the one
--    orphan account), so the backfill never leaves a null where a user_id exists.
--    Idempotent: only fills nulls, so re-applying this migration is a no-op.
update public.agents          set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_memory    set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_tools     set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_runs      set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_approvals set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;

-- 3. Index workspace_id for the recall filter + the future (WM-F1b) membership policies.
create index if not exists idx_agents_workspace         on public.agents (workspace_id);
create index if not exists idx_agent_memory_workspace    on public.agent_memory (workspace_id);
create index if not exists idx_agent_tools_workspace     on public.agent_tools (workspace_id);
create index if not exists idx_agent_runs_workspace      on public.agent_runs (workspace_id);
create index if not exists idx_agent_approvals_workspace on public.agent_approvals (workspace_id);

-- 4. Recall RPCs: add an OPTIONAL trailing for_workspace and filter on it.
--    DROP the exact old signatures first (a new arity would otherwise create a second
--    overload and ambiguous-call errors), then recreate.
--    Service-role safety: the autonomous loop calls these as service_role (auth.uid()
--    is null), so the membership guard is gated on `auth.uid() IS NULL` (trusted
--    service-role); an UNCONDITIONAL is_workspace_member() would return nothing under
--    service-role and SILENTLY break background recall. A NULL workspace_id is treated
--    as global so untagged rows stay recallable. Every prior predicate (user_id
--    COALESCE, embedding, expiry, agent_slug/global, kind='reflection') is preserved.

drop function if exists public.match_agent_memory(vector, uuid, text, integer);
create or replace function public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text default null,
  match_count integer default 6,
  for_workspace uuid default null
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
    and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null)
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_agent_memory(vector, uuid, text, integer, uuid) from public, anon;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid) to authenticated;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid) to service_role;

drop function if exists public.recent_agent_reflections(uuid, text, integer);
create or replace function public.recent_agent_reflections(
  for_user uuid,
  for_agent_slug text,
  match_count integer default 5,
  for_workspace uuid default null
) returns table (
  id uuid, content text, importance integer, metadata jsonb, created_at timestamptz
) language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.importance, m.metadata, m.created_at
  from public.agent_memory m
  -- Security: pin to the caller's own identity when authenticated (mirrors
  -- match_agent_memory). An authed caller cannot read another user's reflections
  -- by passing a crafted for_user; for_user only applies under service-role
  -- (auth.uid() null). Closes a pre-existing cross-user read on this RPC.
  where m.user_id = coalesce(auth.uid(), for_user)
    and m.kind = 'reflection'
    and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null)
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.importance desc, m.created_at desc
  limit greatest(1, least(match_count, 20));
$$;
revoke execute on function public.recent_agent_reflections(uuid, text, integer, uuid) from public;
grant execute on function public.recent_agent_reflections(uuid, text, integer, uuid) to authenticated, service_role;

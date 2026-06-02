-- Tenancy retrofit A/3 — scaffolding (workspaces + membership + helper) and seed.
-- Design: docs/decisions/tenancy-retrofit.md. Implements feature-backlog 0.1 (FND-TENANCY).
-- Forward-only/additive (architecture/data.md). Safe to apply alone: adds tables only,
-- touches no existing table, so the running app and Lovable keep working.

-- 1. workspaces — top-level tenancy boundary.
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. workspace_members — membership backs all RLS (RBAC-ready: more rows, no migration).
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',            -- owner|admin|member|viewer (enforced later, A6)
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_workspace_members_user on public.workspace_members (user_id);
create index if not exists idx_workspace_members_ws   on public.workspace_members (workspace_id);

-- 3. Membership helper. SECURITY DEFINER ⇒ bypasses RLS on workspace_members ⇒ no policy
--    recursion when other tables' policies call it.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- 4. Default-workspace resolver — used as a column DEFAULT bridge in migration C so existing
--    app/Lovable inserts that omit workspace_id still succeed. Explicit-set is the intended
--    path once request context plumbing (tenancy-retrofit.md O2) lands.
create or replace function public.current_user_default_workspace()
returns uuid
language sql security definer stable
set search_path = public as $$
  select m.workspace_id from public.workspace_members m
  where m.user_id = auth.uid()
  order by m.created_at
  limit 1;
$$;

-- 5. RLS for the new tables.
alter table public.workspaces enable row level security;
drop policy if exists "ws members read" on public.workspaces;
create policy "ws members read" on public.workspaces
  for select using (public.is_workspace_member(id));
drop policy if exists "ws owner manage" on public.workspaces;
create policy "ws owner manage" on public.workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.workspace_members enable row level security;
-- NOTE: workspace_members policies must NOT call is_workspace_member() (recursion). Direct checks only.
drop policy if exists "see own membership" on public.workspace_members;
create policy "see own membership" on public.workspace_members
  for select using (user_id = auth.uid());
drop policy if exists "owner manages members" on public.workspace_members;
create policy "owner manages members" on public.workspace_members
  for all using (exists (select 1 from public.workspaces w
                         where w.id = workspace_id and w.owner_id = auth.uid()))
        with check (exists (select 1 from public.workspaces w
                            where w.id = workspace_id and w.owner_id = auth.uid()));

-- 6. Grants (match repo convention).
grant select, insert, update, delete on public.workspaces        to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspaces        to service_role;
grant all on public.workspace_members to service_role;
grant execute on function public.is_workspace_member(uuid)            to authenticated;
grant execute on function public.current_user_default_workspace()     to authenticated;

-- 7. Seed: one workspace per existing profile + owner membership (idempotent).
insert into public.workspaces (owner_id, name)
select p.id, 'My Workspace'
from public.profiles p
where not exists (select 1 from public.workspaces w where w.owner_id = p.id);

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_id
);

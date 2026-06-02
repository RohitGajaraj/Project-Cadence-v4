
-- A: workspaces + workspace_members + helpers
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;
create index idx_workspace_members_user on public.workspace_members (user_id);
create index idx_workspace_members_ws on public.workspace_members (workspace_id);

create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path to 'public' as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create or replace function public.current_user_default_workspace()
returns uuid language sql security definer stable set search_path to 'public' as $$
  select m.workspace_id from public.workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1;
$$;
grant execute on function public.current_user_default_workspace() to authenticated;

alter table public.workspaces enable row level security;
create policy "ws members read" on public.workspaces for select using (public.is_workspace_member(id));
create policy "ws owner manage" on public.workspaces for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.workspace_members enable row level security;
create policy "see own membership" on public.workspace_members for select using (user_id = auth.uid());
create policy "owner manages members" on public.workspace_members for all
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- Seed: one workspace per existing profile + owner membership
insert into public.workspaces (owner_id, name)
select p.id, 'My Workspace' from public.profiles p
where not exists (select 1 from public.workspaces w where w.owner_id = p.id);
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner' from public.workspaces w
where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = w.owner_id);

-- B: add workspace_id/product_id, backfill, FKs, indexes
do $$
declare
  ws_tables text[] := array[
    'projects','signals','themes','opportunities','prds','docs','doc_versions','tasks',
    'decisions','artifact_lineage','rag_chunks','ai_events','ai_evals','ai_feedback',
    'guardrail_hits','tool_calls','prompt_runs','ai_budgets','ai_surface_budgets',
    'ai_budget_alerts','conversations','messages'
  ];
  prod_tables text[] := array[
    'signals','themes','opportunities','prds','docs','tasks','decisions','conversations',
    'rag_chunks','ai_events'
  ];
  prod_backfill text[] := array[
    'signals','themes','opportunities','prds','docs','tasks','decisions','conversations'
  ];
  t text;
begin
  foreach t in array ws_tables loop
    execute format('alter table public.%I add column if not exists workspace_id uuid', t);
  end loop;
  foreach t in array prod_tables loop
    execute format('alter table public.%I add column if not exists product_id uuid', t);
  end loop;
  foreach t in array ws_tables loop
    execute format('update public.%I tbl set workspace_id = w.id from public.workspaces w where w.owner_id = tbl.user_id and tbl.workspace_id is null', t);
  end loop;
  foreach t in array prod_backfill loop
    execute format('update public.%I set product_id = project_id where product_id is null and project_id is not null', t);
  end loop;
  foreach t in array ws_tables loop
    execute format('alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces(id) on delete restrict', t, t || '_workspace_id_fkey');
  end loop;
  foreach t in array prod_tables loop
    execute format('alter table public.%I add constraint %I foreign key (product_id) references public.projects(id) on delete set null', t, t || '_product_id_fkey');
  end loop;
  foreach t in array ws_tables loop
    execute format('create index if not exists %I on public.%I (workspace_id)', 'idx_' || t || '_workspace_id', t);
  end loop;
  foreach t in array prod_tables loop
    execute format('create index if not exists %I on public.%I (workspace_id, product_id)', 'idx_' || t || '_ws_product', t);
  end loop;
end $$;

-- C: assert backfill, default bridge, NOT NULL, membership policies
do $$
declare
  ws_tables text[] := array[
    'projects','signals','themes','opportunities','prds','docs','doc_versions','tasks',
    'decisions','artifact_lineage','rag_chunks','ai_events','ai_evals','ai_feedback',
    'guardrail_hits','tool_calls','prompt_runs','ai_budgets','ai_surface_budgets',
    'ai_budget_alerts','conversations','messages'
  ];
  t text;
  n bigint;
begin
  foreach t in array ws_tables loop
    execute format('select count(*) from public.%I where workspace_id is null', t) into n;
    if n > 0 then raise exception 'Tenancy backfill incomplete: public.% has % rows with null workspace_id', t, n; end if;
  end loop;
  foreach t in array ws_tables loop
    execute format('alter table public.%I alter column workspace_id set default public.current_user_default_workspace()', t);
    execute format('alter table public.%I alter column workspace_id set not null', t);
  end loop;
  foreach t in array ws_tables loop
    execute format('drop policy if exists %I on public.%I', 'own ' || t || ' all', t);
    execute format('create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))', t || ' ws read', t);
    execute format('create policy %I on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))', t || ' ws write', t);
  end loop;
end $$;

-- Re-scope RAG match functions to workspace + product
drop function if exists public.match_rag_chunks(vector, uuid, integer, text[]);
drop function if exists public.match_signals(vector, integer, uuid);

create or replace function public.match_rag_chunks(
  query_embedding vector, for_user uuid, match_count integer default 8,
  source_kinds text[] default null, for_product uuid default null
)
returns table(id uuid, source_kind text, source_id uuid, title text, content text,
              chunk_index integer, metadata jsonb, similarity double precision)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.source_kind, c.source_id, c.title, c.content, c.chunk_index, c.metadata,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_chunks c
  where c.user_id = auth.uid()
    and public.is_workspace_member(c.workspace_id)
    and (for_product is null or c.product_id = for_product)
    and c.embedding is not null
    and (source_kinds is null or c.source_kind = any(source_kinds))
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_signals(
  query_embedding vector, match_count integer default 8,
  for_user uuid default null, for_product uuid default null
)
returns table(id uuid, content text, title text, similarity double precision)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.content, s.title, 1 - (s.embedding <=> query_embedding) as similarity
  from public.signals s
  where s.user_id = auth.uid()
    and public.is_workspace_member(s.workspace_id)
    and (for_product is null or s.product_id = for_product)
    and s.embedding is not null
  order by s.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_rag_chunks(vector, uuid, integer, text[], uuid) from public, anon;
revoke execute on function public.match_signals(vector, integer, uuid, uuid) from public, anon;
grant execute on function public.match_rag_chunks(vector, uuid, integer, text[], uuid) to authenticated;
grant execute on function public.match_signals(vector, integer, uuid, uuid) to authenticated;

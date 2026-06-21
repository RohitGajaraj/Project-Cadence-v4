-- ============ DATA-RETENTION-b: right-to-erasure (dormant) ============
create or replace function public.right_to_erasure_enabled()
returns boolean language sql immutable set search_path to 'public'
as $$ select false $$;

create or replace function public._erasure_delete_by_column(_col text, _id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  _remaining text[]; _next text[]; _t text; _deleted bigint;
  _total jsonb := '{}'::jsonb; _iter int := 0; _progress boolean;
begin
  if not public.right_to_erasure_enabled() then
    return jsonb_build_object('skipped', 'dormant');
  end if;
  if _col not in ('workspace_id', 'account_id') then
    raise exception 'erasure: refusing to delete by non-tenant column %', _col;
  end if;
  select coalesce(array_agg(c.table_name), '{}') into _remaining
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.column_name = _col;
  if array_length(_remaining, 1) is null then return _total; end if;
  loop
    _iter := _iter + 1; _progress := false; _next := '{}';
    foreach _t in array _remaining loop
      begin
        execute format('delete from public.%I where %I = $1', _t, _col) using _id;
        get diagnostics _deleted = row_count;
        if _deleted > 0 then
          _total := _total || jsonb_build_object(_t, coalesce((_total ->> _t)::bigint, 0) + _deleted);
        end if;
        _progress := true;
      exception when foreign_key_violation then
        _next := array_append(_next, _t);
      end;
    end loop;
    _remaining := _next;
    exit when array_length(_remaining, 1) is null;
    exit when not _progress;
    exit when _iter >= 25;
  end loop;
  if array_length(_remaining, 1) is not null then
    raise exception 'erasure could not clear tables % for %=%', _remaining, _col, _id;
  end if;
  return _total;
end;
$$;

create or replace function public.forget_workspace(_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare _counts jsonb; _ws bigint := 0;
begin
  if not public.right_to_erasure_enabled() then return jsonb_build_object('skipped', 'dormant'); end if;
  if _workspace_id is null then raise exception 'forget_workspace: a workspace id is required'; end if;
  _counts := public._erasure_delete_by_column('workspace_id', _workspace_id);
  delete from public.workspaces where id = _workspace_id;
  get diagnostics _ws = row_count;
  return jsonb_build_object('workspace_id', _workspace_id, 'tables', _counts, 'workspaces', _ws);
end;
$$;

create or replace function public.forget_account(_account_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare _ws_ids uuid[]; _wid uuid; _per jsonb := '[]'::jsonb; _acct_tables jsonb; _acct bigint := 0;
begin
  if not public.right_to_erasure_enabled() then return jsonb_build_object('skipped', 'dormant'); end if;
  if _account_id is null then raise exception 'forget_account: an account id is required'; end if;
  select coalesce(array_agg(id), '{}') into _ws_ids from public.workspaces where account_id = _account_id;
  foreach _wid in array _ws_ids loop
    _per := _per || jsonb_build_array(public.forget_workspace(_wid));
  end loop;
  _acct_tables := public._erasure_delete_by_column('account_id', _account_id);
  delete from public.accounts where id = _account_id;
  get diagnostics _acct = row_count;
  return jsonb_build_object('account_id', _account_id, 'workspaces', _per, 'account_tables', _acct_tables, 'accounts', _acct);
end;
$$;

create or replace function public.erasure_residue(_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare _t text; _n bigint; _out jsonb := '{}'::jsonb;
begin
  for _t in
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'workspace_id'
  loop
    execute format('select count(*) from public.%I where workspace_id = $1', _t) into _n using _workspace_id;
    if _n > 0 then _out := _out || jsonb_build_object(_t, _n); end if;
  end loop;
  return _out;
end;
$$;

revoke all on function public.right_to_erasure_enabled() from public;
revoke all on function public._erasure_delete_by_column(text, uuid) from public;
revoke all on function public.forget_workspace(uuid) from public;
revoke all on function public.forget_account(uuid) from public;
revoke all on function public.erasure_residue(uuid) from public;
grant execute on function public.right_to_erasure_enabled() to service_role;
grant execute on function public._erasure_delete_by_column(text, uuid) to service_role;
grant execute on function public.forget_workspace(uuid) to service_role;
grant execute on function public.forget_account(uuid) to service_role;
grant execute on function public.erasure_residue(uuid) to service_role;

-- ============ H2-AUDIT: roadmap audit trail ============
create table if not exists public.roadmap_audit (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  workspace_id uuid,
  action text not null check (action in ('move', 'commit')),
  from_bucket text check (from_bucket in ('now', 'next', 'later')),
  to_bucket text check (to_bucket in ('now', 'next', 'later')),
  outcome text,
  measure text,
  created_at timestamptz not null default now()
);

grant select, insert on public.roadmap_audit to authenticated;
grant all on public.roadmap_audit to service_role;

alter table public.roadmap_audit enable row level security;

drop policy if exists "roadmap_audit insert own" on public.roadmap_audit;
create policy "roadmap_audit insert own"
  on public.roadmap_audit for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "roadmap_audit read own or workspace" on public.roadmap_audit;
create policy "roadmap_audit read own or workspace"
  on public.roadmap_audit for select to authenticated
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create index if not exists roadmap_audit_opportunity_created_idx
  on public.roadmap_audit (opportunity_id, created_at desc);
create index if not exists roadmap_audit_workspace_created_idx
  on public.roadmap_audit (workspace_id, created_at desc);

-- ============ DBR-1.5: bi-temporal columns on artifact_lineage ============
alter table public.artifact_lineage
  add column if not exists valid_to timestamptz,
  add column if not exists invalidated_by uuid,
  add column if not exists inference jsonb;

comment on column public.artifact_lineage.valid_to is
  'Bi-temporal: when this edge''s belief stopped being true. NULL = currently valid.';
comment on column public.artifact_lineage.invalidated_by is
  'The learnings/lineage row whose recorded outcome retired this edge.';
comment on column public.artifact_lineage.inference is
  'Provenance for an engine-inferred edge: {verdict, score, source, ai_event_id}.';

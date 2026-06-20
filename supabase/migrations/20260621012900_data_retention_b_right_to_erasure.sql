-- DATA-RETENTION-b - right-to-be-forgotten erase cascade (GDPR/CCPA Art. 17).
--
-- DATA-RETENTION (20260620000000) shipped the TIME-BASED purge of high-volume AI
-- telemetry. Its header named this follow-up: "The right-to-be-forgotten delete
-- cascade (per-account/workspace erase) is a separate, policy-coupled follow-up
-- (DATA-RETENTION-b)". This is that piece: erase ALL of a tenant's data on a
-- verified erasure request, where the tenant unit is a workspace (and an account
-- = every workspace under it + the account-scoped billing/credit rows).
--
-- WHY A NAIVE `delete from workspaces where id = X` IS WRONG (verified on the live
-- schema, 2026-06-21): of the 61 tables carrying `workspace_id`, the FK to
-- `workspaces` is ON DELETE CASCADE on 22, RESTRICT/NO ACTION on 22, and SET NULL
-- on 6. A bare parent delete would (a) be BLOCKED by the 22 RESTRICT children
-- (foreign_key_violation), and (b) merely NULL the 6 SET NULL tables - which
-- include the agent-moat memory (`agent_memory`/`agents`/`agent_runs`/
-- `agent_tools`/`agent_run_checkpoints`) and `idempotency_keys` - leaving the data
-- in place but unlinked, the worst possible erasure outcome. True erasure must
-- delete every tenant row explicitly, child-first.
--
-- DESIGN - a dynamic, FK-order-agnostic, single-tenant delete:
--   `_erasure_delete_by_column(_col, _id)` lists every public BASE TABLE carrying
--   the tenant column from `information_schema` (so it auto-covers all 61 today and
--   any table added later - no hand-list to rot), then deletes
--   `delete from <table> where <col> = $1` from each, retrying tables that raise
--   foreign_key_violation on a later pass until none remain. The fixed-point loop
--   resolves FK ordering with no hand-maintained topological sort. It is bounded
--   (max passes + a no-progress exit) and RAISES if anything cannot be cleared, so
--   it can never silently leave data behind.
--
-- SAFETY (why this destructive dynamic DML is sound):
--   * Single-tenant by construction: every delete is `where <col> = $1` with the
--     tenant id bound as a PARAMETER, AND _col is whitelisted to a real tenant
--     column (workspace_id | account_id) so a typo/buggy caller can never widen the
--     delete to e.g. user_id; it can never touch another tenant's rows.
--   * Table names come ONLY from the catalog and are quote_ident()'d - no SQL
--     injection surface (no user-supplied identifiers).
--   * The destructive primitive ALSO self-gates on the dormant flag (not only the
--     forget_* wrappers), so a direct service-role call is inert while dormant too.
--   * Ships INERT: `right_to_erasure_enabled()` returns false (mirrors
--     `data_retention_enabled()`/`credits_enabled()`), so `forget_*` are strict
--     no-ops until the founder/operator flips the flag.
--   * Execute is locked to `service_role` only (stricter than plain SECURITY
--     DEFINER) - no authenticated user can erase a tenant. Right-to-be-forgotten
--     is an operator/DPO action behind identity verification, not self-serve.
--
-- Additive / forward-only / idempotent (create or replace). Depends only on the
-- live schema (the WM tenancy columns are already applied). The actual erase runs
-- only when the flag is flipped and an operator calls forget_workspace/account.

-- Dormant flag. Flip to `select true` (or repoint at a settings row) to activate.
create or replace function public.right_to_erasure_enabled()
returns boolean
language sql
immutable
set search_path to 'public'
as $$ select false $$;

-- Internal: delete every public-table row whose tenant column = the given id,
-- FK-order-agnostically. Returns a jsonb map of {table: rows_deleted} (omitting
-- tables that had no matching rows). RAISES if a table cannot be cleared.
create or replace function public._erasure_delete_by_column(_col text, _id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _remaining text[];
  _next text[];
  _t text;
  _deleted bigint;
  _total jsonb := '{}'::jsonb;
  _iter int := 0;
  _progress boolean;
begin
  -- Defense-in-depth: the destructive primitive self-gates too, so "Ships INERT"
  -- holds even for a direct service-role caller, not only the forget_* entry points.
  if not public.right_to_erasure_enabled() then
    return jsonb_build_object('skipped', 'dormant');
  end if;

  -- Single-tenant-by-construction is only TRUE if _col is a real tenant column.
  -- _col is interpolated (quote_ident) into `where %I = $1`, so a typo or a
  -- compromised/buggy caller passing e.g. 'user_id' would delete rows across every
  -- workspace a user touches (SECURITY DEFINER bypasses RLS). Whitelist it.
  if _col not in ('workspace_id', 'account_id') then
    raise exception 'erasure: refusing to delete by non-tenant column %', _col;
  end if;

  -- All public BASE TABLES carrying the tenant column (views/foreign tables excluded).
  select coalesce(array_agg(c.table_name), '{}')
    into _remaining
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name  = c.table_name
   and t.table_type  = 'BASE TABLE'
  where c.table_schema = 'public'
    and c.column_name  = _col;

  if array_length(_remaining, 1) is null then
    return _total;
  end if;

  -- Fixed-point: each pass deletes from every table that does not raise a FK
  -- violation; tables that still have dependents are retried next pass. Each pass
  -- clears >= 1 table or we exit (no-progress / bound), then raise if any remain.
  loop
    _iter := _iter + 1;
    _progress := false;
    _next := '{}';
    foreach _t in array _remaining loop
      begin
        execute format('delete from public.%I where %I = $1', _t, _col) using _id;
        get diagnostics _deleted = row_count;
        if _deleted > 0 then
          _total := _total || jsonb_build_object(_t, coalesce((_total ->> _t)::bigint, 0) + _deleted);
        end if;
        _progress := true;  -- cleared (or already empty) this table
      exception when foreign_key_violation then
        _next := array_append(_next, _t);  -- still has dependents; retry
      end;
    end loop;
    _remaining := _next;
    exit when array_length(_remaining, 1) is null;  -- everything cleared
    exit when not _progress;                          -- stuck (dependent outside our set)
    exit when _iter >= 25;                            -- safety bound (FK depth << 25)
  end loop;

  if array_length(_remaining, 1) is not null then
    raise exception 'erasure could not clear tables % for %=%', _remaining, _col, _id;
  end if;

  return _total;
end;
$$;

-- Erase one workspace: all `workspace_id` rows (incl. the SET-NULL agent moat and
-- the RESTRICT children), then the workspace row itself. Strict no-op while dormant.
create or replace function public.forget_workspace(_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _counts jsonb;
  _ws bigint := 0;
begin
  if not public.right_to_erasure_enabled() then
    return jsonb_build_object('skipped', 'dormant');
  end if;
  if _workspace_id is null then
    raise exception 'forget_workspace: a workspace id is required';
  end if;

  _counts := public._erasure_delete_by_column('workspace_id', _workspace_id);

  -- The workspace row is now unblocked (all workspace_id children gone).
  delete from public.workspaces where id = _workspace_id;
  get diagnostics _ws = row_count;

  return jsonb_build_object(
    'workspace_id', _workspace_id,
    'tables', _counts,
    'workspaces', _ws
  );
end;
$$;

-- Erase a whole account: forget every workspace under it, then the account-scoped
-- rows (credits/ledger/members/any `account_id` table) and the account row.
create or replace function public.forget_account(_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _ws_ids uuid[];
  _wid uuid;
  _per jsonb := '[]'::jsonb;
  _acct_tables jsonb;
  _acct bigint := 0;
begin
  if not public.right_to_erasure_enabled() then
    return jsonb_build_object('skipped', 'dormant');
  end if;
  if _account_id is null then
    raise exception 'forget_account: an account id is required';
  end if;

  -- Snapshot the workspace ids first, then erase each (forget_workspace deletes
  -- the workspaces rows, so iterate over the captured array, not a live cursor).
  select coalesce(array_agg(id), '{}') into _ws_ids
  from public.workspaces where account_id = _account_id;

  foreach _wid in array _ws_ids loop
    _per := _per || jsonb_build_array(public.forget_workspace(_wid));
  end loop;

  -- Account-scoped tables (account_credits / credit_ledger / account_members / any
  -- other account_id-bearing table); workspaces rows are already gone (no-op there).
  _acct_tables := public._erasure_delete_by_column('account_id', _account_id);

  delete from public.accounts where id = _account_id;
  get diagnostics _acct = row_count;

  return jsonb_build_object(
    'account_id', _account_id,
    'workspaces', _per,
    'account_tables', _acct_tables,
    'accounts', _acct
  );
end;
$$;

-- Read-only verification: counts of any rows still carrying a given workspace_id
-- across every table (drift-proof; `{}` means fully erased). For an operator/dry-run
-- to confirm an erase left zero residue, including in any table added after this.
create or replace function public.erasure_residue(_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _t text;
  _n bigint;
  _out jsonb := '{}'::jsonb;
begin
  for _t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name  = c.table_name
     and t.table_type  = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name  = 'workspace_id'
  loop
    execute format('select count(*) from public.%I where workspace_id = $1', _t)
      into _n using _workspace_id;
    if _n > 0 then
      _out := _out || jsonb_build_object(_t, _n);
    end if;
  end loop;
  return _out;
end;
$$;

-- Destructive functions: service-role only (operator/DPO path, not self-serve).
revoke all on function public._erasure_delete_by_column(text, uuid) from public, anon, authenticated;
revoke all on function public.forget_workspace(uuid) from public, anon, authenticated;
revoke all on function public.forget_account(uuid) from public, anon, authenticated;
revoke all on function public.erasure_residue(uuid) from public, anon, authenticated;
grant execute on function public._erasure_delete_by_column(text, uuid) to service_role;
grant execute on function public.forget_workspace(uuid) to service_role;
grant execute on function public.forget_account(uuid) to service_role;
grant execute on function public.erasure_residue(uuid) to service_role;

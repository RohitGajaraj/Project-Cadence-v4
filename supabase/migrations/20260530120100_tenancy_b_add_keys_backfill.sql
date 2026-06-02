-- Tenancy retrofit B/3 — add workspace_id/product_id (NULLABLE), backfill, FK + indexes.
-- Design: docs/decisions/tenancy-retrofit.md. Depends on migration A.
-- Safe to apply with A: columns are nullable and not yet enforced by policies, so the
-- running app and Lovable keep working unchanged. Tightening happens in migration C.
--
-- Scope (NOW set; later-epic tables get keys when their epic is built):
--   workspace_id on 22 tables; product_id on 10; product_id backfilled from existing
--   project_id on the 8 first-slice tables that have it. profiles stays user-identity (no keys).

do $$
declare
  -- All NOW tables that receive workspace_id.
  ws_tables text[] := array[
    'projects','signals','themes','opportunities','prds','docs','doc_versions','tasks',
    'decisions','artifact_lineage','rag_chunks','ai_events','ai_evals','ai_feedback',
    'guardrail_hits','tool_calls','prompt_runs','ai_budgets','ai_surface_budgets',
    'ai_budget_alerts','conversations','messages'
  ];
  -- Tables that receive product_id (projects excluded — it IS the product).
  prod_tables text[] := array[
    'signals','themes','opportunities','prds','docs','tasks','decisions','conversations',
    'rag_chunks','ai_events'
  ];
  -- product_id backfilled directly from an existing nullable project_id column.
  prod_backfill text[] := array[
    'signals','themes','opportunities','prds','docs','tasks','decisions','conversations'
  ];
  t text;
begin
  -- 1. Add nullable workspace_id everywhere in the NOW set.
  foreach t in array ws_tables loop
    execute format('alter table public.%I add column if not exists workspace_id uuid', t);
  end loop;

  -- 2. Add nullable product_id where applicable.
  foreach t in array prod_tables loop
    execute format('alter table public.%I add column if not exists product_id uuid', t);
  end loop;

  -- 3. Backfill workspace_id via owner→workspace (every row has user_id NOT NULL; one ws/user).
  foreach t in array ws_tables loop
    execute format(
      'update public.%I tbl set workspace_id = w.id
         from public.workspaces w
        where w.owner_id = tbl.user_id and tbl.workspace_id is null', t);
  end loop;

  -- 4. Backfill product_id = existing project_id (only where that column exists).
  foreach t in array prod_backfill loop
    execute format(
      'update public.%I set product_id = project_id
        where product_id is null and project_id is not null', t);
  end loop;

  -- 5. Foreign keys (added now that values are backfilled; nullable still ok).
  foreach t in array ws_tables loop
    execute format(
      'alter table public.%I add constraint %I
         foreign key (workspace_id) references public.workspaces(id) on delete restrict',
      t, t || '_workspace_id_fkey');
  end loop;
  foreach t in array prod_tables loop
    execute format(
      'alter table public.%I add constraint %I
         foreign key (product_id) references public.projects(id) on delete set null',
      t, t || '_product_id_fkey');
  end loop;

  -- 6. Indexes for policy + lookup performance.
  foreach t in array ws_tables loop
    execute format('create index if not exists %I on public.%I (workspace_id)',
      'idx_' || t || '_workspace_id', t);
  end loop;
  foreach t in array prod_tables loop
    execute format('create index if not exists %I on public.%I (workspace_id, product_id)',
      'idx_' || t || '_ws_product', t);
  end loop;
end $$;

-- Tenancy retrofit C/3 — assert backfill, add default bridge, NOT NULL, swap RLS to membership,
-- and workspace/product-scope the RAG match functions.
-- Design: docs/decisions/tenancy-retrofit.md. Depends on migrations A and B.
--
-- COORDINATION: applying C flips RLS to membership-keyed and makes workspace_id NOT NULL.
-- Inserts that omit workspace_id are bridged by the current_user_default_workspace() DEFAULT
-- (added below), so the existing app/Lovable keep working. Once request-context plumbing
-- (tenancy-retrofit.md O2) lands, set workspace_id + product_id explicitly in server functions.

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
  -- 1. Assert backfill is complete — fail loudly rather than silently NOT-NULL bad data.
  foreach t in array ws_tables loop
    execute format('select count(*) from public.%I where workspace_id is null', t) into n;
    if n > 0 then
      raise exception 'Tenancy backfill incomplete: public.% has % rows with null workspace_id', t, n;
    end if;
  end loop;

  -- 2. Default bridge + NOT NULL.
  foreach t in array ws_tables loop
    execute format(
      'alter table public.%I alter column workspace_id set default public.current_user_default_workspace()', t);
    execute format('alter table public.%I alter column workspace_id set not null', t);
  end loop;

  -- 3. Swap RLS: drop the user_id-only "own <t> all" policy, add membership-keyed read+write.
  foreach t in array ws_tables loop
    execute format('drop policy if exists %I on public.%I', 'own ' || t || ' all', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))',
      t || ' ws read', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
      t || ' ws write', t);
  end loop;
end $$;

-- 4. Workspace/product-scope the RAG match functions (was: user_id only → cross-product leak).
--    Backward-compatible: new trailing `for_product` param defaults NULL (current behavior).
--    Pass for_product once context plumbing lands to get product-level isolation.
--    DROP the exact old signatures first: adding a param would otherwise create a second
--    overload (ambiguity) instead of replacing. Then re-apply the FROM-public/anon hardening
--    that migration 20260523210403 established.
drop function if exists public.match_rag_chunks(vector, uuid, integer, text[]);
drop function if exists public.match_signals(vector, integer, uuid);

create or replace function public.match_rag_chunks(
  query_embedding vector,
  for_user uuid,
  match_count integer default 8,
  source_kinds text[] default null::text[],
  for_product uuid default null::uuid
)
returns table(id uuid, source_kind text, source_id uuid, title text, content text,
              chunk_index integer, metadata jsonb, similarity double precision)
language sql stable security definer set search_path to 'public'
as $function$
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
$function$;

create or replace function public.match_signals(
  query_embedding vector,
  match_count integer default 8,
  for_user uuid default null::uuid,
  for_product uuid default null::uuid
)
returns table(id uuid, content text, title text, similarity double precision)
language sql stable security definer set search_path to 'public'
as $function$
  select s.id, s.content, s.title, 1 - (s.embedding <=> query_embedding) as similarity
  from public.signals s
  where s.user_id = auth.uid()
    and public.is_workspace_member(s.workspace_id)
    and (for_product is null or s.product_id = for_product)
    and s.embedding is not null
  order by s.embedding <=> query_embedding
  limit match_count;
$function$;

-- Re-apply hardening (the originals had this; DROP+CREATE reset grants to default).
revoke execute on function public.match_rag_chunks(vector, uuid, integer, text[], uuid) from public, anon;
revoke execute on function public.match_signals(vector, integer, uuid, uuid)            from public, anon;
grant  execute on function public.match_rag_chunks(vector, uuid, integer, text[], uuid) to authenticated;
grant  execute on function public.match_signals(vector, integer, uuid, uuid)            to authenticated;

-- NOTE: match_agent_memory is unchanged — agent_memory belongs to the agents epic (LATER set)
-- and does not yet carry workspace_id; scope it when that epic adds the keys.

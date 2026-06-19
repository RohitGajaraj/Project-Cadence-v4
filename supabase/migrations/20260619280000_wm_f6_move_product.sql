-- WM-F6 - Move a product between workspaces (same account).
--
-- A product (`projects` row) and all of its product-scoped child rows must be
-- relocatable to another workspace WITHIN THE SAME ACCOUNT, atomically, with no
-- orphan rows (a child whose `workspace_id` no longer matches its product's
-- workspace would be misclassified by the workspace-membership RLS already on
-- these tables). Because every product-scoped table is read-gated by
-- `is_workspace_member(workspace_id)`, reassigning `workspace_id` IS the move:
-- destination members gain access and source-only members lose it automatically.
--
-- Authorization is the SECURITY DEFINER guard (the function bypasses RLS, so the
-- guard is what enforces it): the caller must be able to manage BOTH the source
-- and the destination workspace (owner/admin, via WM-F3 `can_manage_workspace`),
-- and both workspaces must belong to the SAME account (WM-M2 `workspaces.account_id`)
-- so a product can never cross an account/billing boundary.
--
-- Memory does NOT move: `agent_memory` / `agent_runs` are workspace-scoped (the
-- moat compounds per workspace), not product-scoped, so they stay put by design.
--
-- Depends on WM-M2 (`workspaces.account_id`), WM-F3 (`can_manage_workspace`), and
-- WM-F9 (`notes`/`prototypes.workspace_id`), all of which carry earlier migration
-- timestamps and so apply before this one on the next publish. The function body
-- is plpgsql, so those names resolve at call time, not at creation time.

create or replace function public.move_product(_product_id uuid, _dest_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _src_workspace_id uuid;
  _src_account uuid;
  _dest_account uuid;
begin
  -- Lock the product row and resolve its current (source) workspace.
  select workspace_id into _src_workspace_id
  from public.projects
  where id = _product_id
  for update;

  if _src_workspace_id is null then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  if _dest_workspace_id = _src_workspace_id then
    raise exception 'The product is already in that workspace.';
  end if;

  -- Destination workspace must exist.
  select account_id into _dest_account
  from public.workspaces
  where id = _dest_workspace_id;

  if not found then
    raise exception 'Destination workspace not found.';
  end if;

  select account_id into _src_account
  from public.workspaces
  where id = _src_workspace_id;

  -- Same account only - never move a product across accounts/billing boundaries.
  if _src_account is distinct from _dest_account then
    raise exception 'A product can only move between workspaces in the same account.';
  end if;

  -- The caller must be able to manage BOTH workspaces (owner/admin).
  if not public.can_manage_workspace(_src_workspace_id) then
    raise exception 'You must be an owner or admin of the source workspace.';
  end if;
  if not public.can_manage_workspace(_dest_workspace_id) then
    raise exception 'You must be an owner or admin of the destination workspace.';
  end if;

  -- Reassign the product + every product-scoped child row, atomically. Tables
  -- that carry both `project_id` and `product_id` are matched on either so no
  -- row is left behind regardless of which foreign key is populated.
  update public.projects           set workspace_id = _dest_workspace_id where id = _product_id;

  update public.signals            set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.themes             set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.opportunities      set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.prds               set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.docs               set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.tasks              set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.decisions          set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.conversations      set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;

  update public.notes              set workspace_id = _dest_workspace_id where project_id = _product_id;
  update public.prototypes         set workspace_id = _dest_workspace_id where project_id = _product_id;

  update public.ai_events          set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.connection_bindings set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.rag_chunks         set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.studio_changesets  set workspace_id = _dest_workspace_id where product_id = _product_id;

  -- Product-scoped GRANDCHILDREN: rows that carry `workspace_id` but link to the
  -- product only through a parent. They are matched through that parent (whose
  -- `project_id`/`product_id` is unchanged by this move, so the lookup is stable)
  -- so the move leaves no orphan whose `workspace_id` outlives its parent's.
  update public.doc_versions set workspace_id = _dest_workspace_id
    where doc_id in (select id from public.docs where project_id = _product_id or product_id = _product_id);
  update public.messages set workspace_id = _dest_workspace_id
    where conversation_id in (select id from public.conversations where project_id = _product_id or product_id = _product_id);
  update public.learnings set workspace_id = _dest_workspace_id
    where opportunity_id in (select id from public.opportunities where project_id = _product_id or product_id = _product_id)
       or prd_id in (select id from public.prds where project_id = _product_id or product_id = _product_id);
end;
$$;

-- Only signed-in users may call it; the in-function guard does the real check.
revoke all on function public.move_product(uuid, uuid) from public, anon;
grant execute on function public.move_product(uuid, uuid) to authenticated;

-- KI-34 + KI-36: harden connection_bindings write RLS (the airtight DB-layer
-- closure for the cross-tenant credential-theft + binding-hijack findings).
--
-- Before this migration:
--   insert WITH CHECK = is_workspace_member(workspace_id) AND created_by = auth.uid()
--   update USING/CHECK = is_workspace_member(workspace_id)
--   delete USING       = is_workspace_member(workspace_id)
-- So (KI-34) a member could create/repoint a binding whose connection_id points at
-- ANY connection in the system (the policies never validated connection_id), and
-- resolveProviderAuth would then materialize that foreign connection's credential
-- for the member's workspace; and (KI-36) ANY member could update or delete ANY
-- binding in the workspace, not just their own.
--
-- This migration:
--   1. KI-34: insert/update WITH CHECK additionally require the bound connection's
--      OWNER to be a member of the binding's workspace, via a SECURITY DEFINER
--      helper (a plain subquery against `connections` would be RLS-filtered to the
--      caller's own rows, so it must run as definer to read the owner).
--   2. KI-36: update/delete USING additionally require the caller to be the
--      binding's creator OR a workspace owner/admin (can_manage_workspace), not
--      just any member.
--
-- Mirrors the app-layer guard already shipped in resolve.server.ts
-- (bindingConnectionAllowed). DROP-then-CREATE per the migration-safety rule
-- (never CREATE POLICY IF NOT EXISTS). Verified by a BEGIN..ROLLBACK dry-run on
-- the live prod DB via the Lovable MCP (applies cleanly; policies render as
-- intended) before commit.

CREATE OR REPLACE FUNCTION public.connection_owner_in_workspace(
  p_connection_id uuid,
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.connections c
    JOIN public.workspace_members wm ON wm.user_id = c.user_id
    WHERE c.id = p_connection_id
      AND wm.workspace_id = p_workspace_id
  );
$fn$;

DROP POLICY IF EXISTS "Workspace bindings - insert" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - insert" ON public.connection_bindings
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id)
    AND created_by = auth.uid()
    AND public.connection_owner_in_workspace(connection_id, workspace_id)
  );

DROP POLICY IF EXISTS "Workspace bindings - update" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - update" ON public.connection_bindings
  FOR UPDATE
  USING (
    is_workspace_member(workspace_id)
    AND (created_by = auth.uid() OR can_manage_workspace(workspace_id))
  )
  WITH CHECK (
    is_workspace_member(workspace_id)
    AND (created_by = auth.uid() OR can_manage_workspace(workspace_id))
    AND public.connection_owner_in_workspace(connection_id, workspace_id)
  );

DROP POLICY IF EXISTS "Workspace bindings - delete" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - delete" ON public.connection_bindings
  FOR DELETE
  USING (
    is_workspace_member(workspace_id)
    AND (created_by = auth.uid() OR can_manage_workspace(workspace_id))
  );

GRANT EXECUTE ON FUNCTION public.connection_owner_in_workspace(uuid, uuid) TO authenticated;

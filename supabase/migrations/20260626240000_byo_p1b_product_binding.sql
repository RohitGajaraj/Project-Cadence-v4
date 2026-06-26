-- BYO-P1b: Product-level connection bindings.
--
-- The connection_bindings table already has a nullable product_id column
-- (added in 20260612080000_f_conn_connector_platform.sql). That migration
-- also added the workspace-level partial unique index and the comment
-- "product-level bindings arrive in a later phase" — this is that phase.
--
-- What this migration does:
--   1. Adds the FK constraint that was intentionally deferred: product_id
--      must reference a row in public.projects (ON DELETE CASCADE so deleting
--      a product auto-removes its bindings).
--   2. Adds a partial unique index for product-scoped bindings (one binding
--      per product+provider+resource_kind, parallel to the existing workspace-
--      level partial index which covers product_id IS NULL).
--   3. Adds a SECURITY DEFINER helper that confirms a product belongs to a
--      specific workspace — used by RLS to prevent cross-workspace binding.
--   4. Tightens the write policies to gate product-scoped rows on the same
--      workspace-membership check already applied to workspace-scoped rows,
--      PLUS the product-workspace consistency guard (if product_id is set,
--      the product must live in the same workspace as the binding).
--
-- The existing read policy ("connection_bindings ws read") already covers
-- product-scoped rows because it gates on is_workspace_member(workspace_id)
-- and product-scoped bindings carry the same workspace_id — no change needed.

-- 1. FK: product_id -> projects(id) ON DELETE CASCADE
--    The column already exists; we only add the constraint.
ALTER TABLE public.connection_bindings
  ADD CONSTRAINT connection_bindings_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

-- 2. Unique index: one product-scoped binding per (product_id, provider, resource_kind)
CREATE UNIQUE INDEX IF NOT EXISTS connection_bindings_product_provider_kind_key
  ON public.connection_bindings (product_id, provider, resource_kind)
  WHERE product_id IS NOT NULL;

-- Also add a lookup-optimised index for the resolver's product-first query
CREATE INDEX IF NOT EXISTS idx_connection_bindings_product
  ON public.connection_bindings (workspace_id, product_id, provider, resource_kind)
  WHERE product_id IS NOT NULL;

-- 3. Helper: confirm a product (projects row) belongs to a given workspace.
--    SECURITY DEFINER so the RLS policy can read projects without being filtered
--    by the caller's own-row or workspace policies on that table.
CREATE OR REPLACE FUNCTION public.product_in_workspace(
  p_product_id uuid,
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
    FROM public.projects
    WHERE id = p_product_id
      AND workspace_id = p_workspace_id
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.product_in_workspace(uuid, uuid) TO authenticated;

-- 4. Tighten write RLS to enforce product-workspace consistency.
--    Pattern follows 20260620220000_ki34_ki36_connection_bindings_rls.sql
--    (DROP-then-CREATE per migration-safety rule).
--
--    Guard logic: when product_id IS NULL (workspace-scoped row), the existing
--    workspace-membership and connection-ownership checks suffice.  When
--    product_id IS NOT NULL (product-scoped row), additionally require the
--    product to belong to the binding's workspace.

DROP POLICY IF EXISTS "Workspace bindings - insert" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - insert" ON public.connection_bindings
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id)
    AND created_by = auth.uid()
    AND public.connection_owner_in_workspace(connection_id, workspace_id)
    AND (
      product_id IS NULL
      OR public.product_in_workspace(product_id, workspace_id)
    )
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
    AND (
      product_id IS NULL
      OR public.product_in_workspace(product_id, workspace_id)
    )
  );

-- Delete policy is unchanged: membership + creator/admin. Product bindings are
-- removed automatically via the FK ON DELETE CASCADE when a product is deleted.
-- The explicit delete path (unbind button) uses the same policy as before.
DROP POLICY IF EXISTS "Workspace bindings - delete" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - delete" ON public.connection_bindings
  FOR DELETE
  USING (
    is_workspace_member(workspace_id)
    AND (created_by = auth.uid() OR can_manage_workspace(workspace_id))
  );


-- Tighten RLS policies to authenticated only, add user_id ownership checks, restrict stripe ids, set search_path on function

-- 1. ingest_tokens: scope to authenticated; enforce user_id ownership on write
DROP POLICY IF EXISTS "ingest_tokens ws read" ON public.ingest_tokens;
DROP POLICY IF EXISTS "ingest_tokens ws write" ON public.ingest_tokens;
CREATE POLICY "ingest_tokens ws read" ON public.ingest_tokens
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ingest_tokens ws write" ON public.ingest_tokens
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id) AND user_id = auth.uid())
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

-- 2. studio_changesets / revisions / changes: scope to authenticated
DROP POLICY IF EXISTS "studio_changesets ws read" ON public.studio_changesets;
DROP POLICY IF EXISTS "studio_changesets ws write" ON public.studio_changesets;
CREATE POLICY "studio_changesets ws read" ON public.studio_changesets
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "studio_changesets ws write" ON public.studio_changesets
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "studio_revisions ws read" ON public.studio_changeset_revisions;
DROP POLICY IF EXISTS "studio_revisions ws write" ON public.studio_changeset_revisions;
CREATE POLICY "studio_revisions ws read" ON public.studio_changeset_revisions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_changesets cs WHERE cs.id = studio_changeset_revisions.changeset_id AND public.is_workspace_member(cs.workspace_id)));
CREATE POLICY "studio_revisions ws write" ON public.studio_changeset_revisions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_changesets cs WHERE cs.id = studio_changeset_revisions.changeset_id AND public.is_workspace_member(cs.workspace_id)))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.studio_changesets cs WHERE cs.id = studio_changeset_revisions.changeset_id AND public.is_workspace_member(cs.workspace_id)));

DROP POLICY IF EXISTS "studio_changes ws read" ON public.studio_changes;
DROP POLICY IF EXISTS "studio_changes ws write" ON public.studio_changes;
CREATE POLICY "studio_changes ws read" ON public.studio_changes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_changesets cs WHERE cs.id = studio_changes.changeset_id AND public.is_workspace_member(cs.workspace_id)));
CREATE POLICY "studio_changes ws write" ON public.studio_changes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_changesets cs WHERE cs.id = studio_changes.changeset_id AND public.is_workspace_member(cs.workspace_id)))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.studio_changesets cs WHERE cs.id = studio_changes.changeset_id AND public.is_workspace_member(cs.workspace_id)));

-- 3. workspaces: hide stripe billing identifiers from non-service roles
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.workspaces FROM anon, authenticated;

-- 4. memory_expiry_enabled: set fixed search_path
CREATE OR REPLACE FUNCTION public.memory_expiry_enabled()
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT false $$;

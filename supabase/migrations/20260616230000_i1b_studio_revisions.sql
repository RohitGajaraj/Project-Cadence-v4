-- I1b: Studio changeset revision history (atomic revisions).
--
-- Each studio.commit records one revision (number, commit sha/url, message, the
-- file set) so the operator can see a changeset's commit history in-platform
-- instead of only on GitHub. Tenancy mirrors studio_changes: scoped to the
-- parent changeset's workspace. Append-only in practice (the commit records it);
-- no schema coupling beyond the FK, so it is safe to add independently.

CREATE TABLE IF NOT EXISTS public.studio_changeset_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changeset_id uuid NOT NULL REFERENCES public.studio_changesets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  revision_no int NOT NULL,
  commit_sha text NOT NULL,
  commit_url text,
  message text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (changeset_id, revision_no)
);

CREATE INDEX IF NOT EXISTS idx_studio_revisions_changeset
  ON public.studio_changeset_revisions (changeset_id, revision_no DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_changeset_revisions TO authenticated;
GRANT ALL ON public.studio_changeset_revisions TO service_role;

ALTER TABLE public.studio_changeset_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_revisions ws read" ON public.studio_changeset_revisions;
CREATE POLICY "studio_revisions ws read" ON public.studio_changeset_revisions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.studio_changesets cs
    WHERE cs.id = changeset_id AND public.is_workspace_member(cs.workspace_id)
  ));

DROP POLICY IF EXISTS "studio_revisions ws write" ON public.studio_changeset_revisions;
CREATE POLICY "studio_revisions ws write" ON public.studio_changeset_revisions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.studio_changesets cs
    WHERE cs.id = changeset_id AND public.is_workspace_member(cs.workspace_id)
  ))
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.studio_changesets cs
    WHERE cs.id = changeset_id AND public.is_workspace_member(cs.workspace_id)
  ));

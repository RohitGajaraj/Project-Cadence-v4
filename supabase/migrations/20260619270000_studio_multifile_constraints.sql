-- F-BUILDER-MULTIFILE -- pre-declared touch list + max-files cap for a Studio
-- changeset (docs/features/studio.md). Mission-keyed so it can be declared at
-- dispatch (before the agent lazily creates the changeset) and read back against
-- the live changeset on the Changes tab. Operator-layer policy: the tab reports
-- in/out-of-policy files and the over-cap count so the human curates before the
-- confirm-gated commit. Additive only -- no existing table is touched.

CREATE TABLE IF NOT EXISTS public.studio_changeset_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL UNIQUE REFERENCES public.missions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  allowed_paths text[] NOT NULL DEFAULT '{}',
  max_files int CHECK (max_files IS NULL OR max_files > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_constraints_ws
  ON public.studio_changeset_constraints (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_changeset_constraints TO authenticated;
GRANT ALL ON public.studio_changeset_constraints TO service_role;

ALTER TABLE public.studio_changeset_constraints ENABLE ROW LEVEL SECURITY;

-- Tenancy mirrors studio_changesets: workspace members read; writes additionally
-- require the row to be owned by the writer (user_id = auth.uid()).
DROP POLICY IF EXISTS "studio_constraints ws read" ON public.studio_changeset_constraints;
CREATE POLICY "studio_constraints ws read" ON public.studio_changeset_constraints
  FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "studio_constraints ws write" ON public.studio_changeset_constraints;
CREATE POLICY "studio_constraints ws write" ON public.studio_changeset_constraints
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

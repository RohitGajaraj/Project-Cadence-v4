-- K2: Rollback + one-action revert
-- Adds studio_rollbacks table (links original merged changeset → revert changeset).
-- RLS workspace-scoped, pre-migration tolerant reads, gated writes.
-- Mirrors studio_changeset_revisions pattern (I1b).

-- Create table
CREATE TABLE IF NOT EXISTS public.studio_rollbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  product_id uuid NULL,
  original_changeset_id uuid NOT NULL REFERENCES public.studio_changesets (id) ON DELETE CASCADE,
  revert_changeset_id uuid NULL REFERENCES public.studio_changesets (id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('initiated', 'reverted', 'failed')),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_studio_rollbacks_user ON public.studio_rollbacks (user_id);
CREATE INDEX IF NOT EXISTS idx_studio_rollbacks_workspace ON public.studio_rollbacks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_rollbacks_original ON public.studio_rollbacks (original_changeset_id);
CREATE INDEX IF NOT EXISTS idx_studio_rollbacks_revert ON public.studio_rollbacks (revert_changeset_id);

-- Unique constraint: only one non-failed rollback per original changeset
CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_rollbacks_original_unique
  ON public.studio_rollbacks (original_changeset_id)
  WHERE status != 'failed';

-- RLS Enable
ALTER TABLE public.studio_rollbacks ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT policy (any workspace member can read the workspace's rollbacks).
-- Uses the canonical public.is_workspace_member() helper, like every other table.
CREATE POLICY "studio_rollbacks_select"
  ON public.studio_rollbacks
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- RLS: INSERT/UPDATE/DELETE policy (workspace member; writer must own the row).
CREATE POLICY "studio_rollbacks_write"
  ON public.studio_rollbacks
  FOR ALL
  TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_rollbacks TO authenticated;
GRANT ALL ON public.studio_rollbacks TO service_role;

-- Update timestamp on write
CREATE OR REPLACE FUNCTION public.update_studio_rollbacks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER studio_rollbacks_updated_at_trigger
BEFORE UPDATE ON public.studio_rollbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_studio_rollbacks_updated_at();

-- ── studio.revert tool seed (K2) ───────────────────────────────────────────
-- The seed belongs in THIS migration (not the already-applied f_studio_engine
-- one). Re-define seed_studio_tools() to include studio.revert so future signups
-- in already-migrated environments get it, then backfill every existing profile.
CREATE OR REPLACE FUNCTION public.seed_studio_tools(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'repo.tree',       'Read repo tree',     'Studio: list the connected repo''s file tree (paths, types, sizes). Read-only.', 'read', 'auto', true),
    (_user_id, 'repo.read',       'Read repo files',    'Studio: read up to 8 files from the connected repo. Read-only.', 'read', 'auto', true),
    (_user_id, 'repo.search',     'Search repo code',   'Studio: GitHub code search scoped to the connected repo. Read-only.', 'read', 'auto', true),
    (_user_id, 'studio.stage',    'Stage changes',      'Studio: stage multi-file edits into the mission''s changeset. DB-only, no GitHub write.', 'write', 'auto', true),
    (_user_id, 'studio.commit',   'Commit changeset',   'Studio: commit ALL staged changes to an isolated studio/* branch via the Git Data API. Confirm-gated.', 'write', 'confirm', true),
    (_user_id, 'studio.pr.open',  'Open Studio PR',     'Studio: open a multi-file pull request from the changeset branch. Confirm-gated.', 'write', 'confirm', true),
    (_user_id, 'studio.pr.merge', 'Merge Studio PR',    'Studio: merge the changeset PR (squash). Review-gated, closes the loop in-platform.', 'write', 'review', true),
    (_user_id, 'studio.revert',   'Roll back release',  'Studio: roll back a merged release by synthesizing an inverse changeset. Flows through commit, PR, CI gate, merge. Review-gated.', 'write', 'review', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
END;
$function$;

INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in)
SELECT p.id, 'studio.revert', 'Roll back release',
       'Studio: roll back a merged release by synthesizing an inverse changeset. Flows through commit, PR, CI gate, merge. Review-gated.',
       'write', 'review', true
FROM public.profiles p
ON CONFLICT (user_id, tool_name) DO NOTHING;

-- BYO-P3 WI1 — Deploy capture.
-- Records the deployment state per environment for a studio changeset so the
-- outcome surface can show "where it actually shipped" (closes the deploy blind
-- spot in the lifecycle gap map). Populated by captureDeployments() via the
-- provider-agnostic RepoProvider.readDeployments(); never written by the agent
-- loop directly. Workspace-scoped RLS, mirroring studio_changesets.

CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  product_id uuid,
  changeset_id uuid REFERENCES public.studio_changesets(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github',
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('success','failure','pending','in_progress','unknown')),
  commit_sha text NOT NULL DEFAULT '',
  deploy_url text,
  triggered_by text,
  deployed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent capture key: re-reading the same deploy updates status in place
-- instead of duplicating. Captures are always changeset-scoped, so the NULL-
-- distinct behaviour on changeset_id is moot in practice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deployments_capture
  ON public.deployments (changeset_id, environment, commit_sha);
CREATE INDEX IF NOT EXISTS idx_deployments_ws
  ON public.deployments (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_product
  ON public.deployments (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_changeset
  ON public.deployments (changeset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployments TO authenticated;
GRANT ALL ON public.deployments TO service_role;

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deployments ws read" ON public.deployments;
CREATE POLICY "deployments ws read" ON public.deployments
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "deployments ws write" ON public.deployments;
CREATE POLICY "deployments ws write" ON public.deployments
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

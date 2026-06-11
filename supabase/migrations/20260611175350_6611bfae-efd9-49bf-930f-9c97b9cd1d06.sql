
ALTER TABLE public.prds
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome JSONB;

CREATE TABLE IF NOT EXISTS public.learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  prd_id UUID REFERENCES public.prds(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('validated','missed','mixed')),
  summary TEXT NOT NULL,
  metric_label TEXT,
  metric_value TEXT,
  prior_ice NUMERIC,
  new_ice NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learnings TO authenticated;
GRANT ALL ON public.learnings TO service_role;

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace learnings"
  ON public.learnings FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = learnings.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users insert own learnings"
  ON public.learnings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own learnings"
  ON public.learnings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own learnings"
  ON public.learnings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_learnings_prd ON public.learnings(prd_id);
CREATE INDEX IF NOT EXISTS idx_learnings_workspace ON public.learnings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_learnings_created ON public.learnings(created_at DESC);

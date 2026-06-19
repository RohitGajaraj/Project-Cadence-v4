-- P7: cost incidents table
-- Create a persistent table to record cost incidents / budget threshold breaches linked to traces.

CREATE TABLE IF NOT EXISTS public.cost_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  trace_id TEXT,
  amount_usd NUMERIC(10, 2),
  window_kind TEXT CHECK (window_kind IN ('day', 'month')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cost_incidents ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS cost_incidents_workspace_idx ON public.cost_incidents (workspace_id, created_at DESC);

-- Policies
DROP POLICY IF EXISTS "ws members read" ON public.cost_incidents;
CREATE POLICY "ws members read" ON public.cost_incidents
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "ws members insert" ON public.cost_incidents;
CREATE POLICY "ws members insert" ON public.cost_incidents
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

-- Grants
GRANT SELECT, INSERT ON public.cost_incidents TO authenticated;
GRANT ALL ON public.cost_incidents TO service_role;

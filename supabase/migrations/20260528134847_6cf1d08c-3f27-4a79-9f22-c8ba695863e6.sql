CREATE TABLE public.artifact_lineage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_kind TEXT NOT NULL,
  parent_id UUID NOT NULL,
  child_kind TEXT NOT NULL,
  child_id UUID NOT NULL,
  relation TEXT NOT NULL DEFAULT 'promoted',
  rationale TEXT,
  created_by_agent TEXT,
  ai_event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, parent_kind, parent_id, child_kind, child_id, relation)
);

CREATE INDEX idx_lineage_parent ON public.artifact_lineage (user_id, parent_kind, parent_id);
CREATE INDEX idx_lineage_child  ON public.artifact_lineage (user_id, child_kind,  child_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_lineage TO authenticated;
GRANT ALL ON public.artifact_lineage TO service_role;

ALTER TABLE public.artifact_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own artifact_lineage all"
ON public.artifact_lineage
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
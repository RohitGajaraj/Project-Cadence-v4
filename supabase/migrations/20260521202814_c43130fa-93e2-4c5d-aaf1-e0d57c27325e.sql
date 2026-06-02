
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decisions_made jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS prd_id uuid,
  ADD COLUMN IF NOT EXISTS estimate_hours numeric;

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS meeting_id uuid;

CREATE INDEX IF NOT EXISTS idx_tasks_prd_id ON public.tasks(prd_id);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id ON public.decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);

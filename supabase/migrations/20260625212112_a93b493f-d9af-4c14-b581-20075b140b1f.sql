ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS delegate_meta jsonb;
CREATE INDEX IF NOT EXISTS idx_agent_runs_delegate_external_job
  ON public.agent_runs ((delegate_meta->>'external_job_id'))
  WHERE delegate_meta IS NOT NULL;
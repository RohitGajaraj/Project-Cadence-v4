-- BLD-04: track external delegate job id + poll state on agent_runs.
-- delegate_meta shape: { provider, external_job_id, submitted_at, last_polled_at?, poll_status? }
-- null on runs where no delegation was submitted.
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS delegate_meta jsonb;

-- Sparse index on external_job_id so "find runs awaiting a delegate callback"
-- is a fast lookup without a full table scan.
CREATE INDEX IF NOT EXISTS idx_agent_runs_delegate_external_job
  ON public.agent_runs ((delegate_meta->>'external_job_id'))
  WHERE delegate_meta IS NOT NULL;

-- FND-RUNTIME 0.9: durable runtime foundation
-- Adds checkpointing + idempotency so missions survive worker restarts.

-- 1) Extend agent_runs
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkpoint_at TIMESTAMPTZ;

-- Allow 'queued' status (existing values: running/completed/halted/failed).
-- Status is plain text so no enum change needed.

CREATE INDEX IF NOT EXISTS idx_agent_runs_status_workspace
  ON public.agent_runs (workspace_id, status)
  WHERE status IN ('running','queued');

-- 2) agent_run_checkpoints — append-only, one row per loop iteration
CREATE TABLE IF NOT EXISTS public.agent_run_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  step_index INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_run_step
  ON public.agent_run_checkpoints (run_id, step_index DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_user
  ON public.agent_run_checkpoints (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_run_checkpoints TO authenticated;
GRANT ALL ON public.agent_run_checkpoints TO service_role;
ALTER TABLE public.agent_run_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own checkpoints all"
  ON public.agent_run_checkpoints
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) idempotency_keys — dedup table for ticks + tool calls
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL,             -- 'tick' | 'tool' | 'a2a' | ...
  key TEXT NOT NULL,               -- caller-supplied deterministic key
  user_id UUID,                    -- nullable: system tick may have no user
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idem_run ON public.idempotency_keys (run_id);
CREATE INDEX IF NOT EXISTS idx_idem_created ON public.idempotency_keys (created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_keys TO authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Owner can see their own keys; system rows (user_id NULL) visible only to service_role.
CREATE POLICY "own idempotency keys"
  ON public.idempotency_keys
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
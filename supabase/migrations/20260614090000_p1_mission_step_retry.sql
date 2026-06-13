-- v6 Phase 1 ("The Loop Runs Itself") — hop-failure retry/recovery.
--
-- Adds bounded-retry tracking to mission_steps so the deterministic mission
-- reflector (src/lib/ai/mission-advance.server.ts) can re-dispatch a failed hop
-- a small number of times with exponential backoff instead of terminalizing the
-- whole branch on the first transient failure.
--
-- Backward compatible: existing rows get attempts=0, max_attempts=2,
-- next_retry_at=NULL — which makes next_ready_mission_steps behave EXACTLY as
-- before (NULL backoff = immediately eligible). Pre-migration code paths read
-- these columns defensively, so deploy order is not load-bearing.

-- 1. Retry-tracking columns (idempotent).
ALTER TABLE public.mission_steps
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.mission_steps
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 2;
ALTER TABLE public.mission_steps
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

COMMENT ON COLUMN public.mission_steps.attempts IS
  'Number of times this step has been dispatched (incl. the attempt that just failed).';
COMMENT ON COLUMN public.mission_steps.max_attempts IS
  'Ceiling on dispatches before the step is given up as failed (default 2 = one auto-retry).';
COMMENT ON COLUMN public.mission_steps.next_retry_at IS
  'When a retry-requeued step becomes eligible to re-dispatch (exponential backoff). NULL = now.';

-- 2. next_ready_mission_steps now also honours the retry backoff window: a
--    'planned' step whose deps are all 'done' is ready only once its
--    next_retry_at (if any) has elapsed. Unchanged for never-retried steps.
CREATE OR REPLACE FUNCTION public.next_ready_mission_steps(p_mission_id uuid)
RETURNS SETOF public.mission_steps
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ms.*
  FROM public.mission_steps ms
  WHERE ms.mission_id = p_mission_id
    AND ms.status = 'planned'
    AND (ms.next_retry_at IS NULL OR ms.next_retry_at <= now())
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ms.depends_on) AS dep(idx)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.mission_steps d
        WHERE d.mission_id = ms.mission_id
          AND d.idx = dep.idx
          AND d.status = 'done'
      )
    )
  ORDER BY ms.idx;
$$;

GRANT EXECUTE ON FUNCTION public.next_ready_mission_steps(uuid) TO authenticated;

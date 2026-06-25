-- SEN-04: Researcher Watchtower
--
-- Adds:
--   1. researcher_targets column on workspace_briefs: comma-separated competitor
--      domains / keywords the workspace wants to track. Defaults to empty (the
--      tick derives targets from current_focus + top opportunity titles when empty).
--   2. last_researcher_tick_at on workspace_briefs: debounce sentinel so multiple
--      tick invocations in the same day don't double-crawl.
--   3. pg_cron schedule: researcher-tick every day at 07:00 UTC.
--
-- ACTIVATION GATE: the tick exits early when FIRECRAWL_API_KEY is not set in the
-- worker's secrets. Apply this migration; then set the key to light everything up.
--
-- Idempotent: unschedule before re-scheduling.

ALTER TABLE public.workspace_briefs
  ADD COLUMN IF NOT EXISTS researcher_targets text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_researcher_tick_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'researcher-tick';

  -- researcher-tick: daily at 07:00 UTC (before the work day starts)
  PERFORM cron.schedule(
    'researcher-tick',
    '0 7 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/researcher-tick')
  );
END $$;

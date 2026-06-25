-- WM-S4: Workspace Steward agent
--
-- The Steward runs once daily at 09:00 UTC and nudges workspaces that have gone stale:
--   - Decisions older than 30 days with no supersession (still "active")
--   - Workspace briefs whose current_focus hasn't changed in 14+ days
--
-- It inserts a steward-sourced signal (source='steward') as the nudge artifact so
-- the ambient loop can pick it up for clustering. Rate-limited: at most 1 nudge per
-- workspace per day (checked by scanning for recent steward signals before inserting).
--
-- The endpoint is /api/public/hooks/steward-tick, guarded by x-cron-key exactly like
-- sense-tick and trigger-tick.
--
-- Idempotent: unschedule before re-scheduling.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  -- Remove existing schedule if present (idempotent)
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'steward-tick';

  -- steward-tick: once daily at 09:00 UTC
  PERFORM cron.schedule(
    'steward-tick',
    '0 9 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/steward-tick')
  );
END $$;

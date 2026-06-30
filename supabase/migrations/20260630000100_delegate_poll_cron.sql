-- BLD-04: schedule the delegate-poll-tick every 5 minutes.
-- Polls pending OpenHands conversation jobs and folds terminal results
-- (done/failed) back into mission_steps + agent_runs.
--
-- Idempotent: unschedules 'delegate-poll-tick' before scheduling so this
-- migration can be re-applied safely.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  -- Unschedule if it already exists (idempotent re-run safety)
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'delegate-poll-tick';

  -- delegate-poll-tick: every 5 minutes
  -- Finds agent_runs with a non-null external_job_id and non-terminal status,
  -- polls the OpenHands /api/conversations/{id} endpoint, folds done/failed results.
  PERFORM cron.schedule(
    'delegate-poll-tick',
    '*/5 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/delegate-poll-tick')
  );
END $$;

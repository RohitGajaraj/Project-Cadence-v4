-- Activate pg_cron schedules for the ambient loop: sense-tick (every 5 min) and
-- trigger-tick (every 15 min). Both endpoints are founder-gated until this migration;
-- the code ships dormant until these schedules call them.
--
-- sense-tick:   normalizes + tags signals, tops up the demo feed for opted-in workspaces
-- trigger-tick: evaluates thresholds, self-originates 'proposed' missions for human review
--
-- Idempotent: unschedules ALL known job names before re-scheduling so this migration
-- can be re-applied safely alongside the base cron migration.
-- Extensions are already enabled by the base cron migration (20260620150512) but the
-- IF NOT EXISTS guards are harmless on re-run.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  -- Unschedule all known jobs (idempotent; ignore if they don't exist)
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN (
    'approvals-tick',
    'event-reactor-tick',
    'memory-tick-daily',
    'resume-runs',
    'sense-tick',
    'trigger-tick'
  );

  -- sense-tick: every 5 minutes
  -- Normalizes + auto-tags untagged signals for opted-in workspaces; tops up the demo feed.
  -- Rule-based only, zero AI spend per invocation.
  PERFORM cron.schedule(
    'sense-tick',
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
    $job$, base_url || '/api/public/hooks/sense-tick')
  );

  -- trigger-tick: every 15 minutes
  -- Evaluates cluster thresholds + missed outcomes; self-originates 'proposed' missions
  -- (status='proposed' = zero AI spend; resume-runs ignores until human promotes to 'queued').
  PERFORM cron.schedule(
    'trigger-tick',
    '*/15 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/trigger-tick')
  );
END $$;

-- Schedule the resume-runs sweeper via pg_cron (every minute).
--
-- resume-runs is the Build/Studio execution heartbeat: it promotes queued
-- agent_runs to running, resumes evicted/stale runs, re-enters runs whose
-- approval gates are resolved, and auto-advances running missions. Without it,
-- a dispatched build sits at "QUEUED · starting up" forever (0 tokens) — which is
-- exactly what happened: the ambient-cron migration (20260625000000) listed
-- 'resume-runs' in its unschedule set but never (re)scheduled it, so the engine
-- was dormant on the deployed app.
--
-- Idempotent: unschedule before schedule so re-apply is safe. Same proven
-- net.http_post + get_cron_hook_secret() pattern as sense-tick / trigger-tick.
-- Note on spend: each tick is a cheap no-op when nothing is queued/ready; AI cost
-- only accrues when a run actually executes, and is bounded by the workspace
-- ai_budgets caps. Per-minute cadence matches the loop's design comment.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'resume-runs';

  PERFORM cron.schedule(
    'resume-runs',
    '* * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/resume-runs')
  );
END $$;

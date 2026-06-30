-- SF-DERIVE-TICK: Register the derive-tick cron job (every 2 hours, AI-spend gated).
--
-- auto_derive_enabled + last_auto_derive_at already exist on workspaces from
-- migration 20260630122000_brain_theme_scoring.sql — this migration only wires
-- the cron job that calls the derive-tick hook on a 2-hour cadence.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  DELETE FROM cron.job WHERE jobname = 'derive-tick';

  PERFORM cron.schedule(
    'derive-tick',
    '0 */2 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-key', public.get_cron_hook_secret()),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/derive-tick')
  );
END $$;

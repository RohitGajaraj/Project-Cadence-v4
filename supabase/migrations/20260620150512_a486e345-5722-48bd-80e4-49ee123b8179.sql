CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
REVOKE ALL ON SCHEMA app_private FROM authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE TABLE IF NOT EXISTS app_private.hook_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);

REVOKE ALL ON TABLE app_private.hook_secrets FROM PUBLIC;
REVOKE ALL ON TABLE app_private.hook_secrets FROM anon;
REVOKE ALL ON TABLE app_private.hook_secrets FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_private.hook_secrets TO service_role;

INSERT INTO app_private.hook_secrets (name, secret)
VALUES ('cron', replace(encode(gen_random_bytes(32), 'base64'), E'\n', ''))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_cron_hook_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app_private
AS $$
  SELECT secret
  FROM hook_secrets
  WHERE name = 'cron'
$$;

REVOKE ALL ON FUNCTION public.get_cron_hook_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cron_hook_secret() FROM anon;
REVOKE ALL ON FUNCTION public.get_cron_hook_secret() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_hook_secret() TO service_role;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('approvals-tick', 'event-reactor-tick', 'memory-tick-daily', 'resume-runs');

  PERFORM cron.schedule(
    'approvals-tick',
    '* * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );
    $job$, base_url || '/api/public/hooks/approvals-tick')
  );

  PERFORM cron.schedule(
    'event-reactor-tick',
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
    $job$, base_url || '/api/public/hooks/event-reactor-tick')
  );

  PERFORM cron.schedule(
    'memory-tick-daily',
    '30 3 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/memory-tick')
  );

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
        body := '{"source": "pg_cron"}'::jsonb
      );
    $job$, base_url || '/api/public/hooks/resume-runs')
  );
END $$;
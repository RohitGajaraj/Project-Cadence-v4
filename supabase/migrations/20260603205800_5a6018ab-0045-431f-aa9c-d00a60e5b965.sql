
-- Schedule approvals-tick: call the public hook every minute to expire stale approvals.
-- Idempotent: unschedule any existing job with the same name first.
DO $$
DECLARE jid integer;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'approvals-tick';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'approvals-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app/api/public/hooks/approvals-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc3p5cmN6eGFudXpoaW9oeWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjMzMzcsImV4cCI6MjA5NTk5OTMzN30._ruIjuZjNNfN24oKlxFtG2HOxi6QMnpfTAymxkidMc0'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

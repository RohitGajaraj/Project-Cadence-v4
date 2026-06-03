-- Schedule the resume-runs sweeper every minute
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule if already present (idempotent migration)
DO $$ BEGIN
  PERFORM cron.unschedule('resume-runs');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'resume-runs',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app/api/public/hooks/resume-runs',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc3p5cmN6eGFudXpoaW9oeWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjMzMzcsImV4cCI6MjA5NTk5OTMzN30._ruIjuZjNNfN24oKlxFtG2HOxi6QMnpfTAymxkidMc0"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);
DO $$
DECLARE
  base_url text := 'https://project--222b6dc6-6c31-456a-966b-5ef28c641f9a.lovable.app';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdmxtendrdHlndGJta2xnbnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODcwMTQsImV4cCI6MjA5NDg2MzAxNH0.JKnGyxwdXPgucz2KiKGW6W4UEbn6RRGZXfqNxlFZ974';
BEGIN
  PERFORM cron.unschedule('cadence-indexer-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cadence-indexer-tick');
  PERFORM cron.unschedule('cadence-eval-suite-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cadence-eval-suite-tick');
  PERFORM cron.unschedule('cadence-drift-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cadence-drift-tick');

  PERFORM cron.schedule(
    'cadence-indexer-tick',
    '7 * * * *',
    format($f$
      SELECT net.http_post(
        url := '%s/api/public/hooks/indexer-tick',
        headers := jsonb_build_object('Content-Type','application/json','apikey','%s'),
        body := '{}'::jsonb
      );
    $f$, base_url, anon_key)
  );

  PERFORM cron.schedule(
    'cadence-eval-suite-tick',
    '0 3 * * *',
    format($f$
      SELECT net.http_post(
        url := '%s/api/public/hooks/eval-suite-tick',
        headers := jsonb_build_object('Content-Type','application/json','apikey','%s'),
        body := '{}'::jsonb
      );
    $f$, base_url, anon_key)
  );

  PERFORM cron.schedule(
    'cadence-drift-tick',
    '0 4 * * *',
    format($f$
      SELECT net.http_post(
        url := '%s/api/public/hooks/drift-tick',
        headers := jsonb_build_object('Content-Type','application/json','apikey','%s'),
        body := '{}'::jsonb
      );
    $f$, base_url, anon_key)
  );
END $$;
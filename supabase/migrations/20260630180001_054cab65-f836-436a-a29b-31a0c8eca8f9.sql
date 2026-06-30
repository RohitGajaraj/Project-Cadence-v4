DO $$
DECLARE base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='derive-tick';
  PERFORM cron.schedule('derive-tick','0 */2 * * *',
    format($job$
      SELECT net.http_post(url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-key', public.get_cron_hook_secret()),
        body := '{}'::jsonb) AS request_id;
    $job$, base_url || '/api/public/hooks/derive-tick'));
END $$;
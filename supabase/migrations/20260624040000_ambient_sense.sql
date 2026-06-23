-- AMBIENT-SENSE (v11 #3): opt-in flag for continuous (unattended) signal SENSING.
--
-- The companion to F3 auto-cluster (20260618140000). Where cluster-tick groups signals into
-- themes (AI spend), sense-tick normalizes + auto-tags the workspace's untagged signals to the
-- ontology and tops up a small demo feed when near-empty, so the ambient loop has analysis-ready
-- input with no human start. sense-tick is RULE-BASED (no AI call), so it commits zero recurring
-- AI spend; only scheduling it (founder activation, below) is the recurring step.
--
-- auto_sense_enabled: a workspace owner opts in to continuous sensing. DEFAULT false.
-- last_auto_sense_at: stamped by the sense-tick hook after each run.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS). NOT NULL DEFAULT false is a metadata-only
-- change in Postgres (no table rewrite). The existing "ws owner manage" RLS already lets the
-- owner read/update these columns; no new policy needed.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_sense_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_sense_at timestamptz;

-- Index for the cron query: enabled workspaces, oldest-run-first.
CREATE INDEX IF NOT EXISTS idx_workspaces_auto_sense
  ON public.workspaces (auto_sense_enabled, last_auto_sense_at ASC NULLS FIRST)
  WHERE auto_sense_enabled = true;

-- DEV ENABLEMENT (demo-scoped, idempotent, ZERO spend): turn sensing ON for the two public
-- demo accounts' workspaces so the ambient loop is demonstrably live in dev. Safe because
-- sense-tick is rule-based (no AI). Real accounts stay opt-in (default false).
DO $$
DECLARE demo_email text; v_user uuid;
BEGIN
  FOREACH demo_email IN ARRAY ARRAY['demo@redcadence.app', 'demo2@redcadence.app'] LOOP
    SELECT id INTO v_user FROM auth.users WHERE email = demo_email LIMIT 1;
    CONTINUE WHEN v_user IS NULL;
    UPDATE public.workspaces SET auto_sense_enabled = true WHERE owner_id = v_user;
  END LOOP;
END $$;

-- FOUNDER ACTIVATION (the recurring step, intentionally NOT in this migration so apply commits
-- zero spend). To turn on continuous SENSE in production:
--   1. Owners opt their workspace in (sets auto_sense_enabled = true).
--   2. Point a scheduler at the hook so it fires periodically, e.g. pg_cron (+ pg_net on
--      Supabase hosted):
--        SELECT cron.schedule(
--          'ambient-sense', '*/30 * * * *',
--          $$ SELECT net.http_post(
--               url     := '<DEPLOYED_WORKER_URL>/api/public/hooks/sense-tick',
--               headers := jsonb_build_object('x-cron-key', '<CRON_KEY>')
--             ); $$);
--      Verify the hook works first by POSTing to it manually with the cron-key header.

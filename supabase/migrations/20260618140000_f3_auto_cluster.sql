-- F3-CRON: opt-in flag for continuous (unattended) signal clustering.
--
-- auto_cluster_enabled: a workspace owner opts in to recurring AI clustering.
--   DEFAULT false so NO automated AI spend fires until an owner explicitly
--   turns it on (the cluster-tick hook only processes enabled workspaces).
-- last_auto_cluster_at: stamped by the cluster-tick hook after each run; shown
--   in the Signals tab as proof of last run.
--
-- Additive and idempotent (ADD COLUMN IF NOT EXISTS). NOT NULL DEFAULT false is
-- a metadata-only change in Postgres (no table rewrite). Existing workspace RLS
-- ("ws owner manage": owner_id = auth.uid() for ALL) already lets the owner read
-- and update these columns; the toggleAutoCluster server fn does an owner check
-- in app code as belt-and-suspenders. No new policy is needed.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_cluster_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_cluster_at timestamptz;

-- Index for the cron query: find enabled workspaces, oldest-run-first.
CREATE INDEX IF NOT EXISTS idx_workspaces_auto_cluster
  ON public.workspaces (auto_cluster_enabled, last_auto_cluster_at ASC NULLS FIRST)
  WHERE auto_cluster_enabled = true;

-- FOUNDER ACTIVATION (the recurring-spend step, intentionally NOT in this
-- migration so it commits zero spend on apply). To turn on continuous SENSE:
--   1. Owners opt their workspace in via the "Auto-cluster new signals" toggle
--      in the Signals tab (sets auto_cluster_enabled = true).
--   2. Point a scheduler at the hook so it fires periodically, e.g. pg_cron
--      (pg_cron + pg_net are available on Supabase hosted):
--        SELECT cron.schedule(
--          'f3-auto-cluster', '0 */6 * * *',
--          $$ SELECT net.http_post(
--               url     := '<DEPLOYED_WORKER_URL>/api/public/hooks/cluster-tick',
--               headers := jsonb_build_object('apikey', '<SUPABASE_PUBLISHABLE_KEY>')
--             ); $$);
--      Verify the hook works first by POSTing to it manually with the apikey
--      header (see docs/features/f3-continuous-discovery.md publish-verify).

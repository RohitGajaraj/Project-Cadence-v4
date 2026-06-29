-- SF-SCOUT (Signal Fabric Phase 1): the outside-in diffing Scout / Watchtower.
--
-- The diffing successor to the SEN-04 researcher-tick v0 (which re-summarizes web
-- search every day). The Scout watches a per-workspace LIST of targets (a competitor
-- changelog, a market topic, a reviews page...), fetches each on a cadence, DIFFS the
-- fetched content against the last snapshot, and emits a signal ONLY when something
-- actually changed. Signals flow through the SF-0 writeSignals sink (source_kind
-- 'web_scout'), so they inherit dedup + injection-screening for free.
--
-- ACTIVATION GATE: the scout-tick hook exits early when FIRECRAWL_API_KEY is unset.
-- Per-workspace opt-in (auto_scout_enabled, default false) + a daily fetch cap keep
-- the Firecrawl spend bounded. Real accounts never auto-spend.
--
-- Idempotent + MIG-LINT-safe (CREATE TABLE/INDEX IF NOT EXISTS; DROP-then-CREATE for
-- policies/triggers; nullable or defaulted columns only).

-- 1. The watch list: what each workspace monitors.
CREATE TABLE IF NOT EXISTS public.scout_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN
    ('competitor-surface','market-news','social-reviews','hiring','tech-platform-shift','regulatory-compliance')),
  label text NOT NULL,
  url text,
  query text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('hourly','daily','weekly')),
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  consecutive_unchanged int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scout_targets_url_or_query CHECK (url IS NOT NULL OR query IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_scout_targets_due
  ON public.scout_targets (enabled, next_check_at ASC NULLS FIRST) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scout_targets_ws ON public.scout_targets (workspace_id);

-- 2. Snapshots: the diff history (one row per fetch; the engine compares the newest two).
CREATE TABLE IF NOT EXISTS public.scout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.scout_targets(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  char_count int NOT NULL DEFAULT 0,
  fetched_url text,
  status int,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scout_snapshots_target
  ON public.scout_snapshots (target_id, fetched_at DESC);

-- 3. Runs: the per-target cost/audit ledger (the Firecrawl daily-cap accounting grain).
CREATE TABLE IF NOT EXISTS public.scout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.scout_targets(id) ON DELETE SET NULL,
  kind text,
  outcome text NOT NULL CHECK (outcome IN ('first-seen','unchanged','changed','error','skipped-cap')),
  changed boolean NOT NULL DEFAULT false,
  signal_id uuid REFERENCES public.signals(id) ON DELETE SET NULL,
  snapshot_id uuid REFERENCES public.scout_snapshots(id) ON DELETE SET NULL,
  fetch_count int NOT NULL DEFAULT 0,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scout_runs_ws_time
  ON public.scout_runs (workspace_id, created_at DESC);

-- RLS: member-read everywhere; owner-write on the watch list; snapshots/runs are
-- engine internals (service-role writes only, members can read for the UI).
ALTER TABLE public.scout_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_targets TO authenticated;
GRANT SELECT ON public.scout_snapshots TO authenticated;
GRANT SELECT ON public.scout_runs TO authenticated;
GRANT ALL ON public.scout_targets TO service_role;
GRANT ALL ON public.scout_snapshots TO service_role;
GRANT ALL ON public.scout_runs TO service_role;

DROP POLICY IF EXISTS scout_targets_member_read ON public.scout_targets;
CREATE POLICY scout_targets_member_read ON public.scout_targets
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS scout_targets_owner_write ON public.scout_targets;
CREATE POLICY scout_targets_owner_write ON public.scout_targets
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS scout_snapshots_member_read ON public.scout_snapshots;
CREATE POLICY scout_snapshots_member_read ON public.scout_snapshots
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS scout_runs_member_read ON public.scout_runs;
CREATE POLICY scout_runs_member_read ON public.scout_runs
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS scout_targets_updated_at ON public.scout_targets;
CREATE TRIGGER scout_targets_updated_at BEFORE UPDATE ON public.scout_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Workspace flags (mirror auto_sense_enabled). scout_daily_fetch_cap bounds Firecrawl spend.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_scout_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_scout_at timestamptz,
  ADD COLUMN IF NOT EXISTS scout_daily_fetch_cap int NOT NULL DEFAULT 50;
CREATE INDEX IF NOT EXISTS idx_workspaces_auto_scout
  ON public.workspaces (auto_scout_enabled, last_auto_scout_at ASC NULLS FIRST)
  WHERE auto_scout_enabled = true;

-- 5. pg_cron: one hourly scout-tick; per-target cadence is data-driven via next_check_at.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
DECLARE base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'scout-tick';
  PERFORM cron.schedule(
    'scout-tick',
    '0 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', public.get_cron_hook_secret()
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/scout-tick')
  );
END $$;

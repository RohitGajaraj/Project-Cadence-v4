-- F-V5-LOOP-CLOSE Phase D — close the ship→learn loop.
-- 1. public.learnings: per-PRD outcome verdicts with ICE re-score audit trail.
-- 2. prds.shipped_at + prds.outcome: GitHub-issue ship detection + recorded outcome.
-- 3. profiles.voice_anchor_text: voice anchor for chief-of-staff drafting.
-- 4. pg_cron: hourly outcome-tick hook (same pattern as approvals-tick / resume-runs).
--
-- NOTE (checked per spec): no CHECK constraint exists on missions.status or
-- agent_runs.status anywhere in supabase/migrations/ (both are plain
-- `status text NOT NULL DEFAULT 'running'`), so no constraint replacement is
-- needed to admit 'halted'/'failed'.

-- 1. learnings ----------------------------------------------------------------
CREATE TABLE public.learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Default bridge mirrors the tenancy retrofit (20260530120200) so inserts
  -- that omit workspace_id still land in the caller's default workspace.
  workspace_id uuid NOT NULL DEFAULT public.current_user_default_workspace(),
  prd_id uuid NULL REFERENCES public.prds(id) ON DELETE SET NULL,
  opportunity_id uuid NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  verdict text NOT NULL CHECK (verdict IN ('validated', 'missed', 'mixed')),
  summary text NOT NULL,
  metric_label text,
  metric_value text,
  prior_ice numeric,
  new_ice numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_learnings_ws_created ON public.learnings (workspace_id, created_at DESC);
CREATE INDEX idx_learnings_prd ON public.learnings (prd_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learnings TO authenticated;
GRANT ALL ON public.learnings TO service_role;

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;

-- Membership-keyed RLS, exact pattern from tenancy retrofit C/3 (20260530120200).
CREATE POLICY "learnings ws read" ON public.learnings
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "learnings ws write" ON public.learnings
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- 2. prds: ship detection + recorded outcome -----------------------------------
ALTER TABLE public.prds ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.prds ADD COLUMN IF NOT EXISTS outcome jsonb;

-- 3. profiles: voice anchor -----------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_anchor_text text;

-- 4. hourly outcome-tick via pg_cron (same registration pattern as resume-runs,
--    20260603215547). Detects PRDs whose linked GitHub issue closed and stamps
--    them shipped.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule if already present (idempotent migration)
DO $$ BEGIN
  PERFORM cron.unschedule('outcome-tick');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'outcome-tick',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app/api/public/hooks/outcome-tick',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc3p5cmN6eGFudXpoaW9oeWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjMzMzcsImV4cCI6MjA5NTk5OTMzN30._ruIjuZjNNfN24oKlxFtG2HOxi6QMnpfTAymxkidMc0"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);

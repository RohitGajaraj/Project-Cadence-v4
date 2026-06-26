-- SEN-05 / F-ANALYTICS-1 / F-ANALYTICS-2 — Product analytics inbound pipeline.
--
-- Three tables:
--  1. product_analytics  — daily cohort rows pulled from PostHog (or any analytics source).
--     One row per (workspace × event × date). Upserted by the sense-tick PostHog ingest.
--
--  2. ice_adjustments    — provenance trail every time the loop auto-updates an
--     opportunity's impact/confidence from real usage data.
--
--  3. opportunities.posthog_event column — links an opportunity to the PostHog event
--     that measures its adoption (e.g. "decision_made", "mission_started").
--
-- Activation posture: dormant until POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID are set.
-- The ingest fn checks those env vars and no-ops when absent.

-- 1. product_analytics -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_analytics (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id    uuid   NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature_event   text   NOT NULL,
  cohort_date     date   NOT NULL,
  distinct_users  int    NOT NULL DEFAULT 0,
  event_count     int    NOT NULL DEFAULT 0,
  source          text   NOT NULL DEFAULT 'posthog',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_analytics_unique UNIQUE (workspace_id, feature_event, cohort_date)
);

ALTER TABLE public.product_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read product_analytics"
  ON public.product_analytics FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT ON public.product_analytics TO authenticated;
GRANT ALL   ON public.product_analytics TO service_role;

CREATE INDEX IF NOT EXISTS product_analytics_workspace_event_date_idx
  ON public.product_analytics (workspace_id, feature_event, cohort_date DESC);

-- 2. ice_adjustments ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ice_adjustments (
  id               bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  opportunity_id   uuid   NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  workspace_id     uuid   NOT NULL,
  feature_event    text   NOT NULL,
  old_impact       int    NOT NULL,
  new_impact       int    NOT NULL,
  old_confidence   int    NOT NULL,
  new_confidence   int    NOT NULL,
  sample_users     int    NOT NULL DEFAULT 0,
  sample_events    int    NOT NULL DEFAULT 0,
  reason           text   NOT NULL,
  adjusted_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ice_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ice_adjustments"
  ON public.ice_adjustments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT ON public.ice_adjustments TO authenticated;
GRANT ALL   ON public.ice_adjustments TO service_role;

CREATE INDEX IF NOT EXISTS ice_adjustments_opportunity_idx
  ON public.ice_adjustments (opportunity_id, adjusted_at DESC);

-- 3. Link opportunities to PostHog events ------------------------------------
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS posthog_event text;

COMMENT ON COLUMN public.opportunities.posthog_event IS
  'PostHog event name that measures this opportunity''s feature adoption. '
  'When set, sense-tick pulls cohort data for this event and auto-adjusts ICE.';

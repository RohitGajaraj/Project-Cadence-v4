
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
DECLARE base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'resume-runs';
  PERFORM cron.schedule('resume-runs','* * * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',public.get_cron_hook_secret()),body:='{}'::jsonb) AS request_id;$job$, base_url || '/api/public/hooks/resume-runs'));
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'steward-tick';
  PERFORM cron.schedule('steward-tick','0 9 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',public.get_cron_hook_secret()),body:='{}'::jsonb) AS request_id;$job$, base_url || '/api/public/hooks/steward-tick'));
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'researcher-tick';
  PERFORM cron.schedule('researcher-tick','0 7 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',public.get_cron_hook_secret()),body:='{}'::jsonb) AS request_id;$job$, base_url || '/api/public/hooks/researcher-tick'));
END $$;

ALTER TABLE public.workspace_briefs
  ADD COLUMN IF NOT EXISTS researcher_targets text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_researcher_tick_at timestamptz;

CREATE TABLE IF NOT EXISTS public.audio_transcripts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','error')),
  transcript_text text,
  chunks jsonb NOT NULL DEFAULT '[]',
  assemblyai_id text,
  error_message text,
  action_items jsonb NOT NULL DEFAULT '[]',
  actions_extracted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_transcripts TO authenticated;
GRANT ALL ON public.audio_transcripts TO service_role;
ALTER TABLE public.audio_transcripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own audio transcripts" ON public.audio_transcripts;
CREATE POLICY "Users manage own audio transcripts" ON public.audio_transcripts FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Workspace members read audio transcripts" ON public.audio_transcripts;
CREATE POLICY "Workspace members read audio transcripts" ON public.audio_transcripts FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE OR REPLACE FUNCTION public.touch_audio_transcripts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS audio_transcripts_updated_at ON public.audio_transcripts;
CREATE TRIGGER audio_transcripts_updated_at BEFORE UPDATE ON public.audio_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.touch_audio_transcripts_updated_at();
CREATE INDEX IF NOT EXISTS audio_transcripts_workspace_created ON public.audio_transcripts (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audio_transcripts_processing ON public.audio_transcripts (assemblyai_id) WHERE status='processing' AND assemblyai_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.product_analytics (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature_event text NOT NULL,
  cohort_date date NOT NULL,
  distinct_users int NOT NULL DEFAULT 0,
  event_count int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'posthog',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_analytics_unique UNIQUE (workspace_id, feature_event, cohort_date)
);
GRANT SELECT ON public.product_analytics TO authenticated;
GRANT ALL ON public.product_analytics TO service_role;
ALTER TABLE public.product_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace members can read product_analytics" ON public.product_analytics;
CREATE POLICY "workspace members can read product_analytics" ON public.product_analytics FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id=auth.uid()
    UNION SELECT id FROM public.workspaces WHERE owner_id=auth.uid()));
CREATE INDEX IF NOT EXISTS product_analytics_workspace_event_date_idx
  ON public.product_analytics (workspace_id, feature_event, cohort_date DESC);

CREATE TABLE IF NOT EXISTS public.ice_adjustments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  feature_event text NOT NULL,
  old_impact int NOT NULL,
  new_impact int NOT NULL,
  old_confidence int NOT NULL,
  new_confidence int NOT NULL,
  sample_users int NOT NULL DEFAULT 0,
  sample_events int NOT NULL DEFAULT 0,
  reason text NOT NULL,
  adjusted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ice_adjustments TO authenticated;
GRANT ALL ON public.ice_adjustments TO service_role;
ALTER TABLE public.ice_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ice_adjustments" ON public.ice_adjustments;
CREATE POLICY "own ice_adjustments" ON public.ice_adjustments FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id=auth.uid()
    UNION SELECT id FROM public.workspaces WHERE owner_id=auth.uid()));
CREATE INDEX IF NOT EXISTS ice_adjustments_opportunity_idx
  ON public.ice_adjustments (opportunity_id, adjusted_at DESC);

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS posthog_event text;

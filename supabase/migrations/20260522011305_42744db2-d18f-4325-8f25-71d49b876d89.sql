
CREATE TABLE public.drift_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bucket_date date NOT NULL,
  surface text NOT NULL,
  model text NOT NULL,
  prompt_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  request_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  avg_latency_ms numeric NOT NULL DEFAULT 0,
  p95_latency_ms numeric NOT NULL DEFAULT 0,
  avg_total_tokens numeric NOT NULL DEFAULT 0,
  avg_cost_usd numeric NOT NULL DEFAULT 0,
  avg_eval_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bucket_date, surface, model, prompt_version_id)
);
CREATE INDEX drift_snapshots_user_date_idx ON public.drift_snapshots (user_id, bucket_date DESC);
ALTER TABLE public.drift_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drift_snapshots all" ON public.drift_snapshots
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER drift_snapshots_set_updated_at BEFORE UPDATE ON public.drift_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.drift_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  window_days integer NOT NULL DEFAULT 7,
  baseline_days integer NOT NULL DEFAULT 14,
  latency_pct_threshold numeric NOT NULL DEFAULT 25,
  tokens_pct_threshold numeric NOT NULL DEFAULT 30,
  cost_pct_threshold numeric NOT NULL DEFAULT 30,
  score_pct_threshold numeric NOT NULL DEFAULT 10,
  error_rate_pct_threshold numeric NOT NULL DEFAULT 5,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drift_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drift_baselines all" ON public.drift_baselines
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER drift_baselines_set_updated_at BEFORE UPDATE ON public.drift_baselines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.drift_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surface text NOT NULL,
  model text NOT NULL,
  prompt_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  metric text NOT NULL,
  baseline_value numeric NOT NULL,
  current_value numeric NOT NULL,
  delta_pct numeric NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  status text NOT NULL DEFAULT 'open',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drift_incidents_user_status_idx ON public.drift_incidents (user_id, status, detected_at DESC);
ALTER TABLE public.drift_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drift_incidents all" ON public.drift_incidents
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER drift_incidents_set_updated_at BEFORE UPDATE ON public.drift_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.ai_surface_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surface text NOT NULL,
  daily_usd_cap numeric(10,2),
  monthly_usd_cap numeric(10,2),
  daily_usd_used numeric(10,4) NOT NULL DEFAULT 0,
  monthly_usd_used numeric(10,4) NOT NULL DEFAULT 0,
  day_window date NOT NULL DEFAULT CURRENT_DATE,
  month_window date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surface)
);
ALTER TABLE public.ai_surface_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_surface_budgets all" ON public.ai_surface_budgets
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ai_surface_budgets_set_updated_at BEFORE UPDATE ON public.ai_surface_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_budget_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL,
  surface text,
  window_kind text NOT NULL,
  kind text NOT NULL,
  usd_used numeric(10,4) NOT NULL,
  usd_cap numeric(10,2) NOT NULL,
  pct numeric(5,2) NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_budget_alerts_user_idx ON public.ai_budget_alerts (user_id, created_at DESC);
ALTER TABLE public.ai_budget_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_budget_alerts all" ON public.ai_budget_alerts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

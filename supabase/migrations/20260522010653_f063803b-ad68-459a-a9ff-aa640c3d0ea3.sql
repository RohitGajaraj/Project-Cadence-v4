
ALTER TABLE public.eval_suites
  ADD COLUMN IF NOT EXISTS prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS judge_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS pass_threshold INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS schedule_cron TEXT,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.eval_cases
  ADD COLUMN IF NOT EXISTS rubric TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.eval_runs
  ADD COLUMN IF NOT EXISTS prompt_version_id UUID,
  ADD COLUMN IF NOT EXISTS judge_model TEXT,
  ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS total_cases INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errored INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.eval_case_results
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS judge_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS ai_event_id UUID,
  ADD COLUMN IF NOT EXISTS judge_event_id UUID,
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS idx_eval_cases_suite ON public.eval_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_eval_runs_user_suite ON public.eval_runs(user_id, suite_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_case_results_run ON public.eval_case_results(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_suites_enabled_user ON public.eval_suites(user_id, enabled);

DROP TRIGGER IF EXISTS eval_suites_updated_at ON public.eval_suites;
CREATE TRIGGER eval_suites_updated_at BEFORE UPDATE ON public.eval_suites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS eval_cases_updated_at ON public.eval_cases;
CREATE TRIGGER eval_cases_updated_at BEFORE UPDATE ON public.eval_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

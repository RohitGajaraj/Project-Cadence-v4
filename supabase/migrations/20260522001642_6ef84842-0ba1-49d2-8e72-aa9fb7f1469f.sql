
-- =====================================================
-- 6.1 AI Observability & Agentic Foundation
-- =====================================================

-- AI events: every model call across every surface
CREATE TABLE public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trace_id uuid,
  parent_event_id uuid,
  surface text NOT NULL,            -- agent | chat | copilot | prd | discovery | studio | brief | eval | judge | embed
  surface_ref text,                  -- agent_id / conversation_id / prd_id etc.
  provider text NOT NULL DEFAULT 'lovable',
  via text NOT NULL DEFAULT 'gateway', -- gateway | byo
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  est_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  ttft_ms integer,
  status text NOT NULL DEFAULT 'ok', -- ok | error | blocked
  error_code text,
  error_message text,
  fallback boolean NOT NULL DEFAULT false,
  cache_hit boolean NOT NULL DEFAULT false,
  request_hash text,
  input_preview text,                -- truncated for UI
  output_preview text,               -- truncated for UI
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_events_user_created_idx ON public.ai_events (user_id, created_at DESC);
CREATE INDEX ai_events_trace_idx ON public.ai_events (trace_id);
CREATE INDEX ai_events_surface_idx ON public.ai_events (user_id, surface, created_at DESC);

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_events all" ON public.ai_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI evals: judge scores attached to an event
CREATE TABLE public.ai_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  hallucination_score numeric(4,3),   -- 0..1 (1 = grounded, 0 = hallucinated)
  groundedness numeric(4,3),
  relevance numeric(4,3),
  coherence numeric(4,3),
  toxicity numeric(4,3),
  pii_risk numeric(4,3),
  prompt_injection_risk numeric(4,3),
  unsupported_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  judge_model text,
  judge_rationale text,
  status text NOT NULL DEFAULT 'pending', -- pending | done | failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_evals_event_idx ON public.ai_evals (event_id);
CREATE INDEX ai_evals_user_status_idx ON public.ai_evals (user_id, status);

ALTER TABLE public.ai_evals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_evals all" ON public.ai_evals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Feedback (👍/👎 + comment)
CREATE TABLE public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  rating smallint NOT NULL,           -- -1 | 0 | 1
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_feedback_event_idx ON public.ai_feedback (event_id);
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_feedback all" ON public.ai_feedback FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Guardrail rules
CREATE TABLE public.guardrail_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,                 -- regex | keyword | pii | injection | secret
  pattern text NOT NULL,
  action text NOT NULL DEFAULT 'warn',-- block | warn | redact
  applies_to text NOT NULL DEFAULT 'both', -- input | output | both
  enabled boolean NOT NULL DEFAULT true,
  built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardrail_rules_user_idx ON public.guardrail_rules (user_id, enabled);
ALTER TABLE public.guardrail_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own guardrail_rules all" ON public.guardrail_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Guardrail hits log
CREATE TABLE public.guardrail_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid,
  rule_id uuid,
  rule_name text NOT NULL,
  kind text NOT NULL,
  action text NOT NULL,
  side text NOT NULL,                 -- input | output
  matched text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardrail_hits_user_idx ON public.guardrail_hits (user_id, created_at DESC);
CREATE INDEX guardrail_hits_event_idx ON public.guardrail_hits (event_id);
ALTER TABLE public.guardrail_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own guardrail_hits all" ON public.guardrail_hits FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tool calls (agent traces)
CREATE TABLE public.tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid,
  trace_id uuid,
  agent_id uuid,
  tool_name text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  ok boolean NOT NULL DEFAULT true,
  error text,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tool_calls_trace_idx ON public.tool_calls (trace_id);
CREATE INDEX tool_calls_user_idx ON public.tool_calls (user_id, created_at DESC);
ALTER TABLE public.tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tool_calls all" ON public.tool_calls FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budgets
CREATE TABLE public.ai_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_token_cap integer,
  monthly_token_cap integer,
  daily_usd_cap numeric(10,2),
  monthly_usd_cap numeric(10,2),
  daily_tokens_used integer NOT NULL DEFAULT 0,
  monthly_tokens_used integer NOT NULL DEFAULT 0,
  daily_usd_used numeric(10,4) NOT NULL DEFAULT 0,
  monthly_usd_used numeric(10,4) NOT NULL DEFAULT 0,
  day_window date NOT NULL DEFAULT CURRENT_DATE,
  month_window date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  alert_at_pct integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_budgets all" ON public.ai_budgets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Eval suites + cases + runs
CREATE TABLE public.eval_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  surface text,
  built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eval_suites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own eval_suites all" ON public.eval_suites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.eval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  input text NOT NULL,
  expected text,
  assertions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eval_cases_suite_idx ON public.eval_cases (suite_id);
ALTER TABLE public.eval_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own eval_cases all" ON public.eval_cases FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id uuid NOT NULL,
  user_id uuid NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  pass_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  avg_score numeric(4,3),
  total_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own eval_runs all" ON public.eval_runs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.eval_case_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  case_id uuid NOT NULL,
  user_id uuid NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  actual text,
  score numeric(4,3),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eval_case_results_run_idx ON public.eval_case_results (run_id);
ALTER TABLE public.eval_case_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own eval_case_results all" ON public.eval_case_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Scheduler proposals (calendar agent → user picks slot)
CREATE TABLE public.scheduler_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen_slot jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | dismissed
  source_kind text,                   -- task | prd | manual
  source_id uuid,
  calendar_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scheduler_proposals_user_idx ON public.scheduler_proposals (user_id, created_at DESC);
ALTER TABLE public.scheduler_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduler_proposals all" ON public.scheduler_proposals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed built-in guardrail rules for new users via trigger on profiles
CREATE OR REPLACE FUNCTION public.seed_default_guardrails(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.guardrail_rules (user_id, name, kind, pattern, action, applies_to, built_in) VALUES
    (_user_id, 'Prompt injection — ignore instructions', 'injection', '(?i)ignore (all )?(previous|prior) (instructions|prompts)', 'warn', 'input', true),
    (_user_id, 'Prompt injection — system role', 'injection', '(?i)\bsystem\s*:\s*', 'warn', 'input', true),
    (_user_id, 'Prompt injection — reveal system prompt', 'injection', '(?i)(reveal|show|print).{0,20}(system|developer) prompt', 'block', 'input', true),
    (_user_id, 'PII — email address', 'pii', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'warn', 'both', true),
    (_user_id, 'PII — phone number', 'pii', '\+?\d[\d\s().-]{8,}\d', 'warn', 'both', true),
    (_user_id, 'PII — credit card', 'pii', '\b(?:\d[ -]*?){13,16}\b', 'redact', 'both', true),
    (_user_id, 'Secret leak — sk- API key', 'secret', 'sk-[A-Za-z0-9]{20,}', 'redact', 'both', true),
    (_user_id, 'Secret leak — Bearer token', 'secret', '(?i)bearer\s+[A-Za-z0-9._-]{20,}', 'redact', 'both', true),
    (_user_id, 'Secret leak — AWS access key', 'secret', 'AKIA[0-9A-Z]{16}', 'block', 'both', true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Update handle_new_user to also seed guardrails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  full_n text := NULLIF(meta->>'full_name', '');
  display_n text := COALESCE(NULLIF(meta->>'display_name', ''), full_n);
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name)
  VALUES (NEW.id, full_n, display_n)
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.seed_default_agents(NEW.id);
  PERFORM public.seed_default_guardrails(NEW.id);
  RETURN NEW;
END;
$$;

-- Updated-at triggers
CREATE TRIGGER ai_evals_touch_updated_at
  BEFORE UPDATE ON public.ai_evals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ai_budgets_touch_updated_at
  BEFORE UPDATE ON public.ai_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

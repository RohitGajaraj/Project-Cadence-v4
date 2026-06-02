
CREATE TABLE public.agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  mode text NOT NULL DEFAULT 'confirm' CHECK (mode IN ('auto','confirm','review','off')),
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tools TO authenticated;
GRANT ALL ON public.agent_tools TO service_role;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent_tools all" ON public.agent_tools FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_tools_set_updated_at BEFORE UPDATE ON public.agent_tools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  agent_slug text,
  scope text NOT NULL DEFAULT 'global',
  kind text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  importance integer NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memory TO authenticated;
GRANT ALL ON public.agent_memory TO service_role;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent_memory all" ON public.agent_memory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX agent_memory_user_agent_idx ON public.agent_memory (user_id, agent_slug);
CREATE INDEX agent_memory_embedding_hnsw ON public.agent_memory USING hnsw (embedding vector_cosine_ops);
CREATE TRIGGER agent_memory_set_updated_at BEFORE UPDATE ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  agent_slug text,
  trace_id uuid,
  tool_name text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed','cancelled','expired')),
  decided_at timestamptz,
  decided_by uuid,
  result jsonb,
  error text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_approvals TO authenticated;
GRANT ALL ON public.agent_approvals TO service_role;
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent_approvals all" ON public.agent_approvals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX agent_approvals_user_status_idx ON public.agent_approvals (user_id, status, created_at DESC);
CREATE TRIGGER agent_approvals_set_updated_at BEFORE UPDATE ON public.agent_approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text DEFAULT NULL,
  match_count integer DEFAULT 6
) RETURNS TABLE (
  id uuid, content text, kind text, importance integer,
  agent_slug text, similarity double precision
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.user_id = auth.uid()
    AND m.embedding IS NOT NULL
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
REVOKE EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'workspace.search', 'Search workspace', 'Semantic search across docs, PRDs, notes, signals, meetings.', 'read', 'auto', true),
    (_user_id, 'workspace.list_tasks','List tasks', 'List open tasks with optional filter.', 'read', 'auto', true),
    (_user_id, 'tasks.create', 'Create task', 'Create a task in the current workspace.', 'write', 'confirm', true),
    (_user_id, 'tasks.update_status','Update task status', 'Mark a task as todo, in_progress, or done.', 'write', 'confirm', true),
    (_user_id, 'signals.log', 'Log signal', 'Log a discovery signal.', 'write', 'confirm', true),
    (_user_id, 'notes.create', 'Create note', 'Save a note in the workspace.', 'write', 'confirm', true),
    (_user_id, 'memory.remember', 'Remember', 'Store a long-term memory for the agent.', 'memory', 'auto', true),
    (_user_id, 'scheduler.propose', 'Propose meeting slots','Propose calendar slots for a meeting (no booking).', 'planning','confirm', true),
    (_user_id, 'calendar.create', 'Create calendar event','Create a calendar event after slot is chosen.', 'write', 'review', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_default_agent_tools(uuid) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surface text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  active_version_id uuid,
  default_version_id uuid,
  built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surface, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_templates TO authenticated;
GRANT ALL ON public.prompt_templates TO service_role;

CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  system_prompt text NOT NULL DEFAULT '',
  user_template text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  temperature numeric,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_versions TO authenticated;
GRANT ALL ON public.prompt_versions TO service_role;

CREATE TABLE public.prompt_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
  variant_a_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  variant_b_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  split_pct integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_assignments TO authenticated;
GRANT ALL ON public.prompt_assignments TO service_role;

CREATE TABLE public.prompt_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
  version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  event_id uuid,
  variant text,
  rendered_input text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_runs TO authenticated;
GRANT ALL ON public.prompt_runs TO service_role;

CREATE INDEX idx_prompt_versions_template ON public.prompt_versions(template_id, version DESC);
CREATE INDEX idx_prompt_runs_template ON public.prompt_runs(template_id, created_at DESC);
CREATE INDEX idx_prompt_runs_event ON public.prompt_runs(event_id);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prompt_templates all" ON public.prompt_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prompt_versions all" ON public.prompt_versions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prompt_assignments all" ON public.prompt_assignments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prompt_runs all" ON public.prompt_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_prompt_templates_updated BEFORE UPDATE ON public.prompt_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prompt_versions_updated BEFORE UPDATE ON public.prompt_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prompt_assignments_updated BEFORE UPDATE ON public.prompt_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_default_prompt_templates(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t_id uuid;
  v_id uuid;
  tpl record;
BEGIN
  FOR tpl IN
    SELECT * FROM (VALUES
      ('chat','default','Chat — default','Conversational assistant baseline prompt.','You are Cadence, a calm, terse AI product co-pilot. Be concise, structured, and helpful.'),
      ('copilot','daily_brief','Copilot — daily brief','Daily focus brief generator.','You synthesize the user''s day into a 5-line brief.'),
      ('discovery','theme_cluster','Discovery — theme cluster','Clusters signals into themes.','You cluster discovery signals into themes.'),
      ('meetings','summarize','Meetings — summarize','Meeting summary + decisions + actions.','You summarize meetings.'),
      ('roadmap','prd_generate','Roadmap — generate PRD','Generate a PRD from an opportunity.','You are a senior PM. Write a crisp PRD.'),
      ('studio','prototype','Studio — prototype','Generate prototype HTML/CSS/JS.','You generate small prototypes.'),
      ('agent','planner_executor','Agent — planner/executor','Tool-using agent loop prompt.','You are a planning agent.')
    ) AS x(surface,key,name,description,system_prompt)
  LOOP
    INSERT INTO public.prompt_templates(user_id, surface, key, name, description, built_in)
    VALUES (_user_id, tpl.surface, tpl.key, tpl.name, tpl.description, true)
    ON CONFLICT (user_id, surface, key) DO NOTHING
    RETURNING id INTO t_id;
    IF t_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.prompt_versions(template_id, user_id, version, system_prompt, status, created_by)
    VALUES (t_id, _user_id, 1, tpl.system_prompt, 'published', _user_id)
    RETURNING id INTO v_id;
    UPDATE public.prompt_templates SET active_version_id = v_id, default_version_id = v_id WHERE id = t_id;
    INSERT INTO public.prompt_assignments(user_id, template_id, variant_a_version_id, split_pct, enabled)
    VALUES (_user_id, t_id, v_id, 100, true)
    ON CONFLICT (user_id, template_id) DO NOTHING;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_default_prompt_templates(uuid) FROM PUBLIC, anon, authenticated;

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
CREATE TRIGGER eval_suites_updated_at BEFORE UPDATE ON public.eval_suites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER eval_cases_updated_at BEFORE UPDATE ON public.eval_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drift_snapshots TO authenticated;
GRANT ALL ON public.drift_snapshots TO service_role;
CREATE INDEX drift_snapshots_user_date_idx ON public.drift_snapshots (user_id, bucket_date DESC);
ALTER TABLE public.drift_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drift_snapshots all" ON public.drift_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER drift_snapshots_set_updated_at BEFORE UPDATE ON public.drift_snapshots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drift_baselines TO authenticated;
GRANT ALL ON public.drift_baselines TO service_role;
ALTER TABLE public.drift_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drift_baselines all" ON public.drift_baselines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER drift_baselines_set_updated_at BEFORE UPDATE ON public.drift_baselines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drift_incidents TO authenticated;
GRANT ALL ON public.drift_incidents TO service_role;
CREATE INDEX drift_incidents_user_status_idx ON public.drift_incidents (user_id, status, detected_at DESC);
ALTER TABLE public.drift_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drift_incidents all" ON public.drift_incidents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER drift_incidents_set_updated_at BEFORE UPDATE ON public.drift_incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_surface_budgets TO authenticated;
GRANT ALL ON public.ai_surface_budgets TO service_role;
ALTER TABLE public.ai_surface_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_surface_budgets all" ON public.ai_surface_budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ai_surface_budgets_set_updated_at BEFORE UPDATE ON public.ai_surface_budgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_budget_alerts TO authenticated;
GRANT ALL ON public.ai_budget_alerts TO service_role;
CREATE INDEX ai_budget_alerts_user_idx ON public.ai_budget_alerts (user_id, created_at DESC);
ALTER TABLE public.ai_budget_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_budget_alerts all" ON public.ai_budget_alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.artifact_lineage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_kind TEXT NOT NULL,
  parent_id UUID NOT NULL,
  child_kind TEXT NOT NULL,
  child_id UUID NOT NULL,
  relation TEXT NOT NULL DEFAULT 'promoted',
  rationale TEXT,
  created_by_agent TEXT,
  ai_event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, parent_kind, parent_id, child_kind, child_id, relation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_lineage TO authenticated;
GRANT ALL ON public.artifact_lineage TO service_role;
CREATE INDEX idx_lineage_parent ON public.artifact_lineage (user_id, parent_kind, parent_id);
CREATE INDEX idx_lineage_child  ON public.artifact_lineage (user_id, child_kind,  child_id);
ALTER TABLE public.artifact_lineage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact_lineage all" ON public.artifact_lineage FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unified new-user handler (final form)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  PERFORM public.seed_default_agent_tools(NEW.id);
  PERFORM public.seed_default_prompt_templates(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

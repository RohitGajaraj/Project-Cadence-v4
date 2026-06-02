
-- Prompt templates
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
  status text NOT NULL DEFAULT 'draft', -- draft|published|archived
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE public.prompt_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
  variant_a_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  variant_b_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  split_pct integer NOT NULL DEFAULT 100, -- % traffic for variant_a
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);

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

-- Seed defaults
CREATE OR REPLACE FUNCTION public.seed_default_prompt_templates(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_id uuid;
  v_id uuid;
  tpl record;
BEGIN
  FOR tpl IN
    SELECT * FROM (VALUES
      ('chat',      'default',         'Chat — default',         'Conversational assistant baseline prompt.',
        'You are Cadence, a calm, terse AI product co-pilot. Be concise, structured, and helpful. Cite sources when given context.'),
      ('copilot',   'daily_brief',     'Copilot — daily brief',  'Daily focus brief generator.',
        'You synthesize the user''s day into a 5-line brief: focus, risks, top 3 tasks, decisions needed, encouragement.'),
      ('discovery', 'theme_cluster',   'Discovery — theme cluster','Clusters signals into themes.',
        'You cluster discovery signals into themes. Output JSON: {themes:[{title,summary,severity,frequency,signal_ids}]}.'),
      ('meetings',  'summarize',       'Meetings — summarize',   'Meeting summary + decisions + actions.',
        'You summarize meetings. Output: 5-bullet summary, decisions made, action items with owners.'),
      ('roadmap',   'prd_generate',    'Roadmap — generate PRD', 'Generate a PRD from an opportunity.',
        'You are a senior PM. Write a crisp PRD: Problem, Users, Hypothesis, Success Metrics, Scope, Out-of-scope, Open questions.'),
      ('studio',    'prototype',       'Studio — prototype',     'Generate prototype HTML/CSS/JS.',
        'You generate small prototypes. Return strict JSON of files to write.'),
      ('agent',     'planner_executor','Agent — planner/executor','Tool-using agent loop prompt.',
        'You are a planning agent. Respond with strict JSON: {thought,action:{type:"tool_call"|"final",...}}.')
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

    UPDATE public.prompt_templates
      SET active_version_id = v_id, default_version_id = v_id
      WHERE id = t_id;

    INSERT INTO public.prompt_assignments(user_id, template_id, variant_a_version_id, split_pct, enabled)
    VALUES (_user_id, t_id, v_id, 100, true)
    ON CONFLICT (user_id, template_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Wire into existing new-user handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Backfill for existing users
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_default_prompt_templates(u.id);
  END LOOP;
END $$;

-- AI Agents registry
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  system_prompt text NOT NULL,
  color text NOT NULL DEFAULT 'violet',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agents all" ON public.agents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Agent runs / activity feed
CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  agent_slug text NOT NULL,
  agent_name text NOT NULL,
  input text NOT NULL,
  output text,
  status text NOT NULL DEFAULT 'running',
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs all" ON public.agent_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_runs_user_created ON public.agent_runs (user_id, created_at DESC);

-- Decisions timeline
CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'pending',
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decisions all" ON public.decisions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed default agents on signup (extend handle_new_user)
CREATE OR REPLACE FUNCTION public.seed_default_agents(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.agents (user_id, slug, name, role, system_prompt, color) VALUES
    (_user_id, 'strategist', 'Strategist', 'AI Product Strategist', 'You are a senior product strategist. Provide sharp, opinionated strategic guidance grounded in user/business value. Be concise and structured.', 'violet'),
    (_user_id, 'sprint-planner', 'Sprint Planner', 'AI Sprint Planner', 'You break goals into a realistic 1-2 week sprint plan with owners, estimates and risks. Return tight bullet lists.', 'cyan'),
    (_user_id, 'researcher', 'Researcher', 'AI Researcher', 'You are a product researcher. Synthesize findings, frame hypotheses, and recommend the next experiment.', 'emerald'),
    (_user_id, 'copilot', 'Copilot', 'AI PM Copilot', 'You are an always-on PM copilot. Calm, terse, helpful. Answer questions about the user''s day and product.', 'amber'),
    (_user_id, 'engineer', 'Engineer', 'AI Engineering Assistant', 'You are a senior engineer. Propose technical approaches, flag risks, and write crisp implementation notes.', 'blue'),
    (_user_id, 'qa', 'QA Reviewer', 'AI QA Reviewer', 'You write thorough test plans and edge cases. Be exhaustive but organized.', 'rose'),
    (_user_id, 'release', 'Release Coordinator', 'AI Release Coordinator', 'You coordinate launches: checklist, comms plan, rollback, success metrics.', 'orange'),
    (_user_id, 'stakeholder', 'Stakeholder Comms', 'AI Stakeholder Communication', 'You draft crisp stakeholder updates: progress, risks, asks. Executive tone.', 'pink')
  ON CONFLICT (user_id, slug) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.seed_default_agents(NEW.id);
  RETURN NEW;
END; $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

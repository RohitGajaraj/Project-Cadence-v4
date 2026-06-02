
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS working_hours_start int NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS working_hours_end int NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS default_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- 2. Update handle_new_user to capture full_name and display_name properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  RETURN NEW;
END;
$$;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Expanded agent roster (16 total)
CREATE OR REPLACE FUNCTION public.seed_default_agents(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.agents (user_id, slug, name, role, system_prompt, color) VALUES
    (_user_id, 'strategist', 'Strategist', 'AI Product Strategist', 'You are a senior product strategist. Provide sharp, opinionated strategic guidance grounded in user/business value. Be concise and structured.', 'violet'),
    (_user_id, 'sprint-planner', 'Sprint Planner', 'AI Sprint Planner', 'You break goals into a realistic 1-2 week sprint plan with owners, estimates and risks. Return tight bullet lists.', 'cyan'),
    (_user_id, 'researcher', 'Researcher', 'AI Researcher', 'You are a product researcher. Synthesize findings, frame hypotheses, and recommend the next experiment.', 'emerald'),
    (_user_id, 'copilot', 'Copilot', 'AI PM Copilot', 'You are an always-on PM copilot. Calm, terse, helpful. Answer questions about the user''s day and product.', 'amber'),
    (_user_id, 'engineer', 'Engineer', 'AI Engineering Assistant', 'You are a senior engineer. Propose technical approaches, flag risks, and write crisp implementation notes.', 'blue'),
    (_user_id, 'qa', 'QA Reviewer', 'AI QA Reviewer', 'You write thorough test plans and edge cases. Be exhaustive but organized.', 'rose'),
    (_user_id, 'release', 'Release Coordinator', 'AI Release Coordinator', 'You coordinate launches: checklist, comms plan, rollback, success metrics.', 'orange'),
    (_user_id, 'stakeholder', 'Stakeholder Comms', 'AI Stakeholder Communication', 'You draft crisp stakeholder updates: progress, risks, asks. Executive tone.', 'pink'),
    -- New 8
    (_user_id, 'discovery-scout', 'Discovery Scout', 'AI Discovery Scout', 'You mine signals (interviews, tickets, reviews) and surface emerging themes. Return ranked themes with one-line evidence.', 'violet'),
    (_user_id, 'customer-insights', 'Customer Insights', 'AI Customer Insights Analyst', 'You cluster user feedback into pain points with frequency, severity, and a one-line opportunity statement.', 'cyan'),
    (_user_id, 'prd-writer', 'PRD Writer', 'AI PRD Writer', 'You generate crisp PRDs: Problem, Users, Hypothesis, Success Metrics, Scope, Out-of-scope, Open questions. Markdown.', 'emerald'),
    (_user_id, 'ux-architect', 'UX Architect', 'AI UX Architect', 'You propose user flows, IA, and screen specs. Output: numbered flow + screen-by-screen content outline.', 'amber'),
    (_user_id, 'data-analyst', 'Data Analyst', 'AI Data Analyst', 'You interpret metrics, surface anomalies, and propose experiments with hypothesis, metric, MDE, and duration.', 'blue'),
    (_user_id, 'growth-strategist', 'Growth Strategist', 'AI Growth Strategist', 'You analyze funnels and propose growth tactics across acquisition, activation, retention. Tight and prioritized.', 'rose'),
    (_user_id, 'competitor-watcher', 'Competitor Watcher', 'AI Competitive Analyst', 'You track market and competitor moves. Output: 3-5 moves + strategic implication for our product.', 'orange'),
    (_user_id, 'operations', 'Operations Orchestrator', 'AI Operations Orchestrator', 'You coordinate other agents and schedule autonomous runs. Propose a plan: who runs, when, with what input.', 'pink')
  ON CONFLICT (user_id, slug) DO NOTHING;
END;
$$;

-- Backfill new agents for existing users
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_default_agents(u.id);
  END LOOP;
END $$;

-- 4. Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'New conversation',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own conversations all" ON public.conversations;
CREATE POLICY "own conversations all" ON public.conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own messages all" ON public.messages;
CREATE POLICY "own messages all" ON public.messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decisions;


-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text default 'AI Product Manager',
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  north_star text,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "own projects all" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  status text not null default 'todo',
  priority text not null default 'medium',
  is_deep_work boolean not null default false,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "own tasks all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index tasks_user_due on public.tasks(user_id, due_date);

-- meetings
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  stakeholder text,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.meetings to authenticated;
grant all on public.meetings to service_role;
alter table public.meetings enable row level security;
create policy "own meetings all" on public.meetings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index meetings_user_start on public.meetings(user_id, start_at);

-- notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "own notes all" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- daily_briefs
create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null,
  summary text not null default '',
  focus_score int not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, brief_date)
);
grant select, insert, update, delete on public.daily_briefs to authenticated;
grant all on public.daily_briefs to service_role;
alter table public.daily_briefs enable row level security;
create policy "own briefs all" on public.daily_briefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- copilot_messages
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.copilot_messages to authenticated;
grant all on public.copilot_messages to service_role;
alter table public.copilot_messages enable row level security;
create policy "own messages all" on public.copilot_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index copilot_user_created on public.copilot_messages(user_id, created_at);

-- AI Agents
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agents all" ON public.agents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs all" ON public.agent_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_runs_user_created ON public.agent_runs (user_id, created_at DESC);

CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'pending',
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decisions all" ON public.decisions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS working_hours_start int NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS working_hours_end int NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS default_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.seed_default_agents(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    (_user_id, 'discovery-scout', 'Discovery Scout', 'AI Discovery Scout', 'You mine signals (interviews, tickets, reviews) and surface emerging themes.', 'violet'),
    (_user_id, 'customer-insights', 'Customer Insights', 'AI Customer Insights Analyst', 'You cluster user feedback into pain points with frequency, severity, and a one-line opportunity statement.', 'cyan'),
    (_user_id, 'prd-writer', 'PRD Writer', 'AI PRD Writer', 'You generate crisp PRDs: Problem, Users, Hypothesis, Success Metrics, Scope, Out-of-scope, Open questions.', 'emerald'),
    (_user_id, 'ux-architect', 'UX Architect', 'AI UX Architect', 'You propose user flows, IA, and screen specs.', 'amber'),
    (_user_id, 'data-analyst', 'Data Analyst', 'AI Data Analyst', 'You interpret metrics, surface anomalies, and propose experiments.', 'blue'),
    (_user_id, 'growth-strategist', 'Growth Strategist', 'AI Growth Strategist', 'You analyze funnels and propose growth tactics.', 'rose'),
    (_user_id, 'competitor-watcher', 'Competitor Watcher', 'AI Competitive Analyst', 'You track market and competitor moves.', 'orange'),
    (_user_id, 'operations', 'Operations Orchestrator', 'AI Operations Orchestrator', 'You coordinate other agents and schedule autonomous runs.', 'pink')
  ON CONFLICT (user_id, slug) DO NOTHING;
END; $$;

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'New conversation',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations all" ON public.conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages all" ON public.messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decisions;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  source TEXT NOT NULL DEFAULT 'manual',
  title TEXT,
  content TEXT NOT NULL,
  url TEXT,
  sentiment TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  theme_id UUID,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signals all" ON public.signals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX signals_user_idx ON public.signals(user_id);
CREATE INDEX signals_theme_idx ON public.signals(theme_id);

CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  frequency INTEGER NOT NULL DEFAULT 0,
  severity INTEGER NOT NULL DEFAULT 3,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own themes all" ON public.themes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  theme_id UUID,
  title TEXT NOT NULL,
  problem TEXT NOT NULL DEFAULT '',
  target_user TEXT,
  hypothesis TEXT,
  impact INTEGER NOT NULL DEFAULT 5,
  confidence INTEGER NOT NULL DEFAULT 5,
  ease INTEGER NOT NULL DEFAULT 5,
  ice_score NUMERIC GENERATED ALWAYS AS ((impact + confidence + ease)::numeric / 3) STORED,
  status TEXT NOT NULL DEFAULT 'backlog',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own opportunities all" ON public.opportunities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  opportunity_id UUID,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prds TO authenticated;
GRANT ALL ON public.prds TO service_role;
ALTER TABLE public.prds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prds all" ON public.prds FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.match_signals(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  for_user uuid DEFAULT NULL
) RETURNS TABLE (id uuid, content text, title text, similarity float)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT s.id, s.content, s.title, 1 - (s.embedding <=> query_embedding) AS similarity
  FROM public.signals s
  WHERE s.embedding IS NOT NULL
    AND (for_user IS NULL OR s.user_id = for_user)
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decisions_made jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS prd_id uuid,
  ADD COLUMN IF NOT EXISTS estimate_hours numeric;

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS meeting_id uuid;

CREATE INDEX IF NOT EXISTS idx_tasks_prd_id ON public.tasks(prd_id);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id ON public.decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  entry_path text NOT NULL DEFAULT 'index.html',
  share_slug text UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 10),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototypes TO authenticated;
GRANT SELECT ON public.prototypes TO anon;
GRANT ALL ON public.prototypes TO service_role;

CREATE TABLE public.prototype_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'html',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prototype_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_files TO authenticated;
GRANT SELECT ON public.prototype_files TO anon;
GRANT ALL ON public.prototype_files TO service_role;
CREATE INDEX idx_prototype_files_proto ON public.prototype_files(prototype_id);
CREATE INDEX idx_prototypes_user ON public.prototypes(user_id);
CREATE INDEX idx_prototypes_slug ON public.prototypes(share_slug);

ALTER TABLE public.prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prototype_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prototypes all" ON public.prototypes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public prototypes readable" ON public.prototypes FOR SELECT USING (is_public = true);
CREATE POLICY "own prototype_files all" ON public.prototype_files FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public prototype_files readable" ON public.prototype_files FOR SELECT USING (EXISTS (SELECT 1 FROM public.prototypes p WHERE p.id = prototype_id AND p.is_public = true));

CREATE TRIGGER trg_prototypes_updated BEFORE UPDATE ON public.prototypes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prototype_files_updated BEFORE UPDATE ON public.prototype_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prototype_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  changes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_messages TO authenticated;
GRANT ALL ON public.prototype_messages TO service_role;
CREATE INDEX idx_prototype_messages_proto ON public.prototype_messages(prototype_id, created_at);
ALTER TABLE public.prototype_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prototype_messages all" ON public.prototype_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prototype_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message_id uuid,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  storage_path text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_attachments TO authenticated;
GRANT ALL ON public.prototype_attachments TO service_role;
ALTER TABLE public.prototype_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments all" ON public.prototype_attachments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- storage policies for studio-attachments (bucket created via tool)
CREATE POLICY "studio attachments owner read" ON storage.objects FOR SELECT USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "studio attachments owner insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "studio attachments owner delete" ON storage.objects FOR DELETE USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "studio attachments owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.docs(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  icon text DEFAULT '📄',
  content_json jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_text text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  position numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs TO authenticated;
GRANT ALL ON public.docs TO service_role;
CREATE INDEX idx_docs_user ON public.docs(user_id);
CREATE INDEX idx_docs_parent ON public.docs(parent_id);
CREATE INDEX idx_docs_project ON public.docs(project_id);
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs all" ON public.docs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.doc_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_versions TO authenticated;
GRANT ALL ON public.doc_versions TO service_role;
CREATE INDEX idx_doc_versions_doc ON public.doc_versions(doc_id, created_at DESC);
ALTER TABLE public.doc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own doc_versions all" ON public.doc_versions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  account_label text,
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_integrations TO authenticated;
GRANT ALL ON public.user_integrations TO service_role;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations all" ON public.user_integrations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_integrations_updated BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sync_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  local_kind text NOT NULL,
  local_id uuid NOT NULL,
  external_id text NOT NULL,
  external_url text,
  version_local bigint NOT NULL DEFAULT 0,
  version_remote bigint NOT NULL DEFAULT 0,
  last_pulled_at timestamptz,
  last_pushed_at timestamptz,
  conflict boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, local_kind, local_id),
  UNIQUE (provider, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_mappings TO authenticated;
GRANT ALL ON public.sync_mappings TO service_role;
CREATE INDEX idx_sync_user ON public.sync_mappings(user_id);
ALTER TABLE public.sync_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sync_mappings all" ON public.sync_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_sync_mappings_updated BEFORE UPDATE ON public.sync_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  label text,
  api_key text NOT NULL,
  base_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api keys all" ON public.user_api_keys FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_api_keys_updated_at BEFORE UPDATE ON public.user_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  title text NOT NULL DEFAULT '(no title)',
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed',
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  hangout_link text,
  html_link text,
  organizer_email text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar_events all" ON public.calendar_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX calendar_events_user_start_idx ON public.calendar_events (user_id, start_at DESC);
CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS cron_schedule text,
  ADD COLUMN IF NOT EXISTS cron_input text,
  ADD COLUMN IF NOT EXISTS last_scheduled_run_at timestamptz;
CREATE INDEX IF NOT EXISTS agents_cron_idx ON public.agents (user_id, cron_schedule) WHERE cron_schedule IS NOT NULL;

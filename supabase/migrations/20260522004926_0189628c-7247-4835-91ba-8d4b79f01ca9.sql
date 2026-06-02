-- agent_tools: which tools each user has enabled, and how they execute
CREATE TABLE IF NOT EXISTS public.agent_tools (
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
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own agent_tools all" ON public.agent_tools;
CREATE POLICY "own agent_tools all" ON public.agent_tools
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS agent_tools_set_updated_at ON public.agent_tools;
CREATE TRIGGER agent_tools_set_updated_at BEFORE UPDATE ON public.agent_tools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- agent_memory: long-term memory with optional embedding
CREATE TABLE IF NOT EXISTS public.agent_memory (
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
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own agent_memory all" ON public.agent_memory;
CREATE POLICY "own agent_memory all" ON public.agent_memory
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS agent_memory_user_agent_idx ON public.agent_memory (user_id, agent_slug);
CREATE INDEX IF NOT EXISTS agent_memory_embedding_hnsw
  ON public.agent_memory USING hnsw (embedding vector_cosine_ops);
DROP TRIGGER IF EXISTS agent_memory_set_updated_at ON public.agent_memory;
CREATE TRIGGER agent_memory_set_updated_at BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- agent_approvals: human-in-the-loop queue
CREATE TABLE IF NOT EXISTS public.agent_approvals (
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
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own agent_approvals all" ON public.agent_approvals;
CREATE POLICY "own agent_approvals all" ON public.agent_approvals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS agent_approvals_user_status_idx
  ON public.agent_approvals (user_id, status, created_at DESC);
DROP TRIGGER IF EXISTS agent_approvals_set_updated_at ON public.agent_approvals;
CREATE TRIGGER agent_approvals_set_updated_at BEFORE UPDATE ON public.agent_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Match function for memory recall
CREATE OR REPLACE FUNCTION public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text DEFAULT NULL,
  match_count integer DEFAULT 6
) RETURNS TABLE (
  id uuid, content text, kind text, importance integer,
  agent_slug text, similarity double precision
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.user_id = for_user
    AND m.embedding IS NOT NULL
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Seed default tools for a user
CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'workspace.search',  'Search workspace',   'Semantic search across docs, PRDs, notes, signals, meetings.', 'read',    'auto',    true),
    (_user_id, 'workspace.list_tasks','List tasks',       'List open tasks with optional filter.',                         'read',    'auto',    true),
    (_user_id, 'tasks.create',      'Create task',        'Create a task in the current workspace.',                       'write',   'confirm', true),
    (_user_id, 'tasks.update_status','Update task status','Mark a task as todo, in_progress, or done.',                    'write',   'confirm', true),
    (_user_id, 'signals.log',       'Log signal',         'Log a discovery signal (user feedback, support, interview).',   'write',   'confirm', true),
    (_user_id, 'notes.create',      'Create note',        'Save a note in the workspace.',                                 'write',   'confirm', true),
    (_user_id, 'memory.remember',   'Remember',           'Store a long-term memory for the agent.',                       'memory',  'auto',    true),
    (_user_id, 'scheduler.propose', 'Propose meeting slots','Propose calendar slots for a meeting (no booking).',          'planning','confirm', true),
    (_user_id, 'calendar.create',   'Create calendar event','Create a calendar event after slot is chosen.',               'write',   'review',  true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
END $$;

-- Update handle_new_user to also seed tools
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  RETURN NEW;
END;
$$;

-- Seed tools for any existing users that don't have them yet
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_default_agent_tools(u.id);
  END LOOP;
END $$;
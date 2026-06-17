CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  rate_limit_per_min INTEGER DEFAULT 60,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  revoked_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(workspace_id, slug),
  UNIQUE(workspace_id, secret_hash)
);
GRANT SELECT ON public.mcp_tokens TO authenticated;
GRANT ALL ON public.mcp_tokens TO service_role;
ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcp_tokens_workspace_read ON public.mcp_tokens;
CREATE POLICY mcp_tokens_workspace_read ON public.mcp_tokens
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS mcp_tokens_service_only_write ON public.mcp_tokens;
CREATE POLICY mcp_tokens_service_only_write ON public.mcp_tokens FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS mcp_tokens_service_only_update ON public.mcp_tokens;
CREATE POLICY mcp_tokens_service_only_update ON public.mcp_tokens FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS mcp_tokens_service_only_delete ON public.mcp_tokens;
CREATE POLICY mcp_tokens_service_only_delete ON public.mcp_tokens FOR DELETE TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_workspace ON public.mcp_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON public.mcp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_revoked ON public.mcp_tokens(revoked_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.mcp_tokens(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  result VARCHAR(20) NOT NULL DEFAULT 'unknown',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now()
);
GRANT SELECT ON public.api_calls TO authenticated;
GRANT ALL ON public.api_calls TO service_role;
ALTER TABLE public.api_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_calls_workspace_read ON public.api_calls;
CREATE POLICY api_calls_workspace_read ON public.api_calls
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS api_calls_service_only_write ON public.api_calls;
CREATE POLICY api_calls_service_only_write ON public.api_calls FOR INSERT TO authenticated WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_api_calls_token ON public.api_calls(token_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_workspace ON public.api_calls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_created ON public.api_calls(created_at DESC);

CREATE OR REPLACE FUNCTION public.issue_mcp_token(
  _workspace_id UUID, _user_id UUID, _slug TEXT, _secret_hash TEXT, _rate_limit_per_min INTEGER DEFAULT 60
) RETURNS public.mcp_tokens AS $$
DECLARE token public.mcp_tokens;
BEGIN
  INSERT INTO public.mcp_tokens (workspace_id, user_id, slug, secret_hash, rate_limit_per_min)
  VALUES (_workspace_id, _user_id, _slug, _secret_hash, _rate_limit_per_min)
  RETURNING * INTO token;
  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.issue_mcp_token FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.revoke_mcp_token(_token_id UUID) RETURNS void AS $$
BEGIN
  UPDATE public.mcp_tokens SET revoked_at = now() WHERE id = _token_id AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.revoke_mcp_token FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_api_call(
  _token_id UUID, _workspace_id UUID, _tool_name TEXT, _input_tokens INTEGER, _output_tokens INTEGER,
  _cost_usd DECIMAL, _result VARCHAR, _error_message TEXT DEFAULT NULL, _metadata JSONB DEFAULT NULL
) RETURNS public.api_calls AS $$
DECLARE call public.api_calls;
BEGIN
  INSERT INTO public.api_calls (token_id, workspace_id, tool_name, input_tokens, output_tokens, cost_usd, result, error_message, metadata)
  VALUES (_token_id, _workspace_id, _tool_name, _input_tokens, _output_tokens, _cost_usd, _result, _error_message, COALESCE(_metadata, '{}'::jsonb))
  RETURNING * INTO call;
  RETURN call;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.log_api_call FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'workspace.search',     'Search workspace', 'Semantic search across docs, PRDs, notes, signals, meetings.', 'read',     'auto',    true),
    (_user_id, 'workspace.list_tasks', 'List tasks',       'List open tasks with optional filter.',                          'read',     'auto',    true),
    (_user_id, 'tasks.create',         'Create task',      'Create a task in the workspace.',                                'write',    'confirm', true),
    (_user_id, 'tasks.update_status',  'Update task',      'Change a task status.',                                          'write',    'confirm', true),
    (_user_id, 'signals.log',          'Log signal',       'Log a discovery signal.',                                        'write',    'confirm', true),
    (_user_id, 'notes.create',         'Save note',        'Save a free-form note.',                                         'write',    'confirm', true),
    (_user_id, 'memory.remember',      'Remember',         'Save a long-term memory.',                                       'memory',   'auto',    true),
    (_user_id, 'scheduler.propose',    'Propose slots',    'Generate calendar slot proposals.',                              'planning', 'auto',    true),
    (_user_id, 'calendar.create',      'Create event',     'Create a calendar event.',                                       'write',    'confirm', true),
    (_user_id, 'github.issue.create',  'Open GitHub issue','Open a GitHub issue on the connected product repo. Idempotent via idempotency_key.', 'write', 'confirm', true),
    (_user_id, 'agent.handoff',        'Hand off to agent','Pass the current mission to another specialist agent with a structured payload (task + context + artifacts).', 'write', 'confirm', true),
    (_user_id, 'web.search',           'Search the web',   'Search the public internet and return ranked results (url, title, snippet). Cheap recon.', 'read', 'auto',    true),
    (_user_id, 'web.fetch',            'Fetch a web page', 'Fetch a single URL and return its main content as markdown.',                              'read', 'auto',    true),
    (_user_id, 'web.map',              'Map a domain',     'Discover URLs on a domain. Use before web.crawl.',                                          'read', 'auto',    true),
    (_user_id, 'web.crawl',            'Crawl a domain',   'Bounded crawl of a domain (max 25 pages, depth 2). Spends real credits.',                   'read', 'confirm', true),
    (_user_id, 'critic.evaluate',      'Critic review',    'Adversarially red-team an opportunity or PRD before a human approves it. Persists a ship/revise/kill verdict with risks, kill-criteria, and missing evidence on the row. The verdict is advisory.', 'planning', 'auto', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
  PERFORM public.seed_pm_lifecycle_tools(_user_id);
END $function$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_default_agent_tools(r.id);
  END LOOP;
END $$;
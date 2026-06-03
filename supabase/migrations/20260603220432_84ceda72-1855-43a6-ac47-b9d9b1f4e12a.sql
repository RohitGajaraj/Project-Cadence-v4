-- Add PM-centric lifecycle tools to the default seed and backfill existing users.
CREATE OR REPLACE FUNCTION public.seed_pm_lifecycle_tools(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'research.synthesize', 'Synthesize research', 'Cluster recent signals into themes and link them. Discover stage.', 'write', 'confirm', true),
    (_user_id, 'prd.draft',           'Draft PRD',           'Draft a structured PRD from an opportunity (problem, goals, stories, metrics).', 'write', 'confirm', true),
    (_user_id, 'backlog.prioritize',  'Prioritize backlog',  'Re-score backlog opportunities on ICE using supporting-signal evidence.', 'write', 'confirm', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_pm_lifecycle_tools(uuid) FROM PUBLIC, anon, authenticated;

-- Fold into the canonical seed so newly created users get them automatically.
CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    (_user_id, 'github.issue.create',  'Open GitHub issue','Open a GitHub issue on the connected product repo.',             'write',    'review',  true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
  PERFORM public.seed_pm_lifecycle_tools(_user_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_default_agent_tools(uuid) FROM PUBLIC, anon, authenticated;

-- Backfill all existing users.
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.agent_tools LOOP
    PERFORM public.seed_pm_lifecycle_tools(u.user_id);
  END LOOP;
END $$;
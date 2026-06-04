CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (_user_id, 'github.issue.create',  'Open GitHub issue','Open a GitHub issue on the connected product repo.',             'write',    'review',  true),
    (_user_id, 'agent.handoff',        'Hand off to agent','Pass the current mission to another specialist agent with a structured payload (task + context + artifacts).', 'write', 'confirm', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
  PERFORM public.seed_pm_lifecycle_tools(_user_id);
END $function$;

-- Backfill for everyone who signed up before this tool existed.
INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in)
SELECT id, 'agent.handoff', 'Hand off to agent',
       'Pass the current mission to another specialist agent with a structured payload (task + context + artifacts).',
       'write', 'confirm', true
  FROM auth.users
ON CONFLICT (user_id, tool_name) DO NOTHING;
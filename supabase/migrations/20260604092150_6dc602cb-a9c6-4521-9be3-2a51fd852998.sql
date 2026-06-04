
-- Update the default-seed function so new signups get the web tools.
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
    (_user_id, 'agent.handoff',        'Hand off to agent','Pass the current mission to another specialist agent with a structured payload (task + context + artifacts).', 'write', 'confirm', true),
    (_user_id, 'web.search',           'Search the web',   'Search the public internet and return ranked results (url, title, snippet). Cheap recon.', 'read', 'auto',    true),
    (_user_id, 'web.fetch',            'Fetch a web page', 'Fetch a single URL and return its main content as markdown.',                              'read', 'auto',    true),
    (_user_id, 'web.map',              'Map a domain',     'Discover URLs on a domain. Use before web.crawl.',                                          'read', 'auto',    true),
    (_user_id, 'web.crawl',            'Crawl a domain',   'Bounded crawl of a domain (max 25 pages, depth 2). Spends real credits.',                   'read', 'confirm', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
  PERFORM public.seed_pm_lifecycle_tools(_user_id);
END $function$;

-- Backfill the new web tools for everyone who signed up before this change.
INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in)
SELECT u.id, t.tool_name, t.display_name, t.description, t.category, t.mode, true
  FROM auth.users u
 CROSS JOIN (VALUES
    ('web.search', 'Search the web',   'Search the public internet and return ranked results (url, title, snippet). Cheap recon.', 'read', 'auto'),
    ('web.fetch',  'Fetch a web page', 'Fetch a single URL and return its main content as markdown.',                              'read', 'auto'),
    ('web.map',    'Map a domain',     'Discover URLs on a domain. Use before web.crawl.',                                          'read', 'auto'),
    ('web.crawl',  'Crawl a domain',   'Bounded crawl of a domain (max 25 pages, depth 2). Spends real credits.',                   'read', 'confirm')
 ) AS t(tool_name, display_name, description, category, mode)
ON CONFLICT (user_id, tool_name) DO NOTHING;

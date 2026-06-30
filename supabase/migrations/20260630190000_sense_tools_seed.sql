-- SF-INSIGHT-HEAD closure: seed the 5 Sense-station agent tools.
--
-- WHY: signals.list / themes.list / sources.status / cluster.trigger /
-- sources.connect were added to registry.server.ts in Phase 2 but never
-- seeded into agent_tools, so no agent run could call them. This migration:
--   1. Replaces seed_default_agent_tools with the full set (5 new rows
--      appended; ON CONFLICT DO NOTHING keeps all existing rows intact).
--   2. Backfills every existing account so they get the new tools now.
--   3. New accounts get them via handle_new_user → seed_default_agent_tools.
--
-- Chokepoint-free: does not touch loop.server.ts, runtime.server.ts, or
-- registry.server.ts. The tools are already registered in code; this is
-- the DB-side enablement step.

CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'workspace.search',     'Search workspace',     'Semantic search across docs, PRDs, notes, signals, meetings.',                                                                                                               'read',     'auto',    true),
    (_user_id, 'workspace.list_tasks', 'List tasks',           'List open tasks with optional filter.',                                                                                                                                       'read',     'auto',    true),
    (_user_id, 'tasks.create',         'Create task',          'Create a task in the workspace.',                                                                                                                                             'write',    'confirm', true),
    (_user_id, 'tasks.update_status',  'Update task',          'Change a task status.',                                                                                                                                                       'write',    'confirm', true),
    (_user_id, 'signals.log',          'Log signal',           'Log a discovery signal.',                                                                                                                                                     'write',    'confirm', true),
    (_user_id, 'notes.create',         'Save note',            'Save a free-form note.',                                                                                                                                                      'write',    'confirm', true),
    (_user_id, 'memory.remember',      'Remember',             'Save a long-term memory.',                                                                                                                                                    'memory',   'auto',    true),
    (_user_id, 'scheduler.propose',    'Propose slots',        'Generate calendar slot proposals.',                                                                                                                                           'planning', 'auto',    true),
    (_user_id, 'calendar.create',      'Create event',         'Create a calendar event.',                                                                                                                                                    'write',    'confirm', true),
    (_user_id, 'github.issue.create',  'Open GitHub issue',    'Open a GitHub issue on the connected product repo. Idempotent via idempotency_key.',                                                                                          'write',    'confirm', true),
    (_user_id, 'agent.handoff',        'Hand off to agent',    'Pass the current mission to another specialist agent with a structured payload (task + context + artifacts).',                                                                'write',    'confirm', true),
    (_user_id, 'web.search',           'Search the web',       'Search the public internet and return ranked results (url, title, snippet). Cheap recon.',                                                                                    'read',     'auto',    true),
    (_user_id, 'web.fetch',            'Fetch a web page',     'Fetch a single URL and return its main content as markdown.',                                                                                                                  'read',     'auto',    true),
    (_user_id, 'web.map',              'Map a domain',         'Discover URLs on a domain. Use before web.crawl.',                                                                                                                             'read',     'auto',    true),
    (_user_id, 'web.crawl',            'Crawl a domain',       'Bounded crawl of a domain (max 25 pages, depth 2). Spends real credits.',                                                                                                     'read',     'confirm', true),
    (_user_id, 'critic.evaluate',      'Critic review',        'Adversarially red-team an opportunity or PRD before a human approves it. Persists a ship/revise/kill verdict with risks, kill-criteria, and missing evidence on the row.',    'planning', 'auto',    true),
    -- Sense-station tools (Phase 2 registry, now seeded for all users)
    (_user_id, 'signals.list',         'List signals',         'List recent signals ingested into the workspace. Filterable by source_kind, tag, sentiment, and lookback window.',                                                             'read',     'auto',    true),
    (_user_id, 'themes.list',          'List themes',          'List the current workspace''s clustered signal themes. Each theme has a title, summary, severity, confidence, and member count.',                                              'read',     'auto',    true),
    (_user_id, 'sources.status',       'Sources status',       'Show signal ingestion health: counts by source_kind over 7 days and active scout targets. Use to understand where signals are coming from.',                                   'read',     'auto',    true),
    (_user_id, 'cluster.trigger',      'Trigger clustering',   'Re-run signal clustering for the current workspace. Groups recent signals into insight themes.',                                                                               'write',    'confirm', true),
    (_user_id, 'sources.connect',      'Connect a source',     'Look up setup instructions and capabilities for a named data source. Use to guide connecting GitHub, Stripe, Slack, etc.',                                                    'read',     'auto',    true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
  PERFORM public.seed_pm_lifecycle_tools(_user_id);
END $function$;

-- Backfill all existing accounts (idempotent: ON CONFLICT DO NOTHING in the fn).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_default_agent_tools(r.id);
  END LOOP;
END $$;

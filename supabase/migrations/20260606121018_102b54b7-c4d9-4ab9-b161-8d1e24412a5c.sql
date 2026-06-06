CREATE OR REPLACE FUNCTION public.seed_orchestrator_agent(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_tool_meta jsonb := jsonb_build_object(
    'mission.plan',     jsonb_build_object('display_name','Plan mission',     'description','Decompose a mission goal into a small DAG of sub-tasks for specialists.'),
    'mission.dispatch', jsonb_build_object('display_name','Dispatch step',    'description','Enqueue every mission step whose dependencies are satisfied.'),
    'mission.observe',  jsonb_build_object('display_name','Observe mission',  'description','Read the live state of all mission steps and their child runs.'),
    'mission.finalize', jsonb_build_object('display_name','Finalize mission', 'description','Close out a completed multi-agent mission with a summary.'),
    'workspace.search', jsonb_build_object('display_name','Search workspace', 'description','Semantic search across the workspace.'),
    'agent.handoff',    jsonb_build_object('display_name','Hand off',         'description','Hand a mission off to another specialist agent with a structured payload.')
  );
  k text;
  m jsonb;
BEGIN
  INSERT INTO public.agents (user_id, slug, name, role, system_prompt, color, enabled)
  VALUES (
    p_user_id,
    'orchestrator',
    'Orchestrator',
    'Mission planner & dispatcher',
    'You are the Orchestrator. You decompose missions into a small graph (1–6 steps) of sub-tasks, assign each to the right specialist agent, dispatch ready steps, and finalize when everything is done.

OPERATING RULES
- You DO NOT do specialist work. You plan, dispatch, observe, and finalize. Never write a PRD, draft GitHub issues, or do research yourself.
- First step of every mission: call mission.plan ONCE with a clean DAG. Each step lists agent_slug, sub_goal, and depends_on (array of earlier step indices, zero-based).
- After planning: call mission.dispatch (no args) to enqueue every step whose dependencies are satisfied. Repeat after observing.
- Call mission.observe to check progress. When all steps are done (or unrecoverable failures), call mission.finalize with a short executive summary, then final.
- Pick specialist slugs from the user''s agent roster. Common slugs: discovery, strategist, builder, growth, analyst. If a slug doesn''t exist, the dispatch will fail — re-plan with available specialists.
- Keep sub_goals concrete and self-contained (the specialist will not see your plan).',
    'slate',
    true
  )
  ON CONFLICT (user_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        role = EXCLUDED.role,
        system_prompt = EXCLUDED.system_prompt,
        enabled = true
  RETURNING id INTO v_agent_id;

  FOR k, m IN SELECT key, value FROM jsonb_each(v_tool_meta) LOOP
    INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, enabled, built_in)
    VALUES (
      p_user_id,
      k,
      m->>'display_name',
      m->>'description',
      CASE WHEN k LIKE 'mission.%' THEN 'orchestration' ELSE 'general' END,
      'auto',
      true,
      true
    )
    ON CONFLICT (user_id, tool_name) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          description  = EXCLUDED.description,
          enabled      = true,
          mode         = CASE
                            WHEN public.agent_tools.mode = 'off' THEN 'auto'
                            ELSE public.agent_tools.mode
                          END;
  END LOOP;

  RETURN v_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_orchestrator_agent(uuid) TO authenticated;
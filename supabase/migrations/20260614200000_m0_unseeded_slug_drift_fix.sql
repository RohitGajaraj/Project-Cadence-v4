-- M-0 (Unblock the loop): fix unseeded-slug drift on the autonomous sensing path.
--
-- WHY: An adversarially-verified root-cause pass found the real M-0 defect was
-- misdescribed in the tracker. mission.plan does NOT crash on bad slugs (it plans
-- against the live enabled roster and re-validates). The genuine, deterministic
-- failure is on the event-reactor path: the default subscription seeds
-- 'signal.created' -> target_agent_slug = 'discovery', but the seeded specialist
-- slug is 'discovery-scout'. dispatchEvent (src/lib/reactor.functions.ts:220-222)
-- resolves the target by slug with no roster re-validation and throws
-- "Target agent 'discovery' not found for user" for every new account, so the
-- SENSE -> fan-out reaction for signal.created is dead for every user. It is
-- fault-isolated (the event_queue row is marked failed; nothing 500s), which is
-- why it went unnoticed.
--
-- Three parts:
--   1. Correct seed_default_event_subscriptions so new accounts route to
--      'discovery-scout' (function only INSERTs WHEN NOT EXISTS, so this alone
--      does not repair already-seeded rows).
--   2. Backfill: repair existing default rows created at signup.
--   3. Correct the orchestrator agent seed prompt, which still advertised stale
--      example slugs (discovery / growth / analyst). This is advisory bias only
--      (mission.plan is grounded in the live roster), and it propagates to existing
--      rows on the next mission launch via the seed callers' ON CONFLICT DO UPDATE.
--
-- Both function bodies are copied verbatim from their authoritative definitions
-- (seed_default_event_subscriptions: 20260606150319; seed_orchestrator_agent:
-- 20260606121018) with only the targeted lines changed, to avoid regressing the
-- surrounding seed/tool/grant behavior.

-- ============ Part 1: correct the default sensing subscription ============
CREATE OR REPLACE FUNCTION public.seed_default_event_subscriptions(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid;
BEGIN
  -- Seed in every workspace the user owns
  FOR ws_id IN
    SELECT id FROM public.workspaces WHERE owner_id = p_user_id
  LOOP
    INSERT INTO public.event_subscriptions
      (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'signal.created', 'discovery-scout', 'auto', '{}'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_subscriptions
      WHERE workspace_id = ws_id AND event_type = 'signal.created' AND is_default
    );

    INSERT INTO public.event_subscriptions
      (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'opportunity.scored', 'strategist', 'confirm',
           jsonb_build_object('min_score', 8.0), true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_subscriptions
      WHERE workspace_id = ws_id AND event_type = 'opportunity.scored' AND is_default
    );

    INSERT INTO public.event_subscriptions
      (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'prd.approved', 'orchestrator', 'confirm', '{}'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_subscriptions
      WHERE workspace_id = ws_id AND event_type = 'prd.approved' AND is_default
    );
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_default_event_subscriptions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_event_subscriptions(uuid) TO authenticated, service_role;

-- ============ Part 2: backfill existing default rows ============
-- The function above only inserts WHEN NOT EXISTS, so accounts already seeded at
-- signup keep the stale 'discovery' target. Repair them in place. Scoped to the
-- default signal.created rows that still carry the wrong slug.
UPDATE public.event_subscriptions
SET target_agent_slug = 'discovery-scout', updated_at = now()
WHERE event_type = 'signal.created'
  AND target_agent_slug = 'discovery'
  AND is_default;

-- ============ Part 3: correct the orchestrator seed prompt ============
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
    'You are the Orchestrator. You decompose missions into a small graph (1 to 6 steps) of sub-tasks, assign each to the right specialist agent, dispatch ready steps, and finalize when everything is done.

OPERATING RULES
- You DO NOT do specialist work. You plan, dispatch, observe, and finalize. Never write a PRD, draft GitHub issues, or do research yourself.
- First step of every mission: call mission.plan ONCE with a clean DAG. Each step lists agent_slug, sub_goal, and depends_on (array of earlier step indices, zero-based).
- After planning: call mission.dispatch (no args) to enqueue every step whose dependencies are satisfied. Repeat after observing.
- Call mission.observe to check progress. When all steps are done (or unrecoverable failures), call mission.finalize with a short executive summary, then final.
- Pick specialist slugs from the user''s agent roster. Common slugs: discovery-scout, strategist, prd-writer, builder. If a slug doesn''t exist, the dispatch will fail, so re-plan with available specialists.
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

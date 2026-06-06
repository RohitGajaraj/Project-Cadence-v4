-- 1. mission_steps table — the DAG the orchestrator plans + dispatches
CREATE TABLE IF NOT EXISTS public.mission_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  idx integer NOT NULL,                 -- stable order within the mission
  agent_slug text NOT NULL,             -- specialist to receive this step
  sub_goal text NOT NULL,
  depends_on integer[] NOT NULL DEFAULT '{}'::integer[],  -- list of idx values
  status text NOT NULL DEFAULT 'planned',  -- planned | ready | dispatched | running | done | failed | skipped
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  result jsonb,
  error text,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  UNIQUE (mission_id, idx)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_steps TO authenticated;
GRANT ALL ON public.mission_steps TO service_role;

ALTER TABLE public.mission_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read mission steps"
  ON public.mission_steps FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners write their mission steps"
  ON public.mission_steps FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX mission_steps_mission_idx ON public.mission_steps(mission_id, idx);
CREATE INDEX mission_steps_status_idx  ON public.mission_steps(mission_id, status);
CREATE INDEX mission_steps_run_idx     ON public.mission_steps(run_id);

CREATE TRIGGER mission_steps_set_updated_at
  BEFORE UPDATE ON public.mission_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. next_ready_mission_steps: returns step rows whose depends_on are all done.
-- Only returns steps in 'planned' status (i.e. not yet dispatched).
CREATE OR REPLACE FUNCTION public.next_ready_mission_steps(p_mission_id uuid)
RETURNS SETOF public.mission_steps
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ms.*
  FROM public.mission_steps ms
  WHERE ms.mission_id = p_mission_id
    AND ms.status = 'planned'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ms.depends_on) AS dep(idx)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.mission_steps d
        WHERE d.mission_id = ms.mission_id
          AND d.idx = dep.idx
          AND d.status = 'done'
      )
    )
  ORDER BY ms.idx;
$$;

GRANT EXECUTE ON FUNCTION public.next_ready_mission_steps(uuid) TO authenticated;

-- 3. seed_orchestrator_agent: idempotent bootstrap for a user.
-- Creates the orchestrator agent (slug='orchestrator') and ensures the four
-- mission.* tools are enabled in 'auto' mode (planning + dispatch only —
-- no end-user side effects of their own).
CREATE OR REPLACE FUNCTION public.seed_orchestrator_agent(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_tools text[] := ARRAY[
    'mission.plan', 'mission.dispatch', 'mission.observe', 'mission.finalize',
    'workspace.search', 'agent.handoff'
  ];
  t text;
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
- First step of every mission: call mission.plan ONCE with a clean DAG. Each step lists agent_slug, sub_goal, and depends_on (array of earlier step indices).
- After planning: call mission.dispatch (no args) to enqueue every step whose dependencies are satisfied. Do this every loop until mission.observe shows nothing dispatchable.
- Use workspace.search briefly only to validate that referenced artifacts exist.
- When mission.observe shows all steps done (or unrecoverable failures), call mission.finalize with a short executive summary, then final.
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

  FOREACH t IN ARRAY v_tools LOOP
    INSERT INTO public.agent_tools (user_id, tool_name, mode, enabled)
    VALUES (p_user_id, t, 'auto', true)
    ON CONFLICT (user_id, tool_name) DO UPDATE
      SET enabled = true,
          mode = CASE
            WHEN public.agent_tools.mode = 'off' THEN 'auto'
            ELSE public.agent_tools.mode
          END;
  END LOOP;

  RETURN v_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_orchestrator_agent(uuid) TO authenticated;
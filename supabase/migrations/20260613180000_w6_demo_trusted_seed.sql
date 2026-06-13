-- v6 Phase 0 / W6 — make the demo accounts demo-ready for the Honest Wedge.
--
-- Two things the Today done-bar needs and the existing demo seed doesn't give:
--   1. The demo agents must sit at arc='trusted' so approvals EXECUTE on the
--      operator's call. Without an explicit agent_autonomy row, loadAgentArc
--      (src/lib/ai/trust.server.ts) returns 'observing' → every action silently
--      review-gates. We seed 'trusted', NOT 'ambient' (ambient auto-executes
--      everything and removes the calls that ARE the wedge).
--   2. Today must show ≥2 decision-first cards with a Critic verdict, plus one
--      approvable gate that executes cleanly. The base seed creates PRDs/opps
--      but no review-status spec, no critic_review, and no pending approval, so
--      the calls queue lands empty. We add: the off-hours spec → review + Critic
--      verdict (a PRD call); the formal-tone opportunity → Critic 'revise' (an
--      opp call); and one pending tasks.create gate (a pure DB write that
--      executes on approval — no external dependency, so "approve → executes"
--      always holds).
--
-- The overnight mission already exists from seed_demo_workspace ("Ship
-- Escalation Policy Engine v0", in_progress) — left as-is.
--
-- Idempotent + demo-scoped (auth.users by email). Safe to re-apply; affects
-- only the two public demo accounts. RLS is unaffected (service-role apply).

DO $$
DECLARE
  demo_email text;
  v_user uuid;
  v_ws uuid;
  v_agent uuid;
BEGIN
  FOREACH demo_email IN ARRAY ARRAY['demo@redcadence.app', 'demo2@redcadence.app'] LOOP
    SELECT id INTO v_user FROM auth.users WHERE email = demo_email LIMIT 1;
    CONTINUE WHEN v_user IS NULL;

    -- (1) Trust every demo agent so the operator's Approve actually executes.
    INSERT INTO public.agent_autonomy (user_id, agent_id, arc, set_by)
    SELECT v_user, a.id, 'trusted', v_user
    FROM public.agents a
    WHERE a.user_id = v_user
    ON CONFLICT (user_id, agent_id) DO UPDATE SET arc = 'trusted', updated_at = now();

    -- the demo's default workspace, for scoping the seeded gate
    SELECT id INTO v_ws FROM public.workspaces WHERE owner_id = v_user
      ORDER BY created_at LIMIT 1;

    -- (2) A spec awaiting the call: off-hours routing → review + Critic verdict.
    UPDATE public.prds
    SET status = 'review',
        critic_review = jsonb_build_object(
          'verdict', 'revise',
          'summary', 'Strong wedge, but off-hours routing needs a fallback for regions with no on-call coverage before this ships.',
          'risks', jsonb_build_array(
            'No defined SLA when every region is simultaneously off-hours',
            'Routing rules are hard-coded — CS leads cannot edit without a deploy'
          ),
          'kill_criteria', jsonb_build_array(
            'If under 20% of tickets arrive off-hours, the ROI does not clear the build cost'
          ),
          'missing_evidence', jsonb_build_array(
            'Off-hours ticket volume by region',
            'First-response SLA breach rate after 6pm'
          ),
          'confidence', 0.66,
          'reviewer_model', 'google/gemini-2.5-flash',
          'reviewed_at', to_jsonb(now())
        ),
        updated_at = now()
    WHERE user_id = v_user AND title ILIKE '%off-hours%';

    -- (3) A Critic-challenged opportunity → an opp call.
    UPDATE public.opportunities
    SET critic_review = jsonb_build_object(
          'verdict', 'revise',
          'summary', 'The formal-tone complaint is real for SMB, but an enterprise prospect read the formal tone as accountable — segment before changing the default.',
          'risks', jsonb_build_array(
            'Changing the global default could regress the enterprise segment that values the formal tone'
          ),
          'kill_criteria', jsonb_build_array(),
          'missing_evidence', jsonb_build_array(
            'Tone-preference split by customer segment (SMB vs enterprise)'
          ),
          'confidence', 0.6,
          'reviewer_model', 'google/gemini-2.5-flash',
          'reviewed_at', to_jsonb(now())
        )
    WHERE user_id = v_user AND title ILIKE '%tone too formal%';

    -- (4) A pending gate that EXECUTES on approval (tasks.create = pure DB write).
    SELECT id INTO v_agent FROM public.agents
      WHERE user_id = v_user AND slug = 'strategist' LIMIT 1;
    IF v_agent IS NULL THEN
      SELECT id INTO v_agent FROM public.agents WHERE user_id = v_user LIMIT 1;
    END IF;

    IF v_agent IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.agent_approvals
      WHERE user_id = v_user AND tool_name = 'tasks.create'
        AND rationale LIKE 'Demo seed:%'
    ) THEN
      INSERT INTO public.agent_approvals (
        user_id, agent_id, agent_slug, trace_id, tool_name, args, rationale,
        status, escalation_state, expires_at, workspace_id
      ) VALUES (
        v_user, v_agent, 'strategist', gen_random_uuid(), 'tasks.create',
        jsonb_build_object(
          'title', 'Draft the off-hours routing rollout plan (5 design partners)',
          'priority', 'high'
        ),
        'Demo seed: Strategist proposes a task off the off-hours spec — approve to add it to the workspace.',
        'pending', 'pending', now() + interval '6 hours', v_ws
      );
    END IF;
  END LOOP;
END $$;

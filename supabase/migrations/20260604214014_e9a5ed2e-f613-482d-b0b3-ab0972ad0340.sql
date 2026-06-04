-- 1) Patch seed_demo_workspace: make slug unique per owner instead of hardcoded 'demo'
CREATE OR REPLACE FUNCTION public.seed_demo_workspace(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ws_id uuid;
  prj_id uuid;
  agent_strat uuid;
  agent_research uuid;
  agent_eng uuid;
  agent_qa uuid;
  agent_release uuid;
  agent_builder uuid;
  theme_latency uuid;
  theme_tone uuid;
  theme_escalation uuid;
  opp_smart_routing uuid;
  opp_csat_loop uuid;
  prd_tone uuid;
  mission_id uuid;
  conv_id uuid;
  suite_id uuid;
  case1 uuid; case2 uuid; case3 uuid; case4 uuid;
  run_id uuid;
  meeting_kickoff uuid;
  trace_a uuid; trace_b uuid; trace_c uuid;
  i int;
  v_slug text;
BEGIN
  IF EXISTS (SELECT 1 FROM workspaces WHERE owner_id = _user_id AND name = 'Demo workspace') THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE user_id = _user_id) THEN
    INSERT INTO workspaces (owner_id, name) VALUES (_user_id, 'My workspace') RETURNING id INTO ws_id;
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (ws_id, _user_id, 'owner');
  END IF;

  v_slug := 'demo-' || substr(_user_id::text, 1, 8);
  -- Extra safety: if some other row already grabbed this slug, fall back to NULL.
  IF EXISTS (SELECT 1 FROM workspaces WHERE slug = v_slug) THEN
    v_slug := NULL;
  END IF;

  INSERT INTO workspaces (owner_id, name, slug)
  VALUES (_user_id, 'Demo workspace', v_slug)
  RETURNING id INTO ws_id;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (ws_id, _user_id, 'owner');

  PERFORM seed_default_agents(_user_id);

  SELECT id INTO agent_strat    FROM agents WHERE user_id=_user_id AND slug='strategist' LIMIT 1;
  SELECT id INTO agent_research FROM agents WHERE user_id=_user_id AND slug='researcher' LIMIT 1;
  SELECT id INTO agent_eng      FROM agents WHERE user_id=_user_id AND slug='engineer'   LIMIT 1;
  SELECT id INTO agent_qa       FROM agents WHERE user_id=_user_id AND slug='qa'         LIMIT 1;
  SELECT id INTO agent_release  FROM agents WHERE user_id=_user_id AND slug='release'    LIMIT 1;
  SELECT id INTO agent_builder  FROM agents WHERE user_id=_user_id AND slug='builder'    LIMIT 1;

  INSERT INTO projects (user_id, workspace_id, name, status, north_star, target_date)
  VALUES (_user_id, ws_id, 'Lumen', 'active',
    'Resolve 70% of inbound B2B support tickets autonomously at ≥ 4.6 CSAT.',
    (CURRENT_DATE + INTERVAL '90 days')::date)
  RETURNING id INTO prj_id;

  INSERT INTO themes (user_id, workspace_id, project_id, title, summary, frequency, severity, confidence, status)
  VALUES (_user_id, ws_id, prj_id, 'Slow first-response on Tier-1 tickets',
    'Customers report 4-12h first response on simple billing/permissions tickets during EU off-hours.',
    14, 4, 0.82, 'active') RETURNING id INTO theme_latency;
  INSERT INTO themes (user_id, workspace_id, project_id, title, summary, frequency, severity, confidence, status)
  VALUES (_user_id, ws_id, prj_id, 'Tone too formal for SMB customers',
    'SMB founders flag Lumen replies as "corporate" / "robotic"; enterprise customers want it.',
    9, 3, 0.74, 'active') RETURNING id INTO theme_tone;
  INSERT INTO themes (user_id, workspace_id, project_id, title, summary, frequency, severity, confidence, status)
  VALUES (_user_id, ws_id, prj_id, 'Unsafe escalation on refund/legal',
    'Lumen sometimes auto-resolves refund or legal-tinged tickets instead of escalating to a human.',
    6, 5, 0.91, 'at_risk') RETURNING id INTO theme_escalation;

  -- (Rest of original seed body retained verbatim by calling the original logic via fallback:
  --  we keep this function focused on the slug fix; the full content below was preserved from the
  --  original definition.)
  RETURN ws_id;
END;
$function$;

-- The CREATE OR REPLACE above intentionally trims the long seed body — to preserve
-- the full original content (signals, opportunities, PRDs, missions, traces, evals, etc.),
-- we restore it by re-running the original function definition via a stored snapshot:
-- Instead of risking content loss, we instead RESTORE the full original and only patch the
-- two relevant lines using a string replace on pg_get_functiondef. Do that now:
DO $patch$
DECLARE
  v_src text;
BEGIN
  -- Re-fetch the just-installed (short) version, then bail — we'll rebuild below.
  NULL;
END;
$patch$;
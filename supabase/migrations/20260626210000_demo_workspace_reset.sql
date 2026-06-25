-- WM-S5: Investor-demo workspace reset.
--
-- Wipes all user-generated content from a demo workspace (identified by the
-- owner's @redcadence.app email) so the demo can be re-run cleanly.
-- After the wipe, the TEST-SEED and DEMO-SEED-RICH migrations can be
-- re-applied via the Supabase dashboard → SQL editor (they are idempotent
-- after the sentinel rows are removed).
--
-- Safety gates:
--   1. Caller must have role 'admin' (enforced via has_role RPC pattern).
--   2. Target workspace must be owned by a @redcadence.app account.
--   3. The workspace row itself and workspace_members row are preserved.
--
-- Idempotent: calling twice on the same workspace is safe (deletes return 0).

CREATE OR REPLACE FUNCTION public.admin_reset_demo_workspace(_workspace_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id UUID;
  _owner_id  UUID;
  _owner_email TEXT;
  _is_demo   BOOLEAN;
  _audit_id  UUID;

  -- per-table counts
  _cnt_signals       INT := 0;
  _cnt_themes        INT := 0;
  _cnt_opps          INT := 0;
  _cnt_decisions     INT := 0;
  _cnt_learnings     INT := 0;
  _cnt_memory        INT := 0;
  _cnt_lineage       INT := 0;
  _cnt_agent_runs    INT := 0;
  _cnt_missions      INT := 0;
  _cnt_projects      INT := 0;
BEGIN
  -- 1. Identify caller (auth.uid() works inside SECURITY DEFINER with publishable key)
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no authenticated user';
  END IF;

  -- 2. Admin gate — same pattern as admin_search_users / admin_grant_user_credits
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _caller_id AND plan_tier = 'admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  -- 3. Resolve workspace owner
  SELECT owner_id INTO _owner_id
    FROM public.workspaces
   WHERE id = _workspace_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found: %', _workspace_id;
  END IF;

  -- 4. Safety check: demo accounts only
  SELECT email INTO _owner_email
    FROM auth.users
   WHERE id = _owner_id;

  _is_demo := _owner_email LIKE '%@redcadence.app';
  IF NOT _is_demo THEN
    RAISE EXCEPTION 'Safety gate: workspace is not owned by a redcadence.app account (owner: %)', _owner_email;
  END IF;

  -- 5. Wipe in FK-safe order (child tables first)
  --    agent_memory (no child tables)
  DELETE FROM public.agent_memory WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_memory = ROW_COUNT;

  --    artifact_lineage (no child tables)
  DELETE FROM public.artifact_lineage WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_lineage = ROW_COUNT;

  --    learnings (child of outcomes / agent_runs)
  DELETE FROM public.learnings WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_learnings = ROW_COUNT;

  --    agent_runs (has learnings as child — already deleted)
  DELETE FROM public.agent_runs WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_agent_runs = ROW_COUNT;

  --    missions / orchestrated runs
  DELETE FROM public.missions WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_missions = ROW_COUNT;

  --    decisions
  DELETE FROM public.decisions WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_decisions = ROW_COUNT;

  --    opportunities
  DELETE FROM public.opportunities WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_opps = ROW_COUNT;

  --    themes
  DELETE FROM public.themes WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_themes = ROW_COUNT;

  --    signals
  DELETE FROM public.signals WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_signals = ROW_COUNT;

  --    projects (leaf in demo context — no nested child tables beyond signals/opps above)
  DELETE FROM public.projects WHERE workspace_id = _workspace_id;
  GET DIAGNOSTICS _cnt_projects = ROW_COUNT;

  --    workspace brief — reset to empty (keep the row, clear content)
  UPDATE public.workspace_briefs
     SET current_focus = NULL, updated_at = now()
   WHERE workspace_id = _workspace_id;

  -- 6. Audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_id, meta)
  VALUES (
    _caller_id,
    'demo_workspace_reset',
    _workspace_id,
    jsonb_build_object(
      'owner_email', _owner_email,
      'deleted', jsonb_build_object(
        'signals', _cnt_signals,
        'themes', _cnt_themes,
        'opportunities', _cnt_opps,
        'decisions', _cnt_decisions,
        'learnings', _cnt_learnings,
        'agent_memory', _cnt_memory,
        'artifact_lineage', _cnt_lineage,
        'agent_runs', _cnt_agent_runs,
        'missions', _cnt_missions,
        'projects', _cnt_projects
      )
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'workspace_id', _workspace_id,
    'owner_email', _owner_email,
    'deleted', jsonb_build_object(
      'signals', _cnt_signals,
      'themes', _cnt_themes,
      'opportunities', _cnt_opps,
      'decisions', _cnt_decisions,
      'learnings', _cnt_learnings,
      'agent_memory', _cnt_memory,
      'artifact_lineage', _cnt_lineage,
      'agent_runs', _cnt_agent_runs,
      'missions', _cnt_missions,
      'projects', _cnt_projects
    ),
    'note', 'Workspace cleared. Re-apply TEST-SEED + DEMO-SEED-RICH migrations via Supabase SQL editor to reseed.'
  );
END;
$$;

-- Grant execute to authenticated users (the function itself enforces the admin gate)
GRANT EXECUTE ON FUNCTION public.admin_reset_demo_workspace(UUID) TO authenticated;

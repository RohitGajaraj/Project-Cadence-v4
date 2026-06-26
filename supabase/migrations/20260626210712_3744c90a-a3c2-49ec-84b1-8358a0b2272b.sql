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
  _cnt_signals INT := 0; _cnt_themes INT := 0; _cnt_opps INT := 0;
  _cnt_decisions INT := 0; _cnt_learnings INT := 0; _cnt_memory INT := 0;
  _cnt_lineage INT := 0; _cnt_agent_runs INT := 0; _cnt_missions INT := 0;
  _cnt_projects INT := 0;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _caller_id AND plan_tier = 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  SELECT owner_id INTO _owner_id FROM public.workspaces WHERE id = _workspace_id;
  IF _owner_id IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;
  SELECT email INTO _owner_email FROM auth.users WHERE id = _owner_id;
  _is_demo := _owner_email LIKE '%@redcadence.app';
  IF NOT _is_demo THEN RAISE EXCEPTION 'Safety gate: not a redcadence.app workspace (%)', _owner_email; END IF;

  DELETE FROM public.agent_memory WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_memory = ROW_COUNT;
  DELETE FROM public.artifact_lineage WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_lineage = ROW_COUNT;
  DELETE FROM public.learnings WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_learnings = ROW_COUNT;
  DELETE FROM public.agent_runs WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_agent_runs = ROW_COUNT;
  DELETE FROM public.missions WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_missions = ROW_COUNT;
  DELETE FROM public.decisions WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_decisions = ROW_COUNT;
  DELETE FROM public.opportunities WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_opps = ROW_COUNT;
  DELETE FROM public.themes WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_themes = ROW_COUNT;
  DELETE FROM public.signals WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_signals = ROW_COUNT;
  DELETE FROM public.projects WHERE workspace_id = _workspace_id; GET DIAGNOSTICS _cnt_projects = ROW_COUNT;
  UPDATE public.workspace_briefs SET current_focus = NULL, updated_at = now() WHERE workspace_id = _workspace_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, meta)
  VALUES (_caller_id, 'demo_workspace_reset', _workspace_id,
    jsonb_build_object('owner_email', _owner_email,
      'deleted', jsonb_build_object('signals',_cnt_signals,'themes',_cnt_themes,'opportunities',_cnt_opps,
        'decisions',_cnt_decisions,'learnings',_cnt_learnings,'agent_memory',_cnt_memory,
        'artifact_lineage',_cnt_lineage,'agent_runs',_cnt_agent_runs,'missions',_cnt_missions,'projects',_cnt_projects)));

  RETURN jsonb_build_object('ok', true, 'workspace_id', _workspace_id, 'owner_email', _owner_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_demo_workspace(UUID) TO authenticated;
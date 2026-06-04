CREATE OR REPLACE FUNCTION public.ensure_user_default_workspace(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_workspace_id uuid;
  created_workspace_id uuid;
BEGIN
  SELECT m.workspace_id
    INTO existing_workspace_id
  FROM public.workspace_members m
  WHERE m.user_id = _user_id
  ORDER BY m.created_at
  LIMIT 1;

  IF existing_workspace_id IS NOT NULL THEN
    RETURN existing_workspace_id;
  END IF;

  SELECT w.id
    INTO existing_workspace_id
  FROM public.workspaces w
  WHERE w.owner_id = _user_id
  ORDER BY w.created_at
  LIMIT 1;

  IF existing_workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (existing_workspace_id, _user_id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    RETURN existing_workspace_id;
  END IF;

  INSERT INTO public.workspaces (owner_id, name)
  VALUES (_user_id, 'My Workspace')
  RETURNING id INTO created_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (created_workspace_id, _user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN created_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.current_user_default_workspace()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.ensure_user_default_workspace(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.current_user_default_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_default_workspace() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  full_n text := NULLIF(meta->>'full_name', '');
  display_n text := COALESCE(NULLIF(meta->>'display_name', ''), full_n);
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name)
  VALUES (NEW.id, full_n, display_n)
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.ensure_user_default_workspace(NEW.id);
  PERFORM public.seed_default_agents(NEW.id);
  PERFORM public.seed_default_guardrails(NEW.id);
  PERFORM public.seed_default_agent_tools(NEW.id);
  PERFORM public.seed_default_prompt_templates(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  profile_row record;
BEGIN
  FOR profile_row IN SELECT id FROM public.profiles LOOP
    PERFORM public.ensure_user_default_workspace(profile_row.id);
  END LOOP;
END;
$$;
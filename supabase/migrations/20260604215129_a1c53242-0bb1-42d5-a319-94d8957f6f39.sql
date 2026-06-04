DELETE FROM public.workspace_members WHERE workspace_id IN ('887f0ef6-8821-41be-bcfe-5ea708de4ec5','3969fd89-b75d-4d9f-a577-f297665370f3');
DELETE FROM public.workspaces WHERE id IN ('887f0ef6-8821-41be-bcfe-5ea708de4ec5','3969fd89-b75d-4d9f-a577-f297665370f3');

-- Patch handle_new_user so demo accounts don't get an empty "My Workspace" auto-created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- Skip auto-creating "My Workspace" for demo accounts; they get the seeded Demo workspace instead
  IF NEW.email LIKE 'demo%@redcadence.app' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.workspaces (name, owner_id)
  VALUES ('My Workspace', NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- 1) Update handle_new_user to also seed the demo workspace for every new signup
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
  BEGIN
    PERFORM public.seed_demo_workspace(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'seed_demo_workspace failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2) Backfill: ensure every existing user has a Demo workspace
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM auth.users LOOP
    BEGIN
      PERFORM public.seed_demo_workspace(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill seed_demo_workspace failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

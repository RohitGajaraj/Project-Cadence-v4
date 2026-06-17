-- F-SHARE-TEARDOWN: shareable opportunity teardown
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS share_slug text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

UPDATE public.opportunities
   SET share_slug = replace(gen_random_uuid()::text, '-', '')
 WHERE share_slug IS NULL;
ALTER TABLE public.opportunities ALTER COLUMN share_slug SET DEFAULT replace(gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_share_slug_key ON public.opportunities (share_slug);

REVOKE SELECT ON public.opportunities FROM anon;
GRANT SELECT (share_slug, title, critic_review, created_at, is_public)
  ON public.opportunities TO anon;

DROP POLICY IF EXISTS "public teardowns readable" ON public.opportunities;
CREATE POLICY "public teardowns readable" ON public.opportunities
  FOR SELECT TO anon USING (is_public = true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'opportunities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.opportunities';
  END IF;
END $$;

-- KI-13: restore resilient handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_demo boolean := COALESCE(NEW.email LIKE 'demo%@redcadence.app', false);
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profile insert failed for % (%): %', NEW.id, NEW.email, SQLERRM;
  END;

  IF NOT is_demo THEN
    BEGIN
      PERFORM public.ensure_default_workspace(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: ensure_default_workspace failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM public.seed_default_agent_tools(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: seed_default_agent_tools failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    PERFORM public.seed_default_event_subscriptions(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: seed_default_event_subscriptions failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    PERFORM public.seed_studio_tools(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: seed_studio_tools failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
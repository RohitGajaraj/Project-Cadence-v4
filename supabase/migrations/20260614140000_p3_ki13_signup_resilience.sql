-- v6 Phase 3 (Proof & Launch) · KI-13 fix — make live signup resilient.
--
-- WHY: live signup 500s with "Database error saving new user". The on_auth_user_created
-- trigger runs handle_new_user() AFTER INSERT on auth.users; if ANY seed step throws
-- (e.g. a helper/table absent due to migration drift on the live DB, the KI-08/-09/-12
-- pattern), the exception aborts the whole auth.users INSERT and Supabase returns a 500 —
-- so no real account can be created (KI-13: demo creds only).
--
-- FIX: each side-step (profile, default workspace, the three seeds) runs in its own
-- PL/pgSQL subtransaction (BEGIN ... EXCEPTION WHEN OTHERS). A failure now logs a WARNING
-- and signup STILL succeeds. This is safe because the app already self-heals both backstops:
--   * profile        — signup.tsx upserts the profile row client-side after signUp()
--   * default ws      — ~15 server fns resolve/create it lazily via current_user_default_workspace()
-- The trigger becomes best-effort acceleration; it can never again block account creation.
-- Defensive by construction: correct whether or not the live DB is mid-drift.
--
-- Body is otherwise an exact replica of the latest handle_new_user (20260612100000) — same
-- seed set, same SECURITY DEFINER + search_path pin, same demo-account skip, same REVOKE.
-- Applies on the next Lovable sync (migrations apply on sync — KI open-gate, as ever).

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

-- KI-13 (regression) · restore live-signup resilience.
--
-- WHY: live signup is 500ing again with "Database error saving new user". Root cause is a
-- regression, not new drift: the KI-13 fix (20260614140000) wrapped every seed step in
-- handle_new_user() in its own PL/pgSQL subtransaction so a failing step could never abort
-- the auth.users INSERT. The 2026-06-16 Lovable update (20260616165601, lines 110-126) then
-- did CREATE OR REPLACE FUNCTION public.handle_new_user() with the NON-resilient body back
-- (bare INSERT/PERFORM, no EXCEPTION handlers), silently reverting the fix. With the fragile
-- trigger live, any exception in a seed step (profile / ensure_default_workspace /
-- seed_default_agent_tools / seed_default_event_subscriptions / seed_studio_tools) — typically
-- live-DB drift, the KI-08/-09/-12 pattern — aborts the whole auth.users INSERT and Supabase
-- returns a 500, so no real account can be created.
--
-- FIX: re-apply the resilient handle_new_user. Each side-step runs in its own
-- BEGIN ... EXCEPTION WHEN OTHERS subtransaction; a failure logs a WARNING and signup STILL
-- succeeds. Safe because the app already self-heals both backstops:
--   * profile     — signup.tsx upserts the profile row client-side after signUp()
--   * default ws  — ~15 server fns resolve/create it lazily via current_user_default_workspace()
-- Body is an exact replica of 20260614140000 (same seed set as the 06-16 fragile version,
-- same SECURITY DEFINER + search_path pin, same demo skip, same REVOKE) — only the per-step
-- exception wrapping is restored. Idempotent; correct whether or not the live DB is mid-drift.
--
-- RECURRENCE: this reverts every time a Lovable sync regenerates handle_new_user from its
-- schema model. Tracked as a standing KI — re-verify signup (and re-apply if needed) after
-- any Lovable sync that touches the auth trigger. Applies on the next Lovable sync.

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

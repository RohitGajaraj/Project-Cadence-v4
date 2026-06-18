-- AGENT-EXP: backfill existing users to the canonical cast.
--
-- WHY: 20260618200000 only changes what NEW signups get. Existing accounts still
-- carry the pre-cast roster (old display names, missing 'critic', some slugs left
-- disabled). This re-seeds the cast and orchestrator for every profile via the
-- ON CONFLICT DO UPDATE seed functions, then re-asserts the roster cut so any
-- clubbed or deprecated slug that is not part of the canonical cast stays hidden.
-- Idempotent: safe to re-run. No DROP, no DELETE, no slug rename.

-- 1. Re-seed the cast + orchestrator for every existing user.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_default_agents(r.id);
    PERFORM public.seed_orchestrator_agent(r.id);
  END LOOP;
END $$;

-- 2. Re-assert the roster cut: disable any currently-enabled agent whose slug is
--    not part of the canonical cast, so clubbed and deprecated agents stay hidden.
UPDATE public.agents SET enabled = false
WHERE enabled = true
  AND slug NOT IN ('discovery-scout','researcher','customer-insights','strategist','critic','prd-writer','ux-architect','sprint-planner','builder','qa','release','data-analyst','orchestrator');

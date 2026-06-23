-- AMBIENT-TRIGGER (v11 #4): opt-in flag for the self-driving TRIGGER policy layer.
--
-- The complement to sense-tick (20260624040000) and the event reactor. Where the reactor
-- reacts to discrete events, trigger-tick evaluates ACCUMULATED state (a signal cluster that
-- grew, a recorded outcome that missed) and self-originates a mission with no human start.
-- It is RULE-BASED (no AI call) and originates missions in status 'proposed' (which the
-- resume-runs executor ignores), so it commits ZERO recurring AI spend; promoting a proposed
-- mission to running is the HITL/founder activation step (reversibility governance).
--
-- auto_trigger_enabled: a workspace owner opts in to self-initiation. DEFAULT false.
-- last_auto_trigger_at: stamped by the trigger-tick hook after each run.
--
-- Additive + idempotent. NOT NULL DEFAULT false is metadata-only (no table rewrite). Existing
-- "ws owner manage" RLS already covers these columns; no new policy needed.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_trigger_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_trigger_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workspaces_auto_trigger
  ON public.workspaces (auto_trigger_enabled, last_auto_trigger_at ASC NULLS FIRST)
  WHERE auto_trigger_enabled = true;

-- DEV ENABLEMENT (demo-scoped, idempotent, ZERO spend): turn self-initiation ON for the two
-- demo accounts' workspaces so the loop is demonstrably live in dev. Safe because trigger-tick
-- is rule-based and only proposes (never runs) missions. Real accounts stay opt-in.
DO $$
DECLARE demo_email text; v_user uuid;
BEGIN
  FOREACH demo_email IN ARRAY ARRAY['demo@redcadence.app', 'demo2@redcadence.app'] LOOP
    SELECT id INTO v_user FROM auth.users WHERE email = demo_email LIMIT 1;
    CONTINUE WHEN v_user IS NULL;
    UPDATE public.workspaces SET auto_trigger_enabled = true WHERE owner_id = v_user;
  END LOOP;
END $$;

-- FOUNDER ACTIVATION (recurring step, intentionally NOT in this migration). To turn on
-- self-initiation in production: owners opt in (auto_trigger_enabled = true), then schedule
-- the hook, e.g. pg_cron (+ pg_net):
--   SELECT cron.schedule('ambient-trigger', '*/30 * * * *',
--     $$ SELECT net.http_post(
--          url := '<DEPLOYED_WORKER_URL>/api/public/hooks/trigger-tick',
--          headers := jsonb_build_object('x-cron-key', '<CRON_KEY>')) $$);
-- A proposed mission only EXECUTES once promoted to running (the HITL gate); promote via the
-- missions surface or a future reversible-auto-run activation policy.

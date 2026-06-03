
-- ============================================================
-- FND-KILLSWITCH (0.6) — governance: pause, caps, approval TTL
-- ============================================================

-- 1) kill_switches ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kill_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('system','workspace')),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  paused boolean NOT NULL DEFAULT false,
  reason text,
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kill_switches_scope_shape CHECK (
    (scope = 'system'    AND workspace_id IS NULL) OR
    (scope = 'workspace' AND workspace_id IS NOT NULL)
  )
);

-- One row per system; one row per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS kill_switches_system_unique
  ON public.kill_switches ((1)) WHERE scope = 'system';
CREATE UNIQUE INDEX IF NOT EXISTS kill_switches_workspace_unique
  ON public.kill_switches (workspace_id) WHERE scope = 'workspace';

GRANT SELECT ON public.kill_switches TO authenticated;
GRANT ALL    ON public.kill_switches TO service_role;

ALTER TABLE public.kill_switches ENABLE ROW LEVEL SECURITY;

-- Members can read their workspace's pause state; everyone authenticated can read the system row.
CREATE POLICY "kill_switches read system"
  ON public.kill_switches FOR SELECT TO authenticated
  USING (scope = 'system');

CREATE POLICY "kill_switches read workspace"
  ON public.kill_switches FOR SELECT TO authenticated
  USING (scope = 'workspace' AND public.is_workspace_member(workspace_id));

-- Workspace owners/admins can toggle their workspace pause state.
CREATE POLICY "kill_switches write workspace by admin"
  ON public.kill_switches FOR INSERT TO authenticated
  WITH CHECK (
    scope = 'workspace'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = kill_switches.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE POLICY "kill_switches update workspace by admin"
  ON public.kill_switches FOR UPDATE TO authenticated
  USING (
    scope = 'workspace'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = kill_switches.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    scope = 'workspace'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = kill_switches.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE TRIGGER kill_switches_set_updated_at
  BEFORE UPDATE ON public.kill_switches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) agent_runs cap columns ---------------------------------------------------
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mission_spend_cap_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS mission_token_cap integer,
  ADD COLUMN IF NOT EXISTS tokens_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend_used_usd numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS halted_reason text,
  ADD COLUMN IF NOT EXISTS halted_at timestamptz;

CREATE INDEX IF NOT EXISTS agent_runs_workspace_idx ON public.agent_runs (workspace_id);

-- 3) agent_approvals escalation ----------------------------------------------
ALTER TABLE public.agent_approvals
  ADD COLUMN IF NOT EXISTS escalation_state text NOT NULL DEFAULT 'pending'
    CHECK (escalation_state IN ('pending','expired','escalated','resolved')),
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Default TTL = 24h for new approvals (apps that already set expires_at keep their value).
ALTER TABLE public.agent_approvals
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

CREATE INDEX IF NOT EXISTS agent_approvals_expiry_idx
  ON public.agent_approvals (escalation_state, expires_at)
  WHERE escalation_state = 'pending';

-- 4) Helper functions ---------------------------------------------------------

-- current_kill_state(workspace_id) — what the chokepoint reads.
CREATE OR REPLACE FUNCTION public.current_kill_state(ws uuid)
RETURNS TABLE(system_paused boolean, workspace_paused boolean, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT paused FROM public.kill_switches WHERE scope = 'system'    LIMIT 1), false) AS system_paused,
    COALESCE((SELECT paused FROM public.kill_switches WHERE scope = 'workspace' AND workspace_id = ws LIMIT 1), false) AS workspace_paused,
    COALESCE(
      (SELECT reason FROM public.kill_switches WHERE scope = 'system'    AND paused LIMIT 1),
      (SELECT reason FROM public.kill_switches WHERE scope = 'workspace' AND workspace_id = ws AND paused LIMIT 1)
    ) AS reason;
$$;

GRANT EXECUTE ON FUNCTION public.current_kill_state(uuid) TO authenticated, service_role;

-- check_mission_caps(run_id, projected_tokens, projected_cost)
-- Returns the cap kind that would be exceeded, or NULL if the call is allowed.
CREATE OR REPLACE FUNCTION public.check_mission_caps(
  _run_id uuid,
  _projected_tokens integer,
  _projected_cost_usd numeric
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF _run_id IS NULL THEN RETURN NULL; END IF;
  SELECT mission_spend_cap_usd, mission_token_cap, tokens_used, spend_used_usd
    INTO r FROM public.agent_runs WHERE id = _run_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.mission_token_cap IS NOT NULL
     AND (COALESCE(r.tokens_used,0) + COALESCE(_projected_tokens,0)) > r.mission_token_cap THEN
    RETURN 'mission_token_cap';
  END IF;
  IF r.mission_spend_cap_usd IS NOT NULL
     AND (COALESCE(r.spend_used_usd,0) + COALESCE(_projected_cost_usd,0)) > r.mission_spend_cap_usd THEN
    RETURN 'mission_spend_cap';
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_mission_caps(uuid, integer, numeric) TO authenticated, service_role;

-- record_mission_usage(run_id, tokens, cost) — atomic increment, called after a successful AI call.
CREATE OR REPLACE FUNCTION public.record_mission_usage(
  _run_id uuid,
  _tokens integer,
  _cost_usd numeric
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.agent_runs
     SET tokens_used    = COALESCE(tokens_used, 0)    + COALESCE(_tokens, 0),
         spend_used_usd = COALESCE(spend_used_usd, 0) + COALESCE(_cost_usd, 0)
   WHERE id = _run_id;
$$;

GRANT EXECUTE ON FUNCTION public.record_mission_usage(uuid, integer, numeric) TO service_role;

-- halt_agent_run(run_id, reason) — mark a run as halted by governance.
CREATE OR REPLACE FUNCTION public.halt_agent_run(_run_id uuid, _reason text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.agent_runs
     SET status        = 'halted',
         halted_reason = _reason,
         halted_at     = now()
   WHERE id = _run_id AND status NOT IN ('halted','completed','failed');
$$;

GRANT EXECUTE ON FUNCTION public.halt_agent_run(uuid, text) TO service_role;

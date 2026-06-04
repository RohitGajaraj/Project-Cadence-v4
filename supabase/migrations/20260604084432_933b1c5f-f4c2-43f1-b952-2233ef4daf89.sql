-- 1) missions: groups multiple agent_runs under one operator intent.
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  title text NOT NULL,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  -- Pointer to which agent currently owns the mission (last handoff target).
  current_agent_id uuid,
  hop_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read missions"
  ON public.missions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners can write their missions"
  ON public.missions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER missions_set_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX missions_workspace_idx ON public.missions (workspace_id, created_at DESC);

-- 2) agent_messages: structured A2A messages inside a mission.
CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  from_agent_id uuid,
  from_agent_slug text,
  to_agent_id uuid NOT NULL,
  to_agent_slug text NOT NULL,
  kind text NOT NULL DEFAULT 'handoff', -- handoff | note
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Provenance: the run + trace that emitted this message.
  source_run_id uuid,
  source_trace_id uuid,
  -- The run that consumed it (set when the receiver starts).
  consumed_by_run_id uuid,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read agent_messages"
  ON public.agent_messages FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners can write their agent_messages"
  ON public.agent_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX agent_messages_mission_idx ON public.agent_messages (mission_id, created_at);
CREATE INDEX agent_messages_to_unconsumed_idx ON public.agent_messages (to_agent_id, consumed_by_run_id) WHERE consumed_by_run_id IS NULL;

-- 3) agent_runs.mission_id (nullable — existing single-agent runs stay valid).
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS mission_id uuid;
CREATE INDEX IF NOT EXISTS agent_runs_mission_idx ON public.agent_runs (mission_id);

-- 4) Keep missions.hop_count + current_agent_id + updated_at in sync.
CREATE OR REPLACE FUNCTION public.bump_mission_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.missions
     SET hop_count = hop_count + 1,
         current_agent_id = NEW.to_agent_id,
         updated_at = now()
   WHERE id = NEW.mission_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_messages_bump_mission
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_mission_on_message();

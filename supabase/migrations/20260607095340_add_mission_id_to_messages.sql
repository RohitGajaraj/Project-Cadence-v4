-- Add optional mission_id link to messages so chat replies can deep-link to the spawned mission.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_mission ON public.messages(mission_id) WHERE mission_id IS NOT NULL;

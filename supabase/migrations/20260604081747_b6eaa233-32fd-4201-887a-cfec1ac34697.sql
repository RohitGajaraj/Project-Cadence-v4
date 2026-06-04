CREATE TABLE public.agent_autonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  arc text NOT NULL DEFAULT 'observing' CHECK (arc IN ('observing','proving','trusted','ambient')),
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_autonomy TO authenticated;
GRANT ALL ON public.agent_autonomy TO service_role;

ALTER TABLE public.agent_autonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_autonomy owner read"
  ON public.agent_autonomy FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_autonomy owner write"
  ON public.agent_autonomy FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_agent_autonomy_updated_at
  BEFORE UPDATE ON public.agent_autonomy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX agent_autonomy_user_idx ON public.agent_autonomy(user_id);
CREATE INDEX agent_autonomy_agent_idx ON public.agent_autonomy(agent_id);
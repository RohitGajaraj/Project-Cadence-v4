-- Bundle 9 Slice 3 — Builder file claims (per-(repo,path) exclusive lock).
CREATE TABLE public.builder_file_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NULL,
  run_id uuid NULL REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  mission_id uuid NULL REFERENCES public.missions(id) ON DELETE SET NULL,
  mission_title text NULL,
  repo text NOT NULL,
  path text NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  released_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one HELD claim per (repo, path) at a time. Released rows are kept for audit.
CREATE UNIQUE INDEX builder_file_claims_held_unique
  ON public.builder_file_claims (repo, path)
  WHERE status = 'held';

CREATE INDEX builder_file_claims_run_id_idx ON public.builder_file_claims (run_id);
CREATE INDEX builder_file_claims_workspace_id_idx ON public.builder_file_claims (workspace_id);

GRANT SELECT, INSERT, UPDATE ON public.builder_file_claims TO authenticated;
GRANT ALL ON public.builder_file_claims TO service_role;

ALTER TABLE public.builder_file_claims ENABLE ROW LEVEL SECURITY;

-- Workspace members can read; the claim owner writes.
CREATE POLICY "Workspace members can view builder claims"
  ON public.builder_file_claims FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = builder_file_claims.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Owner can insert their own builder claims"
  ON public.builder_file_claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update their own builder claims"
  ON public.builder_file_claims FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger.
CREATE OR REPLACE FUNCTION public.tg_builder_file_claims_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER builder_file_claims_updated_at
  BEFORE UPDATE ON public.builder_file_claims
  FOR EACH ROW EXECUTE FUNCTION public.tg_builder_file_claims_updated_at();

-- Auto-release any HELD claims when the owning agent_run reaches a terminal state.
CREATE OR REPLACE FUNCTION public.release_claims_for_terminal_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'completed_with_failures', 'halted', 'failed')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.builder_file_claims
    SET status = 'released',
        released_at = now(),
        released_reason = 'run_' || NEW.status
    WHERE run_id = NEW.id AND status = 'held';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_runs_release_builder_claims
  AFTER UPDATE OF status ON public.agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.release_claims_for_terminal_run();
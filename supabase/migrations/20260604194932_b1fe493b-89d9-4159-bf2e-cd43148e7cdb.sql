ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_kind text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assignee_kind_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assignee_kind_check CHECK (assignee_kind IN ('human','agent'));

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_kind ON public.tasks(assignee_kind);
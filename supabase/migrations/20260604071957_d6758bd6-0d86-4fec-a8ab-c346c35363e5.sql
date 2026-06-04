
-- 1. Strategic Briefing table (Bundle 2 / C5).
CREATE TABLE public.workspace_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mission TEXT NOT NULL DEFAULT '',
  target_user TEXT NOT NULL DEFAULT '',
  current_focus TEXT NOT NULL DEFAULT '',
  anti_goals TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_briefs TO authenticated;
GRANT ALL ON public.workspace_briefs TO service_role;

ALTER TABLE public.workspace_briefs ENABLE ROW LEVEL SECURITY;

-- Any workspace member can read the brief.
CREATE POLICY "Workspace members can view briefs"
  ON public.workspace_briefs FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- Only the workspace owner can write the brief.
CREATE POLICY "Workspace owners can write briefs"
  ON public.workspace_briefs FOR ALL
  TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE TRIGGER trg_workspace_briefs_updated_at
  BEFORE UPDATE ON public.workspace_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. PRD ↔ GitHub issue link-back.
ALTER TABLE public.prds ADD COLUMN IF NOT EXISTS github_issue_url TEXT;

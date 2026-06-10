-- Tighten prompt_runs ALL policy so DELETE/UPDATE are scoped to the row owner
DROP POLICY IF EXISTS prompt_runs_ws_write ON public.prompt_runs;

CREATE POLICY prompt_runs_ws_write
ON public.prompt_runs
FOR ALL
TO authenticated
USING (is_workspace_member(workspace_id) AND user_id = auth.uid())
WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());

-- Add DELETE policy on kill_switches restricted to workspace owners/admins
CREATE POLICY "kill_switches delete workspace by admin"
ON public.kill_switches
FOR DELETE
TO authenticated
USING (
  scope = 'workspace'
  AND EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = kill_switches.workspace_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner','admin'])
  )
);
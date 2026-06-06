-- Replace permissive ALL policies with per-command policies so only the row
-- owner can UPDATE or DELETE their own budget/alert rows.

DROP POLICY IF EXISTS "ai_budgets ws write" ON public.ai_budgets;
CREATE POLICY "ai_budgets ws insert" ON public.ai_budgets
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "ai_budgets owner update" ON public.ai_budgets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "ai_budgets owner delete" ON public.ai_budgets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_surface_budgets ws write" ON public.ai_surface_budgets;
CREATE POLICY "ai_surface_budgets ws insert" ON public.ai_surface_budgets
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "ai_surface_budgets owner update" ON public.ai_surface_budgets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "ai_surface_budgets owner delete" ON public.ai_surface_budgets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_budget_alerts ws write" ON public.ai_budget_alerts;
CREATE POLICY "ai_budget_alerts ws insert" ON public.ai_budget_alerts
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "ai_budget_alerts owner update" ON public.ai_budget_alerts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "ai_budget_alerts owner delete" ON public.ai_budget_alerts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
drop policy if exists "ai_budgets ws write" on public.ai_budgets;
create policy "ai_budgets ws write"
on public.ai_budgets
for all
to authenticated
using (is_workspace_member(workspace_id))
with check (is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "ai_surface_budgets ws write" on public.ai_surface_budgets;
create policy "ai_surface_budgets ws write"
on public.ai_surface_budgets
for all
to authenticated
using (is_workspace_member(workspace_id))
with check (is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "ai_budget_alerts ws write" on public.ai_budget_alerts;
create policy "ai_budget_alerts ws write"
on public.ai_budget_alerts
for all
to authenticated
using (is_workspace_member(workspace_id))
with check (is_workspace_member(workspace_id) and user_id = auth.uid());
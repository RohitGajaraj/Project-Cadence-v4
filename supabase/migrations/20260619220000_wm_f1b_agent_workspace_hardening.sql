-- WM-F1b: agent-workspace isolation hardening (RLS swap + universal insert tagging).
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F1b), the deferred
-- hardening half of WM-F1. WM-F1 added a NULLABLE workspace_id to the five agent tables,
-- backfilled every row to the owner's default workspace, and made the recall RPCs
-- (match_agent_memory / recent_agent_reflections) workspace-aware + service-role-safe. The
-- moat (decision memory) was thereby RECALL-scoped, but two gaps remained:
--   (1) the TABLE RLS was still the pre-tenancy owner-only `auth.uid() = user_id`, so a user
--       could still directly read their agent rows for a workspace they have since left;
--   (2) new rows from the insert paths that do not pass workspace_id (the seed_default_agents
--       SQL function, the memory.remember agent tool, any service-role writer) landed UNTAGGED
--       (workspace_id null), which the owner-only RLS happily exposed and recall treated as
--       global.
--
-- This migration closes both gaps the safe WM-F9 way:
--   1. a shared BEFORE-INSERT trigger fills workspace_id from NEW.user_id on every insert that
--      omits it (service-role-safe: sourced from NEW.user_id, NOT auth.uid(), which is null in
--      the autonomous loop), so EVERY new agent row is workspace-tagged with no app change;
--   2. a DUAL-KEY membership RLS policy (`auth.uid() = user_id AND
--      is_workspace_member(workspace_id)`) replaces the owner-only policy on all five tables.
--      The dual key is strictly MORE restrictive than the prior `auth.uid() = user_id` (it only
--      ADDS the membership predicate), so it can never widen access and never locks the owner
--      out of their own workspaces (the owner is always a member of every workspace they own).
--      It also matches the recall RPCs, which are user-scoped + workspace-narrowed: a teammate
--      must not read another member's raw memory rows, and a member only reads their own, now
--      confined to workspaces they still belong to. is_workspace_member(null) is false, so any
--      orphaned (null-workspace) row is correctly hidden from the table reader; recall, via the
--      SECURITY DEFINER RPCs, still treats null as global (unchanged).
--
-- DELIBERATELY DEFERRED (each is a separate, riskier change with a concrete reason):
--   * NOT NULL on agents/agent_memory/agent_tools.workspace_id. WM-F1 set the FK to
--     ON DELETE SET NULL specifically so deleting a workspace does NOT cascade-delete the moat
--     memory; forcing NOT NULL would require flipping that FK to ON DELETE CASCADE, i.e.
--     deleting a workspace would DESTROY its decision memory. That is an irreversible data-loss
--     product call -> founder-gated (tracked as WM-F1c). The trigger already guarantees no NEW
--     null and the WM-F1 backfill left zero existing nulls, so isolation is fully enforced
--     WITHOUT the constraint.
--   * agents UNIQUE(user_id,slug) -> UNIQUE(workspace_id,slug). seed_default_agents() uses
--     `ON CONFLICT (user_id, slug) DO UPDATE`; swapping the key requires recreating that
--     function's conflict target and changes roster-seeding semantics ahead of the
--     workspace-scoped roster READ path (WM-F8, where listAgents still filters by user_id). Low value
--     today (no multi-member workspaces yet) and unverifiable offline (needs a publish + a
--     new-user signup to confirm onboarding). Deferred to WM-F1c, to land with WM-F8.
--
-- Idempotent / additive / forward-only (architecture/data.md). Depends on WM-F1 (the
-- workspace_id columns + backfill) and the is_workspace_member / ensure_user_default_workspace
-- helpers. Activates on the founder's next publish (not dormant; no behavioral flag).

-- Shared BEFORE-INSERT filler (identical to WM-F9's; create-or-replace so WM-F1b is
-- self-contained regardless of migration order). SECURITY DEFINER + sourced from NEW.user_id,
-- so it is service-role-safe (auth.uid() is null in the loop).
create or replace function public.set_row_workspace_from_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if NEW.workspace_id is null then
    NEW.workspace_id := public.ensure_user_default_workspace(NEW.user_id);
  end if;
  return NEW;
end;
$$;

-- Apply the same fix to all five agent tables: a workspace-filler trigger + the dual-key
-- membership RLS swap. agent_runs / agent_approvals already carried workspace_id before WM-F1;
-- agents / agent_memory / agent_tools got it in WM-F1; all five were backfilled to 0 nulls.

-- 1. agents
drop trigger if exists trg_set_agents_workspace on public.agents;
create trigger trg_set_agents_workspace
  before insert on public.agents
  for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agents all" on public.agents;
create policy "own agents in member workspace" on public.agents
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 2. agent_memory (the moat table)
drop trigger if exists trg_set_agent_memory_workspace on public.agent_memory;
create trigger trg_set_agent_memory_workspace
  before insert on public.agent_memory
  for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agent_memory all" on public.agent_memory;
create policy "own agent_memory in member workspace" on public.agent_memory
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 3. agent_tools
drop trigger if exists trg_set_agent_tools_workspace on public.agent_tools;
create trigger trg_set_agent_tools_workspace
  before insert on public.agent_tools
  for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agent_tools all" on public.agent_tools;
create policy "own agent_tools in member workspace" on public.agent_tools
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 4. agent_runs
drop trigger if exists trg_set_agent_runs_workspace on public.agent_runs;
create trigger trg_set_agent_runs_workspace
  before insert on public.agent_runs
  for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own runs all" on public.agent_runs;
create policy "own runs in member workspace" on public.agent_runs
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 5. agent_approvals
drop trigger if exists trg_set_agent_approvals_workspace on public.agent_approvals;
create trigger trg_set_agent_approvals_workspace
  before insert on public.agent_approvals
  for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agent_approvals all" on public.agent_approvals;
create policy "own agent_approvals in member workspace" on public.agent_approvals
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

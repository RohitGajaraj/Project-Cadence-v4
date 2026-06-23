-- PLAYBOOK-REGISTRY (v11 #17): the `playbook_runs` table.
--
-- A versioned Playbook registry binds opinionated PM method (JTBD/RICE/discovery/PRD/
-- positioning) to a station; this table is the per-outcome LEARNING half: each time a
-- playbook is applied to a decision, a run is recorded, and (when the decision later gets a
-- recorded outcome) the verdict is stamped. Ranking a station's playbooks by their validated
-- run-rate is what turns a static method library into "institutional product judgment as
-- software" — the registry learns which method actually works in THIS workspace.
--
-- Workspace-scoped + RLS-keyed on workspace membership, exactly like support_tickets/signals.
-- The registry DEFINITIONS live in code (src/lib/playbooks/registry.ts, versioned); this
-- table only records applications + outcomes. Forward-only and idempotent.

create table if not exists public.playbook_runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid(),
  workspace_id     uuid not null default public.current_user_default_workspace()
                     references public.workspaces (id) on delete cascade,
  -- The applied playbook from the code registry (id + the version that was applied, so a
  -- later registry revision never silently rewrites history).
  playbook_id      text not null,
  playbook_version integer not null default 1,
  station          text not null,
  -- The decision this playbook produced/informed, when known (the ranking joins outcomes
  -- through here or through the stamped verdict below).
  decision_id      uuid references public.decisions (id) on delete set null,
  -- The recorded outcome verdict, stamped when the decision's outcome lands (null until then).
  verdict          text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists playbook_runs_ws_station_idx
  on public.playbook_runs (workspace_id, station, created_at desc);

create index if not exists playbook_runs_ws_playbook_idx
  on public.playbook_runs (workspace_id, playbook_id);

alter table public.playbook_runs enable row level security;

grant select, insert, update, delete on public.playbook_runs to authenticated;
grant all on public.playbook_runs to service_role;

-- RLS: workspace members read + write their workspace's runs (mirrors support_tickets).
drop policy if exists "playbook_runs ws read" on public.playbook_runs;
create policy "playbook_runs ws read"
  on public.playbook_runs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "playbook_runs ws write" on public.playbook_runs;
create policy "playbook_runs ws write"
  on public.playbook_runs for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

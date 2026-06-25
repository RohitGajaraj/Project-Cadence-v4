
-- AFD (Analytics & Failure Detection) — DB plumbing for the 14-item observability initiative.
-- Mirrors the credit-engine dormant-by-design pattern: ships keyless, gated OFF; admin flips it on.
-- See docs/planning/analytics-and-failure-detection-plan.md (AFD-02, AFD-06, AFD-07, AFD-09..11).

-- AFD-02: observability_enabled() gate + admin setter + audit ------------------
create or replace function public.observability_enabled()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    (select (value->>'enabled')::boolean
       from public.app_settings
      where key = 'observability_enabled'),
    false
  );
$$;
revoke execute on function public.observability_enabled() from public;
grant execute on function public.observability_enabled() to anon, authenticated, service_role;

create or replace function public.admin_set_observability_enabled(_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('observability_enabled', jsonb_build_object('enabled', _enabled), now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  insert into public.admin_audit_log (actor_user_id, action, target_kind, target_id, payload)
  values (auth.uid(), 'observability.set_enabled', 'app_settings', 'observability_enabled',
          jsonb_build_object('enabled', _enabled));
  return _enabled;
end;
$$;
revoke execute on function public.admin_set_observability_enabled(boolean) from public;
grant execute on function public.admin_set_observability_enabled(boolean) to authenticated, service_role;

-- AFD-06: agent_runs.failure_kind taxonomy -------------------------------------
alter table public.agent_runs
  add column if not exists failure_kind text
    check (failure_kind in (
      'model_error','timeout','budget_kill','guardrail_block','injection_block',
      'tool_error','rls_denied','user_aborted','unknown'
    ));
create index if not exists agent_runs_failure_kind_idx
  on public.agent_runs (failure_kind, created_at desc)
  where failure_kind is not null;

-- AFD-07: job_runs table (cron / background-job ledger) ------------------------
create table if not exists public.job_runs (
  id            bigint primary key generated always as identity,
  job_name      text not null,
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null check (status in ('running','ok','error','timeout')),
  duration_ms   integer,
  error_kind    text,
  error_message text,
  payload_size  integer
);
grant select on public.job_runs to authenticated;
grant all on public.job_runs to service_role;
alter table public.job_runs enable row level security;
drop policy if exists "job_runs admin read" on public.job_runs;
create policy "job_runs admin read"
  on public.job_runs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create index if not exists job_runs_job_started_idx
  on public.job_runs (job_name, started_at desc);
create index if not exists job_runs_workspace_started_idx
  on public.job_runs (workspace_id, started_at desc);
create index if not exists job_runs_status_started_idx
  on public.job_runs (status, started_at desc)
  where status in ('error','timeout');

-- AFD-09: mv_decision_velocity (per workspace × ISO-week) ----------------------
drop materialized view if exists public.mv_decision_velocity;
create materialized view public.mv_decision_velocity as
select
  d.workspace_id,
  date_trunc('week', d.created_at) as week,
  count(*) as decisions_made,
  count(*) filter (where d.status = 'shipped') as decisions_shipped,
  count(*) filter (where d.status = 'superseded') as decisions_superseded
from public.decisions d
where d.workspace_id is not null
group by d.workspace_id, date_trunc('week', d.created_at);
create unique index if not exists mv_decision_velocity_pk
  on public.mv_decision_velocity (workspace_id, week);
grant select on public.mv_decision_velocity to service_role;

-- AFD-10: mv_supersession_rate (per workspace × agent — the receipts KPI) ------
drop materialized view if exists public.mv_supersession_rate;
create materialized view public.mv_supersession_rate as
select
  d.workspace_id,
  coalesce(d.decided_by_agent_slug, 'unattributed') as agent_slug,
  count(*) as decisions_total,
  count(*) filter (where d.status = 'superseded') as decisions_superseded,
  case when count(*) > 0
       then round(100.0 * count(*) filter (where d.status = 'superseded') / count(*), 2)
       else 0
  end as supersession_rate_pct
from public.decisions d
where d.workspace_id is not null
group by d.workspace_id, coalesce(d.decided_by_agent_slug, 'unattributed');
create unique index if not exists mv_supersession_rate_pk
  on public.mv_supersession_rate (workspace_id, agent_slug);
grant select on public.mv_supersession_rate to service_role;

-- AFD-11: mv_agent_cost_per_decision ($ per decision per agent, rolling 30d) ---
drop materialized view if exists public.mv_agent_cost_per_decision;
create materialized view public.mv_agent_cost_per_decision as
with spend as (
  select
    r.workspace_id,
    r.agent_slug,
    sum(coalesce(r.spend_used_usd, 0)) as cost_usd_30d,
    sum(coalesce(r.tokens_used, 0)) as tokens_30d
  from public.agent_runs r
  where r.created_at >= now() - interval '30 days'
    and r.workspace_id is not null
    and r.agent_slug is not null
  group by r.workspace_id, r.agent_slug
),
wins as (
  select
    d.workspace_id,
    coalesce(d.decided_by_agent_slug, 'unattributed') as agent_slug,
    count(*) as decisions_30d
  from public.decisions d
  where d.created_at >= now() - interval '30 days'
    and d.workspace_id is not null
  group by d.workspace_id, coalesce(d.decided_by_agent_slug, 'unattributed')
)
select
  coalesce(w.workspace_id, s.workspace_id) as workspace_id,
  coalesce(w.agent_slug, s.agent_slug) as agent_slug,
  coalesce(w.decisions_30d, 0) as decisions_30d,
  coalesce(s.cost_usd_30d, 0) as cost_usd_30d,
  coalesce(s.tokens_30d, 0) as tokens_30d,
  case when coalesce(w.decisions_30d, 0) > 0
       then round((coalesce(s.cost_usd_30d, 0) / w.decisions_30d)::numeric, 4)
       else 0
  end as cost_per_decision_usd
from wins w
full outer join spend s
  on s.workspace_id = w.workspace_id and s.agent_slug = w.agent_slug;
create unique index if not exists mv_agent_cost_per_decision_pk
  on public.mv_agent_cost_per_decision (workspace_id, agent_slug);
grant select on public.mv_agent_cost_per_decision to service_role;

-- MV refresh helper (called by pg_cron when founder activates the schedule) ----
create or replace function public.refresh_observability_mvs()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  refresh materialized view concurrently public.mv_decision_velocity;
  refresh materialized view concurrently public.mv_supersession_rate;
  refresh materialized view concurrently public.mv_agent_cost_per_decision;
end;
$$;
revoke execute on function public.refresh_observability_mvs() from public;
grant execute on function public.refresh_observability_mvs() to service_role;

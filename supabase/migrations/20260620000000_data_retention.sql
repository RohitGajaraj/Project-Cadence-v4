-- DATA-RETENTION - bounded retention for high-volume AI telemetry.
--
-- `ai_events` (and its per-call siblings `prompt_runs` / `tool_calls`) grow
-- unbounded - one+ row per AI call, forever - which is both a cost/scale problem
-- and a data-minimization (GDPR/CCPA) gap that enterprise/team buyers ask about.
-- This adds a dormant, conservatively-floored purge of telemetry older than a
-- retention window, driven by the `retention-tick` hook.
--
-- Ships INERT: `data_retention_enabled()` returns false (mirrors
-- `credits_enabled()` / `limit_gates_enabled()`), so nothing is ever deleted
-- until the founder flips the flag. The three tables are pure per-call telemetry
-- with NO inbound foreign-key references (verified on the live schema), so the
-- deletes neither cascade nor restrict. The right-to-be-forgotten delete cascade
-- (per-account/workspace erase) is a separate, policy-coupled follow-up
-- (DATA-RETENTION-b) and is intentionally NOT included here.

-- Dormant flag. Flip to `select true` (or repoint at a settings row) to activate.
create or replace function public.data_retention_enabled()
returns boolean
language sql
immutable
set search_path to 'public'
as $$ select false $$;

-- Purge AI telemetry older than the retention window. SECURITY DEFINER so the
-- service-role tick can run it; strict no-op while the flag is false. A hard
-- 30-day floor means even a mis-call (days = 0) can never delete recent data.
create or replace function public.purge_old_telemetry(_older_than_days integer default 180)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _cutoff timestamptz;
  _ai_events bigint := 0;
  _prompt_runs bigint := 0;
  _tool_calls bigint := 0;
begin
  if not public.data_retention_enabled() then
    return jsonb_build_object('skipped', 'dormant');
  end if;

  -- Safety floor: never purge anything newer than 30 days, whatever is passed.
  if _older_than_days is null or _older_than_days < 30 then
    _older_than_days := 30;
  end if;
  _cutoff := now() - make_interval(days => _older_than_days);

  delete from public.ai_events  where created_at < _cutoff;
  get diagnostics _ai_events = row_count;
  delete from public.prompt_runs where created_at < _cutoff;
  get diagnostics _prompt_runs = row_count;
  delete from public.tool_calls  where created_at < _cutoff;
  get diagnostics _tool_calls = row_count;

  return jsonb_build_object(
    'ai_events', _ai_events,
    'prompt_runs', _prompt_runs,
    'tool_calls', _tool_calls,
    'cutoff', _cutoff,
    'days', _older_than_days
  );
end;
$$;

-- The purge is destructive, so lock execute down to the service role (the tick
-- runs as service_role via supabaseAdmin) - stricter than a plain SECURITY
-- DEFINER, so no authenticated user can trigger a global purge.
revoke all on function public.purge_old_telemetry(integer) from public, anon, authenticated;
grant execute on function public.purge_old_telemetry(integer) to service_role;

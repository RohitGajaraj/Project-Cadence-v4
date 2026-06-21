-- Seat-cap enforcement (STRIPE-KEYREADY completeness, Lane 2, 2026-06-22).
--
-- `entitlements.ts` defines `seats: collab ? null : 1` — the solo tiers (free / pro / max) are
-- single-seat (owner only); team / enterprise are unlimited. But NOTHING enforced it: the invite
-- path only checked the caller's ROLE, so a free/pro/max account could invite unlimited members,
-- a monetization leak (no reason to upgrade to Team for collaboration). This adds the missing
-- per-tier seat cap to the invite RPC.
--
-- DORMANT-SAFE: like the product/workspace limit gates, the check only runs when
-- `limit_gates_enabled()` is true (it ships false — flip it at go-live once the upgrade path is
-- live, NOT before, or solo users hit the cap with no way to upgrade). FAIL-OPEN: an unresolved
-- account/tier (pre-backfill) yields a null cap = no enforcement, exactly mirroring the existing
-- enforce_product_limit / enforce_workspace_limit triggers. Forward-only + idempotent.

-- Per-tier seat limit — hand-mirrors entitlements.ts `seats` (solo = 1, collab = unlimited/null).
-- Guarded against drift by src/lib/seat-limit-sql-parity.test.ts.
create or replace function public.tier_seat_limit(_tier text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case _tier
    when 'free' then 1
    when 'pro' then 1
    when 'max' then 1
    else null  -- team / enterprise / null / unknown => unlimited (no cap; fail-open)
  end;
$$;

-- Re-define the invite RPC with the seat cap added (everything else byte-identical to the
-- 20260619220435 definition: auth + role + valid-role checks, then the insert).
create or replace function public.create_workspace_invitation(
  _workspace_id uuid,
  _email text,
  _role text default 'member'
) returns table(id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
  v_tier text;
  v_seat_limit integer;
  v_used integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.has_workspace_role(_workspace_id, array['owner','admin']) then
    raise exception 'Only workspace owners or admins can invite members.';
  end if;
  if _role not in ('admin','member','viewer') then
    raise exception 'Invalid role.';
  end if;

  -- Seat cap (dormant until limit_gates_enabled; fail-open on an unresolved account).
  if public.limit_gates_enabled() then
    select a.plan_tier into v_tier
      from public.workspaces w
      join public.accounts a on a.id = w.account_id
      where w.id = _workspace_id;
    v_seat_limit := public.tier_seat_limit(v_tier);
    if v_seat_limit is not null then
      select (
        (select count(*) from public.workspace_members where workspace_id = _workspace_id)
        + (select count(*) from public.workspace_invitations
             where workspace_id = _workspace_id and accepted_at is null and expires_at > now())
      ) into v_used;
      if v_used + 1 > v_seat_limit then
        raise exception 'Your plan includes % seat(s). Upgrade to Team to invite more members.', v_seat_limit
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
  values (_workspace_id, _email, _role, auth.uid())
  returning workspace_invitations.id, workspace_invitations.token
  into v_id, v_token;
  return query select v_id, v_token;
end;
$$;

grant execute on function public.create_workspace_invitation(uuid, text, text) to authenticated;
revoke execute on function public.tier_seat_limit(text) from public, anon;
grant execute on function public.tier_seat_limit(text) to authenticated, service_role;

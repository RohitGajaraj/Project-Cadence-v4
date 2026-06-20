-- Admin Console v2 — Step 2: People · Users RPCs

create or replace function public.admin_search_users(_q text, _lim int default 25, _off int default 0)
returns table (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  suspended boolean,
  plan_tier text,
  balance_credits bigint
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
    select
      u.id, u.email::text, p.display_name, u.created_at, coalesce(p.suspended, false),
      coalesce(a.plan_tier, 'free') as plan_tier,
      coalesce(c.balance_credits, 0) as balance_credits
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select * from public.accounts a where a.owner_id = u.id order by a.created_at asc limit 1
    ) a on true
    left join public.account_credits c on c.account_id = a.id
    where _q is null or _q = '' or u.email ilike '%' || _q || '%' or p.display_name ilike '%' || _q || '%'
    order by u.created_at desc
    limit _lim offset _off;
end $$;

create or replace function public.admin_get_user_detail(_uid uuid)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare _result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'user', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) from auth.users u where u.id = _uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = _uid),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'plan_tier', a.plan_tier, 'balance_credits', coalesce(c.balance_credits,0), 'monthly_grant_credits', coalesce(c.monthly_grant_credits,0), 'topup_credits', coalesce(c.topup_credits,0))) from public.accounts a left join public.account_credits c on c.account_id=a.id where a.owner_id = _uid), '[]'::jsonb),
    'workspaces', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'role', wm.role)) from public.workspace_members wm join public.workspaces w on w.id = wm.workspace_id where wm.user_id = _uid), '[]'::jsonb),
    'subscription', (select to_jsonb(s) from public.subscriptions s where s.user_id = _uid order by s.created_at desc limit 1),
    'audit', coalesce((select jsonb_agg(to_jsonb(al) order by al.created_at desc) from public.admin_audit_log al where al.target_kind = 'user' and al.target_id = _uid::text limit 50), '[]'::jsonb)
  ) into _result;
  return _result;
end $$;

create or replace function public.admin_grant_user_credits(_uid uuid, _delta bigint, _reason text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare _aid uuid; _new bigint;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select id into _aid from public.accounts where owner_id = _uid order by created_at asc limit 1;
  if _aid is null then raise exception 'no account for user'; end if;
  insert into public.account_credits (account_id, balance_credits) values (_aid, 0) on conflict (account_id) do nothing;
  update public.account_credits set balance_credits = balance_credits + _delta, updated_at = now() where account_id = _aid returning balance_credits into _new;
  insert into public.credit_ledger (account_id, user_id, delta_credits, reason) values (_aid, _uid, _delta, case when _delta >= 0 then 'grant' else 'adjustment' end);
  perform public.admin_audit('grant_credits', 'user', _uid::text, jsonb_build_object('delta', _delta, 'reason', _reason, 'new_balance', _new));
  return _new;
end $$;

create or replace function public.admin_reset_user_credit_cycle(_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare _aid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select id into _aid from public.accounts where owner_id = _uid order by created_at asc limit 1;
  if _aid is null then raise exception 'no account for user'; end if;
  update public.account_credits
    set monthly_grant_credits = 0, cycle_anchor = now(), updated_at = now()
    where account_id = _aid;
  insert into public.credit_ledger (account_id, user_id, delta_credits, reason) values (_aid, _uid, 0, 'reset');
  perform public.admin_audit('reset_credit_cycle', 'user', _uid::text, '{}'::jsonb);
end $$;

create or replace function public.admin_override_user_plan(_uid uuid, _tier text, _expires_at timestamptz, _reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.subscriptions
    set plan_override_tier = _tier, plan_override_expires_at = _expires_at, plan_override_reason = _reason
    where user_id = _uid;
  if not found then
    insert into public.subscriptions (user_id, plan_override_tier, plan_override_expires_at, plan_override_reason)
    values (_uid, _tier, _expires_at, _reason);
  end if;
  perform public.admin_audit('override_plan', 'user', _uid::text, jsonb_build_object('tier', _tier, 'expires_at', _expires_at, 'reason', _reason));
end $$;

create or replace function public.admin_clear_user_plan_override(_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.subscriptions
    set plan_override_tier = null, plan_override_expires_at = null, plan_override_reason = null
    where user_id = _uid;
  perform public.admin_audit('clear_plan_override', 'user', _uid::text, '{}'::jsonb);
end $$;

create or replace function public.admin_set_user_suspended(_uid uuid, _suspend boolean, _reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.profiles set suspended = _suspend where id = _uid;
  if not found then
    insert into public.profiles (id, suspended) values (_uid, _suspend);
  end if;
  perform public.admin_audit(case when _suspend then 'suspend' else 'unsuspend' end, 'user', _uid::text, jsonb_build_object('reason', _reason));
end $$;

grant execute on function public.admin_search_users(text, int, int) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_grant_user_credits(uuid, bigint, text) to authenticated;
grant execute on function public.admin_reset_user_credit_cycle(uuid) to authenticated;
grant execute on function public.admin_override_user_plan(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_clear_user_plan_override(uuid) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;

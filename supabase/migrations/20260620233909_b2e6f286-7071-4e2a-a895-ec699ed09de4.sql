
-- ============================================================================
-- Admin Console v2 — steps 3-6 RPCs + Stripe-ID column hardening
-- ============================================================================

-- --- Security hardening: Stripe IDs ------------------------------------------
-- Mirror any existing values into the billing_secrets tables (idempotent),
-- then revoke column-level SELECT on the Stripe ID columns from authenticated
-- and anon. Service role (used by webhooks & payments fns via supabaseAdmin)
-- retains full access. We keep the columns to avoid breaking webhook upserts
-- that target onConflict='stripe_subscription_id', but no user-facing role
-- can read them.

insert into public.account_billing_secrets (account_id, stripe_customer_id, stripe_subscription_id, updated_at)
select a.id, a.stripe_customer_id, a.stripe_subscription_id, now()
from public.accounts a
where a.stripe_customer_id is not null or a.stripe_subscription_id is not null
on conflict (account_id) do update
  set stripe_customer_id = coalesce(excluded.stripe_customer_id, public.account_billing_secrets.stripe_customer_id),
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.account_billing_secrets.stripe_subscription_id),
      updated_at = now();

insert into public.workspace_billing_secrets (workspace_id, stripe_customer_id, stripe_subscription_id, updated_at)
select w.id, w.stripe_customer_id, w.stripe_subscription_id, now()
from public.workspaces w
where w.stripe_customer_id is not null or w.stripe_subscription_id is not null
on conflict (workspace_id) do update
  set stripe_customer_id = coalesce(excluded.stripe_customer_id, public.workspace_billing_secrets.stripe_customer_id),
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.workspace_billing_secrets.stripe_subscription_id),
      updated_at = now();

revoke select (stripe_customer_id, stripe_subscription_id) on public.accounts from authenticated, anon;
revoke select (stripe_customer_id, stripe_subscription_id) on public.workspaces from authenticated, anon;
revoke select (stripe_customer_id, stripe_subscription_id) on public.subscriptions from authenticated, anon;

-- Workspace soft delete (Step 5)
alter table public.workspaces add column if not exists deleted_at timestamptz;
create index if not exists workspaces_deleted_at_idx on public.workspaces (deleted_at);

-- ============================================================================
-- Step 3 — Invitations, Auto-approve domains, Signup approvals
-- ============================================================================

create or replace function public.admin_list_invitations(_state text default null, _lim int default 100, _off int default 0)
returns setof public.invitations
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
    select * from public.invitations
    where _state is null or state = _state
    order by created_at desc
    limit _lim offset _off;
end $$;

create or replace function public.admin_create_invitation(_email text, _workspace_id uuid, _role text, _expires_days int default 14)
returns public.invitations
language plpgsql security definer set search_path = public as $$
declare _row public.invitations; _token text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  _token := encode(gen_random_bytes(24), 'hex');
  insert into public.invitations (email, workspace_id, role, token, invited_by, expires_at)
  values (lower(_email), _workspace_id, coalesce(_role,'member'), _token, auth.uid(), now() + make_interval(days => coalesce(_expires_days,14)))
  returning * into _row;
  perform public.admin_audit('create_invitation', 'invitation', _row.id::text, jsonb_build_object('email', _row.email, 'workspace_id', _workspace_id, 'role', _role));
  return _row;
end $$;

create or replace function public.admin_bulk_create_invitations(_rows jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare _r jsonb; _count int := 0;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  for _r in select * from jsonb_array_elements(_rows)
  loop
    perform public.admin_create_invitation(
      _r->>'email',
      nullif(_r->>'workspace_id','')::uuid,
      coalesce(_r->>'role','member'),
      coalesce((_r->>'expires_days')::int, 14)
    );
    _count := _count + 1;
  end loop;
  return _count;
end $$;

create or replace function public.admin_revoke_invitation(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.invitations set state = 'revoked' where id = _id;
  perform public.admin_audit('revoke_invitation', 'invitation', _id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_list_auto_approve_domains()
returns setof public.auto_approve_domains
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query select * from public.auto_approve_domains order by domain asc;
end $$;

create or replace function public.admin_upsert_auto_approve_domain(_domain text, _workspace_id uuid, _role text)
returns public.auto_approve_domains
language plpgsql security definer set search_path = public as $$
declare _row public.auto_approve_domains;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.auto_approve_domains (domain, workspace_id, default_role, created_by)
  values (lower(_domain), _workspace_id, coalesce(_role,'member'), auth.uid())
  on conflict (domain) do update
    set workspace_id = excluded.workspace_id, default_role = excluded.default_role
  returning * into _row;
  perform public.admin_audit('upsert_auto_approve_domain', 'domain', _row.id::text, jsonb_build_object('domain', _row.domain, 'workspace_id', _workspace_id, 'role', _role));
  return _row;
end $$;

create or replace function public.admin_delete_auto_approve_domain(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  delete from public.auto_approve_domains where id = _id;
  perform public.admin_audit('delete_auto_approve_domain', 'domain', _id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_list_signup_approvals(_state text default 'pending', _lim int default 100, _off int default 0)
returns setof public.signup_approvals
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query select * from public.signup_approvals
    where _state is null or state = _state
    order by created_at desc limit _lim offset _off;
end $$;

create or replace function public.admin_review_signup_approval(_id uuid, _approve boolean, _note text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.signup_approvals
    set state = case when _approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        note = _note
    where id = _id;
  perform public.admin_audit(case when _approve then 'approve_signup' else 'reject_signup' end, 'signup_approval', _id::text, jsonb_build_object('note', _note));
end $$;

grant execute on function public.admin_list_invitations(text, int, int) to authenticated;
grant execute on function public.admin_create_invitation(text, uuid, text, int) to authenticated;
grant execute on function public.admin_bulk_create_invitations(jsonb) to authenticated;
grant execute on function public.admin_revoke_invitation(uuid) to authenticated;
grant execute on function public.admin_list_auto_approve_domains() to authenticated;
grant execute on function public.admin_upsert_auto_approve_domain(text, uuid, text) to authenticated;
grant execute on function public.admin_delete_auto_approve_domain(uuid) to authenticated;
grant execute on function public.admin_list_signup_approvals(text, int, int) to authenticated;
grant execute on function public.admin_review_signup_approval(uuid, boolean, text) to authenticated;

-- ============================================================================
-- Step 4 — Vouchers
-- ============================================================================

create or replace function public.admin_list_vouchers(_active boolean default null, _lim int default 100, _off int default 0)
returns table (
  id uuid, code text, kind text, plan_tier text, credits int, auto_login boolean,
  max_redemptions int, expires_at timestamptz, campaign_tag text, active boolean,
  created_at timestamptz, redemptions_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
    select v.id, v.code, v.kind, v.plan_tier, v.credits, v.auto_login,
           v.max_redemptions, v.expires_at, v.campaign_tag, v.active, v.created_at,
           (select count(*) from public.voucher_redemptions r where r.voucher_id = v.id)
    from public.vouchers v
    where _active is null or v.active = _active
    order by v.created_at desc limit _lim offset _off;
end $$;

create or replace function public.admin_create_voucher(
  _code text, _kind text, _plan_tier text, _credits int, _auto_login boolean,
  _max_redemptions int, _expires_at timestamptz, _campaign_tag text
) returns public.vouchers
language plpgsql security definer set search_path = public as $$
declare _row public.vouchers;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.vouchers (code, kind, plan_tier, credits, auto_login, max_redemptions, expires_at, campaign_tag, created_by, active)
  values (upper(_code), _kind, _plan_tier, _credits, coalesce(_auto_login,false), _max_redemptions, _expires_at, _campaign_tag, auth.uid(), true)
  returning * into _row;
  perform public.admin_audit('create_voucher', 'voucher', _row.id::text, jsonb_build_object('code', _row.code, 'kind', _kind));
  return _row;
end $$;

create or replace function public.admin_update_voucher(
  _id uuid, _plan_tier text, _credits int, _auto_login boolean,
  _max_redemptions int, _expires_at timestamptz, _campaign_tag text, _active boolean
) returns public.vouchers
language plpgsql security definer set search_path = public as $$
declare _row public.vouchers;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.vouchers set
    plan_tier = coalesce(_plan_tier, plan_tier),
    credits = coalesce(_credits, credits),
    auto_login = coalesce(_auto_login, auto_login),
    max_redemptions = _max_redemptions,
    expires_at = _expires_at,
    campaign_tag = _campaign_tag,
    active = coalesce(_active, active)
  where id = _id returning * into _row;
  perform public.admin_audit('update_voucher', 'voucher', _id::text, '{}'::jsonb);
  return _row;
end $$;

create or replace function public.admin_deactivate_voucher(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.vouchers set active = false where id = _id;
  perform public.admin_audit('deactivate_voucher', 'voucher', _id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_list_voucher_redemptions(_voucher_id uuid)
returns table (id uuid, user_id uuid, user_email text, workspace_id uuid, redeemed_at timestamptz, meta jsonb)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
    select r.id, r.user_id, u.email::text, r.workspace_id, r.redeemed_at, r.meta
    from public.voucher_redemptions r
    left join auth.users u on u.id = r.user_id
    where r.voucher_id = _voucher_id
    order by r.redeemed_at desc limit 200;
end $$;

-- Public redeem fn: callable by an authenticated user against their own account.
-- (Signup-flow auto_login path stays admin-side via the create-user RPC; here
-- we handle credit_grant and plan_upgrade for an already-signed-in user.)
create or replace function public.redeem_voucher(_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _v public.vouchers;
  _count int;
  _aid uuid;
  _new_balance bigint;
begin
  if _uid is null then raise exception 'auth required'; end if;
  select * into _v from public.vouchers where code = upper(_code);
  if _v is null then return jsonb_build_object('ok', false, 'error', 'Invalid code'); end if;
  if not _v.active then return jsonb_build_object('ok', false, 'error', 'Code is no longer active'); end if;
  if _v.expires_at is not null and _v.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Code expired');
  end if;
  if _v.max_redemptions is not null then
    select count(*) into _count from public.voucher_redemptions where voucher_id = _v.id;
    if _count >= _v.max_redemptions then
      return jsonb_build_object('ok', false, 'error', 'Code fully redeemed');
    end if;
  end if;
  -- Prevent double-redeem by same user
  if exists (select 1 from public.voucher_redemptions where voucher_id = _v.id and user_id = _uid) then
    return jsonb_build_object('ok', false, 'error', 'Already redeemed');
  end if;

  if _v.kind = 'credit_grant' then
    select id into _aid from public.accounts where owner_id = _uid order by created_at asc limit 1;
    if _aid is null then return jsonb_build_object('ok', false, 'error', 'No account'); end if;
    insert into public.account_credits (account_id, balance_credits) values (_aid, 0) on conflict (account_id) do nothing;
    update public.account_credits set balance_credits = balance_credits + coalesce(_v.credits,0), updated_at = now()
      where account_id = _aid returning balance_credits into _new_balance;
    insert into public.credit_ledger (account_id, user_id, delta_credits, reason)
      values (_aid, _uid, coalesce(_v.credits,0), 'voucher:' || _v.code);
  elsif _v.kind = 'plan_upgrade' then
    update public.subscriptions
      set plan_override_tier = _v.plan_tier,
          plan_override_expires_at = _v.expires_at,
          plan_override_reason = 'voucher:' || _v.code
      where user_id = _uid;
    if not found then
      insert into public.subscriptions (user_id, plan_override_tier, plan_override_expires_at, plan_override_reason)
      values (_uid, _v.plan_tier, _v.expires_at, 'voucher:' || _v.code);
    end if;
  elsif _v.kind = 'signup' then
    -- For already-signed-in users, treat signup-kind as credit + plan
    if _v.plan_tier is not null then
      update public.subscriptions set plan_override_tier = _v.plan_tier,
          plan_override_expires_at = _v.expires_at, plan_override_reason = 'voucher:'||_v.code
        where user_id = _uid;
      if not found then
        insert into public.subscriptions (user_id, plan_override_tier, plan_override_expires_at, plan_override_reason)
        values (_uid, _v.plan_tier, _v.expires_at, 'voucher:'||_v.code);
      end if;
    end if;
    if coalesce(_v.credits,0) > 0 then
      select id into _aid from public.accounts where owner_id = _uid order by created_at asc limit 1;
      if _aid is not null then
        insert into public.account_credits (account_id, balance_credits) values (_aid, 0) on conflict (account_id) do nothing;
        update public.account_credits set balance_credits = balance_credits + _v.credits, updated_at = now()
          where account_id = _aid returning balance_credits into _new_balance;
        insert into public.credit_ledger (account_id, user_id, delta_credits, reason)
          values (_aid, _uid, _v.credits, 'voucher:'||_v.code);
      end if;
    end if;
  end if;

  insert into public.voucher_redemptions (voucher_id, user_id, meta)
    values (_v.id, _uid, jsonb_build_object('code', _v.code, 'kind', _v.kind));

  return jsonb_build_object('ok', true, 'kind', _v.kind, 'credits', _v.credits, 'plan_tier', _v.plan_tier);
end $$;

grant execute on function public.admin_list_vouchers(boolean, int, int) to authenticated;
grant execute on function public.admin_create_voucher(text, text, text, int, boolean, int, timestamptz, text) to authenticated;
grant execute on function public.admin_update_voucher(uuid, text, int, boolean, int, timestamptz, text, boolean) to authenticated;
grant execute on function public.admin_deactivate_voucher(uuid) to authenticated;
grant execute on function public.admin_list_voucher_redemptions(uuid) to authenticated;
grant execute on function public.redeem_voucher(text) to authenticated;

-- ============================================================================
-- Step 5 — Workspaces
-- ============================================================================

create or replace function public.admin_search_workspaces(_q text, _lim int default 25, _off int default 0)
returns table (
  id uuid, name text, slug text, owner_id uuid, owner_email text, plan_tier text,
  member_count bigint, balance_credits bigint, deleted_at timestamptz, created_at timestamptz
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
    select w.id, w.name, w.slug, w.owner_id, u.email::text,
           coalesce(w.plan_tier,'free'),
           (select count(*) from public.workspace_members wm where wm.workspace_id = w.id),
           0::bigint,
           w.deleted_at, w.created_at
    from public.workspaces w
    left join auth.users u on u.id = w.owner_id
    where _q is null or _q = '' or w.name ilike '%'||_q||'%' or w.slug ilike '%'||_q||'%' or u.email ilike '%'||_q||'%'
    order by w.created_at desc limit _lim offset _off;
end $$;

create or replace function public.admin_get_workspace_detail(_wid uuid)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare _r jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'owner_id', w.owner_id, 'plan_tier', w.plan_tier, 'deleted_at', w.deleted_at, 'created_at', w.created_at, 'auto_cluster_enabled', w.auto_cluster_enabled) from public.workspaces w where w.id = _wid),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', wm.user_id, 'email', u.email, 'role', wm.role)) from public.workspace_members wm left join auth.users u on u.id = wm.user_id where wm.workspace_id = _wid), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(to_jsonb(al) order by al.created_at desc) from public.admin_audit_log al where al.target_kind='workspace' and al.target_id = _wid::text limit 50), '[]'::jsonb)
  ) into _r;
  return _r;
end $$;

create or replace function public.admin_add_workspace_member(_wid uuid, _uid uuid, _role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (_wid, _uid, coalesce(_role,'member'))
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  perform public.admin_audit('add_member', 'workspace', _wid::text, jsonb_build_object('user_id', _uid, 'role', _role));
end $$;

create or replace function public.admin_remove_workspace_member(_wid uuid, _uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  delete from public.workspace_members where workspace_id = _wid and user_id = _uid;
  perform public.admin_audit('remove_member', 'workspace', _wid::text, jsonb_build_object('user_id', _uid));
end $$;

create or replace function public.admin_change_member_role(_wid uuid, _uid uuid, _role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.workspace_members set role = _role where workspace_id = _wid and user_id = _uid;
  perform public.admin_audit('change_member_role', 'workspace', _wid::text, jsonb_build_object('user_id', _uid, 'role', _role));
end $$;

create or replace function public.admin_transfer_workspace_ownership(_wid uuid, _new_owner uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.workspaces set owner_id = _new_owner where id = _wid;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (_wid, _new_owner, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';
  perform public.admin_audit('transfer_ownership', 'workspace', _wid::text, jsonb_build_object('new_owner', _new_owner));
end $$;

create or replace function public.admin_soft_delete_workspace(_wid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.workspaces set deleted_at = now() where id = _wid;
  perform public.admin_audit('soft_delete_workspace', 'workspace', _wid::text, '{}'::jsonb);
end $$;

create or replace function public.admin_restore_workspace(_wid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.workspaces set deleted_at = null where id = _wid;
  perform public.admin_audit('restore_workspace', 'workspace', _wid::text, '{}'::jsonb);
end $$;

grant execute on function public.admin_search_workspaces(text, int, int) to authenticated;
grant execute on function public.admin_get_workspace_detail(uuid) to authenticated;
grant execute on function public.admin_add_workspace_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.admin_change_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.admin_transfer_workspace_ownership(uuid, uuid) to authenticated;
grant execute on function public.admin_soft_delete_workspace(uuid) to authenticated;
grant execute on function public.admin_restore_workspace(uuid) to authenticated;

-- ============================================================================
-- Step 6 — Platform (flags, banner, audit log)
-- ============================================================================

create or replace function public.admin_list_flags()
returns setof public.feature_flags
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query select * from public.feature_flags order by key asc;
end $$;

create or replace function public.admin_upsert_flag(_key text, _enabled boolean, _payload jsonb)
returns public.feature_flags
language plpgsql security definer set search_path = public as $$
declare _r public.feature_flags;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.feature_flags (key, enabled, payload, updated_by, updated_at)
  values (_key, coalesce(_enabled,false), coalesce(_payload,'{}'::jsonb), auth.uid(), now())
  on conflict (key) do update set
    enabled = excluded.enabled,
    payload = excluded.payload,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into _r;
  perform public.admin_audit('upsert_flag', 'flag', _r.id::text, jsonb_build_object('key', _key, 'enabled', _enabled));
  return _r;
end $$;

create or replace function public.admin_delete_flag(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  delete from public.feature_flags where id = _id;
  perform public.admin_audit('delete_flag', 'flag', _id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_set_banner(_message text, _level text, _active boolean, _expires_at timestamptz)
returns public.system_banner
language plpgsql security definer set search_path = public as $$
declare _r public.system_banner;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  -- one-row-active: deactivate older banners when activating a new one
  if coalesce(_active,false) then
    update public.system_banner set active = false where active = true;
  end if;
  insert into public.system_banner (message, level, active, expires_at, updated_by, updated_at)
  values (_message, coalesce(_level,'info'), coalesce(_active,true), _expires_at, auth.uid(), now())
  returning * into _r;
  perform public.admin_audit('set_banner', 'banner', _r.id::text, jsonb_build_object('level', _level, 'active', _active));
  return _r;
end $$;

create or replace function public.admin_clear_banner()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.system_banner set active = false where active = true;
  perform public.admin_audit('clear_banner', 'banner', '*', '{}'::jsonb);
end $$;

create or replace function public.admin_list_audit_log(_target_kind text, _target_id text, _lim int default 100, _off int default 0)
returns table (id uuid, actor_user_id uuid, actor_email text, action text, target_kind text, target_id text, payload jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
    select al.id, al.actor_user_id, u.email::text, al.action, al.target_kind, al.target_id, al.payload, al.created_at
    from public.admin_audit_log al
    left join auth.users u on u.id = al.actor_user_id
    where (_target_kind is null or al.target_kind = _target_kind)
      and (_target_id is null or al.target_id = _target_id)
    order by al.created_at desc limit _lim offset _off;
end $$;

grant execute on function public.admin_list_flags() to authenticated;
grant execute on function public.admin_upsert_flag(text, boolean, jsonb) to authenticated;
grant execute on function public.admin_delete_flag(uuid) to authenticated;
grant execute on function public.admin_set_banner(text, text, boolean, timestamptz) to authenticated;
grant execute on function public.admin_clear_banner() to authenticated;
grant execute on function public.admin_list_audit_log(text, text, int, int) to authenticated;

-- ============================================================================
-- Step 7 — Cron tick: expire plan overrides + invitations
-- (callable by /api/public/hooks/* with cron key; gated by admin or service_role)
-- ============================================================================

create or replace function public.cron_tick_admin_expiries()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare _plan int := 0; _inv int := 0;
begin
  -- service_role bypass: pg_cron / hook runs as service role
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  with cleared as (
    update public.subscriptions
      set plan_override_tier = null, plan_override_expires_at = null, plan_override_reason = null
      where plan_override_expires_at is not null and plan_override_expires_at < now()
      returning user_id
  )
  select count(*) into _plan from cleared;

  with expired as (
    update public.invitations set state = 'expired'
      where state = 'pending' and expires_at < now()
      returning id
  )
  select count(*) into _inv from expired;

  return jsonb_build_object('plan_overrides_cleared', _plan, 'invitations_expired', _inv);
end $$;

grant execute on function public.cron_tick_admin_expiries() to authenticated, service_role;

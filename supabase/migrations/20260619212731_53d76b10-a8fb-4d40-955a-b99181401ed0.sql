-- WM-F1
alter table public.agents
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.agent_memory
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.agent_tools
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

update public.agents          set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_memory    set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_tools     set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_runs      set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
update public.agent_approvals set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;

create index if not exists idx_agents_workspace         on public.agents (workspace_id);
create index if not exists idx_agent_memory_workspace    on public.agent_memory (workspace_id);
create index if not exists idx_agent_tools_workspace     on public.agent_tools (workspace_id);
create index if not exists idx_agent_runs_workspace      on public.agent_runs (workspace_id);
create index if not exists idx_agent_approvals_workspace on public.agent_approvals (workspace_id);

drop function if exists public.match_agent_memory(vector, uuid, text, integer);
create or replace function public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text default null,
  match_count integer default 6,
  for_workspace uuid default null
) returns table (
  id uuid, content text, kind text, importance integer,
  agent_slug text, similarity double precision
) language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) as similarity
  from public.agent_memory m
  where m.user_id = coalesce(auth.uid(), for_user)
    and m.embedding is not null
    and (m.expires_at is null or m.expires_at > now())
    and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null)
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_agent_memory(vector, uuid, text, integer, uuid) from public, anon;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid) to authenticated;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid) to service_role;

drop function if exists public.recent_agent_reflections(uuid, text, integer);
create or replace function public.recent_agent_reflections(
  for_user uuid,
  for_agent_slug text,
  match_count integer default 5,
  for_workspace uuid default null
) returns table (
  id uuid, content text, importance integer, metadata jsonb, created_at timestamptz
) language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.importance, m.metadata, m.created_at
  from public.agent_memory m
  where m.user_id = coalesce(auth.uid(), for_user)
    and m.kind = 'reflection'
    and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null)
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.importance desc, m.created_at desc
  limit greatest(1, least(match_count, 20));
$$;
revoke execute on function public.recent_agent_reflections(uuid, text, integer, uuid) from public;
grant execute on function public.recent_agent_reflections(uuid, text, integer, uuid) to authenticated, service_role;

-- WM-M2
create or replace function public.credits_enabled()
returns boolean language sql immutable set search_path to 'public'
as $$ select false $$;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_tier text not null default 'free'
    check (plan_tier = any (array['free','pro','max','team','enterprise'])),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role = any (array['owner','admin','member','viewer'])),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create table if not exists public.account_credits (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  balance_credits bigint not null default 0,
  monthly_grant_credits bigint not null default 0,
  topup_credits bigint not null default 0,
  cycle_anchor timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  delta_credits bigint not null,
  reason text not null
    check (reason = any (array['grant','reset','debit','topup','adjustment'])),
  surface text,
  ai_event_id uuid,
  product_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.ensure_user_default_account(_user_id uuid)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare existing_id uuid; created_id uuid;
begin
  select m.account_id into existing_id from public.account_members m
    where m.user_id = _user_id order by m.created_at limit 1;
  if existing_id is not null then return existing_id; end if;
  select a.id into existing_id from public.accounts a
    where a.owner_id = _user_id order by a.created_at limit 1;
  if existing_id is not null then
    insert into public.account_members (account_id, user_id, role) values (existing_id, _user_id, 'owner')
      on conflict (account_id, user_id) do nothing;
    insert into public.account_credits (account_id) values (existing_id) on conflict (account_id) do nothing;
    return existing_id;
  end if;
  insert into public.accounts (owner_id) values (_user_id) returning id into created_id;
  insert into public.account_members (account_id, user_id, role) values (created_id, _user_id, 'owner')
    on conflict (account_id, user_id) do nothing;
  insert into public.account_credits (account_id) values (created_id) on conflict (account_id) do nothing;
  return created_id;
end; $$;

insert into public.accounts (owner_id, plan_tier, stripe_customer_id, stripe_subscription_id, plan_updated_at)
select distinct on (w.owner_id)
  w.owner_id, w.plan_tier, w.stripe_customer_id, w.stripe_subscription_id, w.plan_updated_at
from public.workspaces w
where not exists (select 1 from public.accounts a where a.owner_id = w.owner_id)
order by w.owner_id,
  case w.plan_tier when 'enterprise' then 5 when 'team' then 4 when 'max' then 3 when 'pro' then 2 else 1 end desc,
  (w.stripe_customer_id is not null) desc, w.plan_updated_at desc nulls last, w.created_at;

insert into public.account_members (account_id, user_id, role)
select a.id, a.owner_id, 'owner' from public.accounts a
on conflict (account_id, user_id) do nothing;

insert into public.account_credits (account_id)
select a.id from public.accounts a
on conflict (account_id) do nothing;

create or replace function public.protect_account_billing_columns()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if TG_OP = 'INSERT' then
      NEW.plan_tier := 'free';
      NEW.stripe_customer_id := null;
      NEW.stripe_subscription_id := null;
      NEW.plan_updated_at := null;
    else
      NEW.plan_tier := OLD.plan_tier;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.plan_updated_at := OLD.plan_updated_at;
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_protect_account_billing_columns on public.accounts;
create trigger trg_protect_account_billing_columns
  before insert or update on public.accounts
  for each row execute function public.protect_account_billing_columns();

drop trigger if exists trg_accounts_set_updated_at on public.accounts;
create trigger trg_accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_account_credits_set_updated_at on public.account_credits;
create trigger trg_account_credits_set_updated_at
  before update on public.account_credits
  for each row execute function public.set_updated_at();

alter table public.workspaces
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

update public.workspaces w
set account_id = a.id from public.accounts a
where a.owner_id = w.owner_id and w.account_id is null;

do $$ declare n bigint;
begin
  select count(*) into n from public.workspaces where account_id is null;
  if n > 0 then raise exception 'WM-M2 backfill incomplete: % workspaces still have a null account_id', n; end if;
end $$;

create or replace function public.set_workspace_account()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if NEW.account_id is null then
    NEW.account_id := public.ensure_user_default_account(NEW.owner_id);
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_set_workspace_account on public.workspaces;
create trigger trg_set_workspace_account
  before insert on public.workspaces
  for each row execute function public.set_workspace_account();

alter table public.workspaces alter column account_id set not null;

do $$
begin
  alter table public.workspaces drop constraint if exists workspaces_plan_tier_check;
  alter table public.workspaces
    add constraint workspaces_plan_tier_check
    check (plan_tier = any (array['free','pro','max','team','enterprise']));
end $$;

create or replace function public.set_agent_memory_expiry()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_paid boolean;
begin
  if not public.memory_expiry_enabled() then return NEW; end if;
  if TG_OP = 'INSERT' and coalesce(auth.role(), '') = 'service_role' and NEW.expires_at is not null then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.last_used_at is not distinct from OLD.last_used_at then return NEW; end if;
  select exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.user_id = NEW.user_id and w.plan_tier in ('pro', 'max', 'team', 'enterprise')
  ) into v_paid;
  if v_paid then NEW.expires_at := null;
  else NEW.expires_at := coalesce(NEW.last_used_at, NEW.created_at, now()) + interval '30 days';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_set_agent_memory_expiry on public.agent_memory;
create trigger trg_set_agent_memory_expiry
  before insert or update on public.agent_memory
  for each row execute function public.set_agent_memory_expiry();

create or replace function public.is_account_member(account uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.account_members m where m.account_id = account and m.user_id = auth.uid());
$$;

alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.account_credits enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "account members read account" on public.accounts;
create policy "account members read account" on public.accounts
  for select using (public.is_account_member(id));

drop policy if exists "account members read membership" on public.account_members;
create policy "account members read membership" on public.account_members
  for select using (public.is_account_member(account_id));

drop policy if exists "account members read credits" on public.account_credits;
create policy "account members read credits" on public.account_credits
  for select using (public.is_account_member(account_id));

drop policy if exists "account members read ledger" on public.credit_ledger;
create policy "account members read ledger" on public.credit_ledger
  for select using (public.is_account_member(account_id));

create index if not exists accounts_owner_id_idx on public.accounts (owner_id);
create index if not exists account_members_user_id_idx on public.account_members (user_id);
create index if not exists workspaces_account_id_idx on public.workspaces (account_id);
create index if not exists credit_ledger_account_created_idx on public.credit_ledger (account_id, created_at desc);
create index if not exists credit_ledger_product_idx on public.credit_ledger (product_id);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id);

-- WM-M12
create or replace function public.debit_account_credits(
  _account_id uuid, _credits bigint, _user_id uuid, _surface text, _ai_event_id uuid, _product_id uuid
) returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_included bigint; v_topup bigint; v_from_included bigint; v_from_topup bigint;
begin
  if _credits is null or _credits <= 0 then return; end if;
  select balance_credits, topup_credits into v_included, v_topup
    from public.account_credits where account_id = _account_id for update;
  if not found then return; end if;
  v_from_included := least(_credits, greatest(coalesce(v_included, 0), 0));
  v_from_topup := least(_credits - v_from_included, greatest(coalesce(v_topup, 0), 0));
  if v_from_included = 0 and v_from_topup = 0 then return; end if;
  update public.account_credits
     set balance_credits = coalesce(balance_credits, 0) - v_from_included,
         topup_credits = coalesce(topup_credits, 0) - v_from_topup
   where account_id = _account_id;
  insert into public.credit_ledger (account_id, user_id, delta_credits, reason, surface, ai_event_id, product_id)
  values (_account_id, _user_id, -(v_from_included + v_from_topup), 'debit', _surface, _ai_event_id, _product_id);
end; $$;

-- WM-M14
create table if not exists public.credit_caps (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  scope text not null check (scope in ('product', 'member')),
  target_id uuid not null,
  cap_credits bigint not null check (cap_credits >= 0),
  window_kind text not null default 'cycle' check (window_kind in ('cycle', 'day', 'month')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, scope, target_id, window_kind)
);
create index if not exists credit_caps_account_scope_idx on public.credit_caps (account_id, scope, enabled);
drop trigger if exists trg_credit_caps_set_updated_at on public.credit_caps;
create trigger trg_credit_caps_set_updated_at
  before update on public.credit_caps
  for each row execute function public.set_updated_at();
alter table public.credit_caps enable row level security;
drop policy if exists "account members read caps" on public.credit_caps;
create policy "account members read caps" on public.credit_caps
  for select using (public.is_account_member(account_id));
create index if not exists credit_ledger_account_user_created_idx
  on public.credit_ledger (account_id, user_id, created_at desc);
create index if not exists credit_ledger_account_product_created_idx
  on public.credit_ledger (account_id, product_id, created_at desc);

-- WM-F9
create or replace function public.set_row_workspace_from_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if NEW.workspace_id is null then
    NEW.workspace_id := public.ensure_user_default_workspace(NEW.user_id);
  end if;
  return NEW;
end; $$;

alter table public.meetings add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.meetings set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_meetings_workspace on public.meetings;
create trigger trg_set_meetings_workspace before insert on public.meetings for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.meetings where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 meetings backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.meetings alter column workspace_id set not null;
create index if not exists meetings_workspace_id_idx on public.meetings (workspace_id);
drop policy if exists "own meetings all" on public.meetings;
create policy "own meetings in member workspace" on public.meetings
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.notes add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.notes set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_notes_workspace on public.notes;
create trigger trg_set_notes_workspace before insert on public.notes for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.notes where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 notes backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.notes alter column workspace_id set not null;
create index if not exists notes_workspace_id_idx on public.notes (workspace_id);
drop policy if exists "own notes all" on public.notes;
create policy "own notes in member workspace" on public.notes
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.daily_briefs add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.daily_briefs set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_daily_briefs_workspace on public.daily_briefs;
create trigger trg_set_daily_briefs_workspace before insert on public.daily_briefs for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.daily_briefs where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 daily_briefs backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.daily_briefs alter column workspace_id set not null;
create index if not exists daily_briefs_workspace_id_idx on public.daily_briefs (workspace_id);
drop policy if exists "own briefs all" on public.daily_briefs;
create policy "own briefs in member workspace" on public.daily_briefs
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.copilot_messages add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.copilot_messages set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_copilot_messages_workspace on public.copilot_messages;
create trigger trg_set_copilot_messages_workspace before insert on public.copilot_messages for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.copilot_messages where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 copilot_messages backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.copilot_messages alter column workspace_id set not null;
create index if not exists copilot_messages_workspace_id_idx on public.copilot_messages (workspace_id);
drop policy if exists "own messages all" on public.copilot_messages;
create policy "own messages in member workspace" on public.copilot_messages
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.prototypes add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototypes set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_prototypes_workspace on public.prototypes;
create trigger trg_set_prototypes_workspace before insert on public.prototypes for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.prototypes where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototypes backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.prototypes alter column workspace_id set not null;
create index if not exists prototypes_workspace_id_idx on public.prototypes (workspace_id);
drop policy if exists "own prototypes all" on public.prototypes;
create policy "own prototypes in member workspace" on public.prototypes
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.prototype_files add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototype_files set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_prototype_files_workspace on public.prototype_files;
create trigger trg_set_prototype_files_workspace before insert on public.prototype_files for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.prototype_files where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototype_files backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.prototype_files alter column workspace_id set not null;
create index if not exists prototype_files_workspace_id_idx on public.prototype_files (workspace_id);
drop policy if exists "own prototype_files all" on public.prototype_files;
create policy "own prototype_files in member workspace" on public.prototype_files
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.prototype_messages add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototype_messages set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_prototype_messages_workspace on public.prototype_messages;
create trigger trg_set_prototype_messages_workspace before insert on public.prototype_messages for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.prototype_messages where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototype_messages backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.prototype_messages alter column workspace_id set not null;
create index if not exists prototype_messages_workspace_id_idx on public.prototype_messages (workspace_id);
drop policy if exists "own prototype_messages all" on public.prototype_messages;
create policy "own prototype_messages in member workspace" on public.prototype_messages
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.prototype_attachments add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototype_attachments set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_prototype_attachments_workspace on public.prototype_attachments;
create trigger trg_set_prototype_attachments_workspace before insert on public.prototype_attachments for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.prototype_attachments where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototype_attachments backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.prototype_attachments alter column workspace_id set not null;
create index if not exists prototype_attachments_workspace_id_idx on public.prototype_attachments (workspace_id);
drop policy if exists "own attachments all" on public.prototype_attachments;
create policy "own attachments in member workspace" on public.prototype_attachments
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.scheduler_proposals add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.scheduler_proposals set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_scheduler_proposals_workspace on public.scheduler_proposals;
create trigger trg_set_scheduler_proposals_workspace before insert on public.scheduler_proposals for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.scheduler_proposals where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 scheduler_proposals backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.scheduler_proposals alter column workspace_id set not null;
create index if not exists scheduler_proposals_workspace_id_idx on public.scheduler_proposals (workspace_id);
drop policy if exists "own scheduler_proposals all" on public.scheduler_proposals;
create policy "own scheduler_proposals in member workspace" on public.scheduler_proposals
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

alter table public.ritual_sessions add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.ritual_sessions set workspace_id = public.ensure_user_default_workspace(user_id) where workspace_id is null;
drop trigger if exists trg_set_ritual_sessions_workspace on public.ritual_sessions;
create trigger trg_set_ritual_sessions_workspace before insert on public.ritual_sessions for each row execute function public.set_row_workspace_from_user();
do $$ declare n bigint; begin select count(*) into n from public.ritual_sessions where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 ritual_sessions backfill incomplete: % null workspace_id', n; end if; end $$;
alter table public.ritual_sessions alter column workspace_id set not null;
create index if not exists ritual_sessions_workspace_id_idx on public.ritual_sessions (workspace_id);
drop policy if exists "own ritual_sessions all" on public.ritual_sessions;
create policy "own ritual_sessions in member workspace" on public.ritual_sessions
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- WM-M5
create or replace function public.limit_gates_enabled()
returns boolean language sql immutable set search_path to 'public'
as $$ select false $$;

create or replace function public.tier_product_limit(_tier text)
returns int language sql immutable set search_path to 'public'
as $$ select case _tier when 'free' then 2 when 'pro' then 3 when 'max' then 5 else null end; $$;

create or replace function public.tier_workspace_limit(_tier text)
returns int language sql immutable set search_path to 'public'
as $$ select case _tier when 'free' then 1 else null end; $$;

create or replace function public.enforce_product_limit()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_account uuid; v_tier text; v_limit int; v_count bigint;
begin
  if not public.limit_gates_enabled() then return NEW; end if;
  select w.account_id into v_account from public.workspaces w where w.id = NEW.workspace_id;
  if v_account is null then return NEW; end if;
  select a.plan_tier into v_tier from public.accounts a where a.id = v_account;
  v_limit := public.tier_product_limit(coalesce(v_tier, 'free'));
  if v_limit is null then return NEW; end if;
  select count(*) into v_count from public.projects p
    join public.workspaces w on w.id = p.workspace_id
    where w.account_id = v_account and p.archived_at is null;
  if v_count >= v_limit then
    raise exception 'Product limit reached for this plan (% allowed). Upgrade your plan to add more products.', v_limit
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_enforce_product_limit on public.projects;
create trigger trg_enforce_product_limit
  before insert on public.projects
  for each row execute function public.enforce_product_limit();

create or replace function public.enforce_workspace_limit()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_account uuid; v_tier text; v_limit int; v_count bigint;
begin
  if not public.limit_gates_enabled() then return NEW; end if;
  v_account := coalesce(NEW.account_id,
    (select a.id from public.accounts a where a.owner_id = NEW.owner_id order by a.created_at limit 1));
  if v_account is null then return NEW; end if;
  select a.plan_tier into v_tier from public.accounts a where a.id = v_account;
  v_limit := public.tier_workspace_limit(coalesce(v_tier, 'free'));
  if v_limit is null then return NEW; end if;
  select count(*) into v_count from public.workspaces w where w.account_id = v_account;
  if v_count >= v_limit then
    raise exception 'Workspace limit reached for this plan (% allowed). Upgrade your plan for pooled workspaces.', v_limit
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_enforce_workspace_limit on public.workspaces;
create trigger trg_enforce_workspace_limit
  before insert on public.workspaces
  for each row execute function public.enforce_workspace_limit();

-- WM-F3
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members
  add constraint workspace_members_role_check check (role = any (array['owner','admin','member','viewer']));

create or replace function public.has_workspace_role(ws uuid, required_roles text[])
returns boolean language sql security definer stable set search_path to 'public'
as $$
  select exists (select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any (required_roles));
$$;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

create or replace function public.has_account_role(account uuid, required_roles text[])
returns boolean language sql security definer stable set search_path to 'public'
as $$
  select exists (select 1 from public.account_members m
    where m.account_id = account and m.user_id = auth.uid() and m.role = any (required_roles));
$$;
grant execute on function public.has_account_role(uuid, text[]) to authenticated;

create or replace function public.is_workspace_owner(ws uuid)
returns boolean language sql security definer stable set search_path to 'public'
as $$ select public.has_workspace_role(ws, array['owner']); $$;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

create or replace function public.can_manage_workspace(ws uuid)
returns boolean language sql security definer stable set search_path to 'public'
as $$ select public.has_workspace_role(ws, array['owner', 'admin']); $$;
grant execute on function public.can_manage_workspace(uuid) to authenticated;

create or replace function public.is_account_owner(account uuid)
returns boolean language sql security definer stable set search_path to 'public'
as $$ select public.has_account_role(account, array['owner']); $$;
grant execute on function public.is_account_owner(uuid) to authenticated;

create or replace function public.can_manage_account(account uuid)
returns boolean language sql security definer stable set search_path to 'public'
as $$ select public.has_account_role(account, array['owner']); $$;
grant execute on function public.can_manage_account(uuid) to authenticated;

create or replace function public.prevent_workspace_owner_demotion()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_ws_owner_id uuid;
begin
  select w.owner_id into v_ws_owner_id from public.workspaces w where w.id = new.workspace_id;
  if v_ws_owner_id is null then return new; end if;
  if new.user_id = v_ws_owner_id and new.role != 'owner' then
    raise exception 'The workspace owner cannot be demoted to a lesser role.';
  end if;
  return new;
end; $$;
grant execute on function public.prevent_workspace_owner_demotion() to authenticated, service_role;

drop trigger if exists prevent_workspace_owner_demotion_trigger on public.workspace_members;
create trigger prevent_workspace_owner_demotion_trigger
before update on public.workspace_members
for each row execute function public.prevent_workspace_owner_demotion();

drop policy if exists "ws owner manage" on public.workspaces;
create policy "ws owner admin manage" on public.workspaces
  for all using (public.has_workspace_role(id, array['owner', 'admin']))
  with check (public.has_workspace_role(id, array['owner', 'admin']));

drop policy if exists "owner manages members" on public.workspace_members;
create policy "owner manages members" on public.workspace_members
  for all
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

alter table public.account_members enable row level security;
drop policy if exists "account members see own" on public.account_members;
create policy "account members see own" on public.account_members
  for select using (user_id = auth.uid());
drop policy if exists "account owner manages members" on public.account_members;
create policy "account owner manages members" on public.account_members
  for all
  using (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()));

alter table public.accounts enable row level security;
drop policy if exists "account members read" on public.accounts;
create policy "account members read" on public.accounts
  for select using (exists (select 1 from public.account_members m where m.account_id = id and m.user_id = auth.uid()));
drop policy if exists "account owner manage" on public.accounts;
create policy "account owner manage" on public.accounts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- WM-F1b
drop trigger if exists trg_set_agents_workspace on public.agents;
create trigger trg_set_agents_workspace before insert on public.agents for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agents all" on public.agents;
create policy "own agents in member workspace" on public.agents
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

drop trigger if exists trg_set_agent_memory_workspace on public.agent_memory;
create trigger trg_set_agent_memory_workspace before insert on public.agent_memory for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agent_memory all" on public.agent_memory;
create policy "own agent_memory in member workspace" on public.agent_memory
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

drop trigger if exists trg_set_agent_tools_workspace on public.agent_tools;
create trigger trg_set_agent_tools_workspace before insert on public.agent_tools for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agent_tools all" on public.agent_tools;
create policy "own agent_tools in member workspace" on public.agent_tools
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

drop trigger if exists trg_set_agent_runs_workspace on public.agent_runs;
create trigger trg_set_agent_runs_workspace before insert on public.agent_runs for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own runs all" on public.agent_runs;
create policy "own runs in member workspace" on public.agent_runs
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

drop trigger if exists trg_set_agent_approvals_workspace on public.agent_approvals;
create trigger trg_set_agent_approvals_workspace before insert on public.agent_approvals for each row execute function public.set_row_workspace_from_user();
drop policy if exists "own agent_approvals all" on public.agent_approvals;
create policy "own agent_approvals in member workspace" on public.agent_approvals
  for all using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- WM-M15b
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  cache_key text NOT NULL,
  prompt_tokens integer NOT NULL,
  completion_tokens integer NOT NULL,
  output_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT positive_tokens CHECK (prompt_tokens >= 0 AND completion_tokens >= 0)
);
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_lookup ON public.ai_response_cache (user_id, model, cache_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expired ON public.ai_response_cache (expires_at);
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- WM-F2
drop function if exists public.match_agent_memory(vector, uuid, text, integer, uuid);
create or replace function public.match_agent_memory(
  query_embedding vector(1536), for_user uuid, for_agent_slug text default null,
  match_count integer default 6, for_workspace uuid default null, for_account uuid default null
) returns table (id uuid, content text, kind text, importance integer, agent_slug text, similarity double precision)
language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) as similarity
  from public.agent_memory m
  where m.user_id = coalesce(auth.uid(), for_user)
    and m.embedding is not null
    and (m.expires_at is null or m.expires_at > now())
    and (
      (for_account is not null
        and (m.workspace_id is null
             or m.workspace_id in (select w.id from public.workspaces w where w.account_id = for_account)))
      or (for_account is null
        and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null))
    )
    and (for_account is null or auth.uid() is null or public.is_account_member(for_account))
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) from public, anon;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) to authenticated;
grant execute on function public.match_agent_memory(vector, uuid, text, integer, uuid, uuid) to service_role;

drop function if exists public.recent_agent_reflections(uuid, text, integer, uuid);
create or replace function public.recent_agent_reflections(
  for_user uuid, for_agent_slug text, match_count integer default 5,
  for_workspace uuid default null, for_account uuid default null
) returns table (id uuid, content text, importance integer, metadata jsonb, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select m.id, m.content, m.importance, m.metadata, m.created_at
  from public.agent_memory m
  where m.user_id = coalesce(auth.uid(), for_user) and m.kind = 'reflection'
    and (
      (for_account is not null
        and (m.workspace_id is null
             or m.workspace_id in (select w.id from public.workspaces w where w.account_id = for_account)))
      or (for_account is null
        and (for_workspace is null or m.workspace_id = for_workspace or m.workspace_id is null))
    )
    and (for_account is null or auth.uid() is null or public.is_account_member(for_account))
    and (auth.uid() is null or m.workspace_id is null or public.is_workspace_member(m.workspace_id))
    and (for_agent_slug is null or m.agent_slug = for_agent_slug or m.scope = 'global')
  order by m.importance desc, m.created_at desc
  limit greatest(1, least(match_count, 20));
$$;
revoke execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) from public;
grant execute on function public.recent_agent_reflections(uuid, text, integer, uuid, uuid) to authenticated, service_role;

-- WM-F4
create table if not exists public.workspace_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workspace_audit_log_ws_idx on public.workspace_audit_log (workspace_id, created_at desc);
alter table public.workspace_audit_log enable row level security;
drop policy if exists "ws members read audit" on public.workspace_audit_log;
create policy "ws members read audit" on public.workspace_audit_log
  for select using (public.is_workspace_member(workspace_id));

create or replace function public.transfer_workspace_ownership(_workspace_id uuid, _new_owner_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_current_owner uuid;
begin
  select owner_id into v_current_owner from public.workspaces where id = _workspace_id for update;
  if not found then raise exception 'Workspace not found.'; end if;
  if auth.uid() is not null and auth.uid() <> v_current_owner then
    raise exception 'Only the workspace owner can transfer ownership.';
  end if;
  if _new_owner_id = v_current_owner then return; end if;
  if not exists (select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _new_owner_id) then
    raise exception 'The new owner must be a member of the workspace.';
  end if;
  update public.workspaces set owner_id = _new_owner_id where id = _workspace_id;
  update public.workspace_members set role = 'owner'
    where workspace_id = _workspace_id and user_id = _new_owner_id;
  update public.workspace_members set role = 'admin'
    where workspace_id = _workspace_id and user_id = v_current_owner;
  insert into public.workspace_audit_log (workspace_id, actor_id, action, detail)
  values (_workspace_id, coalesce(auth.uid(), v_current_owner), 'ownership_transfer',
    jsonb_build_object('from', v_current_owner, 'to', _new_owner_id));
end; $$;
revoke execute on function public.transfer_workspace_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated, service_role;

-- WM-F5
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role = any (array['admin','member','viewer'])),
  token text not null unique default gen_random_uuid()::text,
  status text not null default 'pending' check (status = any (array['pending','accepted','revoked','expired'])),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists workspace_invitations_ws_idx on public.workspace_invitations (workspace_id, status);
create index if not exists workspace_invitations_token_idx on public.workspace_invitations (token);
alter table public.workspace_invitations enable row level security;
drop policy if exists "ws managers manage invitations" on public.workspace_invitations;
create policy "ws managers manage invitations" on public.workspace_invitations
  for all using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

create or replace function public.accept_workspace_invitation(_token text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare v_inv public.workspace_invitations; v_email text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept an invitation.'; end if;
  select * into v_inv from public.workspace_invitations where token = _token for update;
  if not found then raise exception 'Invitation not found.'; end if;
  if v_inv.status <> 'pending' then raise exception 'This invitation is no longer valid.'; end if;
  if v_inv.expires_at < now() then
    update public.workspace_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'This invitation has expired.';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null or lower(v_email) <> lower(v_inv.email) then
    raise exception 'This invitation was sent to a different email address.';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_inv.workspace_id, auth.uid(), v_inv.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  update public.workspace_invitations
    set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    where id = v_inv.id;
  return v_inv.workspace_id;
end; $$;
revoke execute on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.accept_workspace_invitation(text) to authenticated, service_role;

-- Studio multi-file constraints
CREATE TABLE IF NOT EXISTS public.studio_changeset_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL UNIQUE REFERENCES public.missions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  allowed_paths text[] NOT NULL DEFAULT '{}',
  max_files int CHECK (max_files IS NULL OR max_files > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_studio_constraints_ws ON public.studio_changeset_constraints (workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_changeset_constraints TO authenticated;
GRANT ALL ON public.studio_changeset_constraints TO service_role;
ALTER TABLE public.studio_changeset_constraints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "studio_constraints ws read" ON public.studio_changeset_constraints;
CREATE POLICY "studio_constraints ws read" ON public.studio_changeset_constraints
  FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "studio_constraints ws write" ON public.studio_changeset_constraints;
CREATE POLICY "studio_constraints ws write" ON public.studio_changeset_constraints
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

-- WM-F6
create or replace function public.move_product(_product_id uuid, _dest_workspace_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare _src_workspace_id uuid; _src_account uuid; _dest_account uuid;
begin
  select workspace_id into _src_workspace_id from public.projects where id = _product_id for update;
  if _src_workspace_id is null then raise exception 'Product not found.' using errcode = 'P0002'; end if;
  if _dest_workspace_id = _src_workspace_id then raise exception 'The product is already in that workspace.'; end if;
  select account_id into _dest_account from public.workspaces where id = _dest_workspace_id;
  if not found then raise exception 'Destination workspace not found.'; end if;
  select account_id into _src_account from public.workspaces where id = _src_workspace_id;
  if _src_account is distinct from _dest_account then
    raise exception 'A product can only move between workspaces in the same account.';
  end if;
  if not public.can_manage_workspace(_src_workspace_id) then
    raise exception 'You must be an owner or admin of the source workspace.';
  end if;
  if not public.can_manage_workspace(_dest_workspace_id) then
    raise exception 'You must be an owner or admin of the destination workspace.';
  end if;
  update public.projects set workspace_id = _dest_workspace_id where id = _product_id;
  update public.signals set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.themes set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.opportunities set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.prds set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.docs set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.tasks set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.decisions set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.conversations set workspace_id = _dest_workspace_id where project_id = _product_id or product_id = _product_id;
  update public.notes set workspace_id = _dest_workspace_id where project_id = _product_id;
  update public.prototypes set workspace_id = _dest_workspace_id where project_id = _product_id;
  update public.ai_events set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.connection_bindings set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.rag_chunks set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.studio_changesets set workspace_id = _dest_workspace_id where product_id = _product_id;
  update public.doc_versions set workspace_id = _dest_workspace_id
    where doc_id in (select id from public.docs where project_id = _product_id or product_id = _product_id);
  update public.messages set workspace_id = _dest_workspace_id
    where conversation_id in (select id from public.conversations where project_id = _product_id or product_id = _product_id);
  update public.learnings set workspace_id = _dest_workspace_id
    where opportunity_id in (select id from public.opportunities where project_id = _product_id or product_id = _product_id)
       or prd_id in (select id from public.prds where project_id = _product_id or product_id = _product_id);
end; $$;
revoke all on function public.move_product(uuid, uuid) from public, anon;
grant execute on function public.move_product(uuid, uuid) to authenticated;

-- Data retention
create or replace function public.data_retention_enabled()
returns boolean language sql immutable set search_path to 'public'
as $$ select false $$;

create or replace function public.purge_old_telemetry(_older_than_days integer default 180)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare _cutoff timestamptz; _ai_events bigint := 0; _prompt_runs bigint := 0; _tool_calls bigint := 0;
begin
  if not public.data_retention_enabled() then return jsonb_build_object('skipped', 'dormant'); end if;
  if _older_than_days is null or _older_than_days < 30 then _older_than_days := 30; end if;
  _cutoff := now() - make_interval(days => _older_than_days);
  delete from public.ai_events where created_at < _cutoff;
  get diagnostics _ai_events = row_count;
  delete from public.prompt_runs where created_at < _cutoff;
  get diagnostics _prompt_runs = row_count;
  delete from public.tool_calls where created_at < _cutoff;
  get diagnostics _tool_calls = row_count;
  return jsonb_build_object('ai_events', _ai_events, 'prompt_runs', _prompt_runs,
    'tool_calls', _tool_calls, 'cutoff', _cutoff, 'days', _older_than_days);
end; $$;
revoke all on function public.purge_old_telemetry(integer) from public, anon, authenticated;
grant execute on function public.purge_old_telemetry(integer) to service_role;

-- Export log
create table if not exists public.export_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workspace_id uuid,
  kind text not null check (kind in ('product', 'workspace')),
  target_id uuid,
  sections text[],
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.export_log enable row level security;
create policy "export_log insert own" on public.export_log
  for insert to authenticated with check (user_id = auth.uid());
create policy "export_log read own or workspace" on public.export_log
  for select to authenticated
  using (user_id = auth.uid() or (workspace_id is not null and public.is_workspace_member(workspace_id)));
create index if not exists export_log_workspace_created_idx on public.export_log (workspace_id, created_at desc);
create index if not exists export_log_user_created_idx on public.export_log (user_id, created_at desc);

-- R3 notification prefs
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_approvals BOOLEAN NOT null DEFAULT true,
  email_health BOOLEAN NOT null DEFAULT true,
  email_budget BOOLEAN NOT null DEFAULT true,
  email_drift BOOLEAN NOT null DEFAULT true,
  in_app_approvals BOOLEAN NOT null DEFAULT true,
  in_app_health BOOLEAN NOT null DEFAULT true,
  in_app_budget BOOLEAN NOT null DEFAULT true,
  in_app_drift BOOLEAN NOT null DEFAULT true,
  digest_approvals BOOLEAN NOT null DEFAULT true,
  digest_health BOOLEAN NOT null DEFAULT true,
  digest_budget BOOLEAN NOT null DEFAULT true,
  digest_drift BOOLEAN NOT null DEFAULT true,
  digest_frequency TEXT NOT null DEFAULT 'daily' CHECK (digest_frequency = any (array['daily', 'weekly'])),
  updated_at TIMESTAMPTZ NOT null DEFAULT now()
);
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- P7 cost incidents
CREATE TABLE IF NOT EXISTS public.cost_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  trace_id TEXT,
  amount_usd NUMERIC(10, 2),
  window_kind TEXT CHECK (window_kind IN ('day', 'month')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_incidents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS cost_incidents_workspace_idx ON public.cost_incidents (workspace_id, created_at DESC);
DROP POLICY IF EXISTS "ws members read" ON public.cost_incidents;
CREATE POLICY "ws members read" ON public.cost_incidents
  FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "ws members insert" ON public.cost_incidents;
CREATE POLICY "ws members insert" ON public.cost_incidents
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
GRANT SELECT, INSERT ON public.cost_incidents TO authenticated;
GRANT ALL ON public.cost_incidents TO service_role;
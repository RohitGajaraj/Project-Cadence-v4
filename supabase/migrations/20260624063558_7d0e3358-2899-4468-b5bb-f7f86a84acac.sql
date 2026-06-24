create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  workspace_id  uuid not null default public.current_user_default_workspace()
                  references public.workspaces (id) on delete cascade,
  product_id    uuid references public.projects (id) on delete set null,
  external_id   text,
  source        text not null default 'manual',
  subject       text,
  body          text not null,
  requester     text,
  status        text not null default 'open' check (status in ('open', 'triaged', 'closed')),
  cluster_key   text,
  signal_id     uuid references public.signals (id) on delete set null,
  created_at    timestamptz not null default now(),
  triaged_at    timestamptz
);

create index if not exists support_tickets_ws_status_idx
  on public.support_tickets (workspace_id, status, created_at desc);

create index if not exists support_tickets_ws_cluster_idx
  on public.support_tickets (workspace_id, cluster_key);

grant select, insert, update, delete on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets ws read" on public.support_tickets;
create policy "support_tickets ws read"
  on public.support_tickets for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "support_tickets ws write" on public.support_tickets;
create policy "support_tickets ws write"
  on public.support_tickets for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
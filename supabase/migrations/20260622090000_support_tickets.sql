-- M1 / LRN-01 (Support triage loop): the `support_tickets` table.
--
-- Inbound support tickets that the triage loop clusters into recurring themes and
-- feeds back into Discover as `signals` (source 'support-triage'). Workspace-scoped
-- and RLS-keyed on workspace membership, exactly like `signals`. The inbound channel
-- (Intercom/Zendesk/email ingestion) is founder-gated and not wired yet; this table
-- + its server functions are the dormant, RLS-safe core that channel plugs into.
--
-- Forward-only and idempotent (create if not exists + drop policy if exists).

create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  workspace_id  uuid not null default public.current_user_default_workspace()
                  references public.workspaces (id) on delete cascade,
  product_id    uuid references public.projects (id) on delete set null,
  -- The originating channel's own ticket id, kept for future de-duplication once a
  -- live inbound channel is wired (null for manual/paste entry).
  external_id   text,
  source        text not null default 'manual',
  subject       text,
  body          text not null,
  requester     text,
  status        text not null default 'open' check (status in ('open', 'triaged', 'closed')),
  -- Set when the ticket is clustered: the deterministic cluster key + the emitted signal.
  cluster_key   text,
  signal_id     uuid references public.signals (id) on delete set null,
  created_at    timestamptz not null default now(),
  triaged_at    timestamptz
);

create index if not exists support_tickets_ws_status_idx
  on public.support_tickets (workspace_id, status, created_at desc);

create index if not exists support_tickets_ws_cluster_idx
  on public.support_tickets (workspace_id, cluster_key);

alter table public.support_tickets enable row level security;

-- Explicit grants (self-documenting the surface).
grant select, insert, update, delete on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

-- RLS: workspace members read + write their workspace's tickets (mirrors `signals`).
drop policy if exists "support_tickets ws read" on public.support_tickets;
create policy "support_tickets ws read"
  on public.support_tickets for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "support_tickets ws write" on public.support_tickets;
create policy "support_tickets ws write"
  on public.support_tickets for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

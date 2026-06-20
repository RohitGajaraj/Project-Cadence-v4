-- H2-AUDIT - append-only audit trail for outcome-roadmap commitments.
--
-- "Why is this on the roadmap?" is the recurring senior-PM justification burden
-- (considerations.md, PM lens, P0/P1). H2-WRITES made a Now/Next/Later commitment
-- a governed promise (a declared outcome + measure); this records every roadmap
-- DECISION event - a bucket move and an outcome commit - capturing the declared
-- outcome AT COMMIT TIME, so the answer to "why / when was this prioritized, and
-- what outcome did we promise then" is reconstructable from evidence, not memory.
--
-- Append-only by design (mirrors export_log / U6-AUDIT): a member may INSERT their
-- own event and READ events for themselves or any workspace they belong to, with
-- NO update/delete policies, so the trail is tamper-evident for authenticated
-- users. workspace_id scopes the read (an owner sees the whole workspace's roadmap
-- history). FK to opportunities ON DELETE CASCADE: if the opportunity is erased
-- (e.g. DATA-RETENTION-b), its audit rows go with it, so the audit never outlives
-- the tenant data it describes.
--
-- Additive / forward-only / idempotent. Depends on `opportunities` (id) and the WM
-- `is_workspace_member` helper, both already live.

create table if not exists public.roadmap_audit (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  workspace_id uuid,
  action text not null check (action in ('move', 'commit')),
  from_bucket text check (from_bucket in ('now', 'next', 'later')),
  to_bucket text check (to_bucket in ('now', 'next', 'later')),
  outcome text,
  measure text,
  created_at timestamptz not null default now()
);

alter table public.roadmap_audit enable row level security;

-- Idempotent policy creation: drop-then-create (CREATE POLICY has no IF NOT EXISTS;
-- the bare form is what broke a prior migration on apply - WM-F3 ERROR 42601).
drop policy if exists "roadmap_audit insert own" on public.roadmap_audit;
create policy "roadmap_audit insert own"
  on public.roadmap_audit for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "roadmap_audit read own or workspace" on public.roadmap_audit;
create policy "roadmap_audit read own or workspace"
  on public.roadmap_audit for select to authenticated
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create index if not exists roadmap_audit_opportunity_created_idx
  on public.roadmap_audit (opportunity_id, created_at desc);
create index if not exists roadmap_audit_workspace_created_idx
  on public.roadmap_audit (workspace_id, created_at desc);

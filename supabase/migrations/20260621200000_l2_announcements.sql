-- L2, Customer announcements (backend + approval-to-publish governance).
--
-- A workspace-scoped `announcements` table with a draft -> pending -> published
-- lifecycle. Governance is enforced at the DB layer (not only in the app):
--   * A contributing member (owner/admin/member, NOT a read-only viewer) may
--     create/edit a draft and submit it for approval.
--   * Only a workspace owner/admin may publish, via the SECURITY DEFINER
--     `publish_announcement` RPC, which re-checks `can_manage_workspace` inside the
--     transaction and requires the row to be in `pending`.
--   * The public (anon) can read ONLY published announcements, the
--     `status = 'published'` predicate lives IN the RLS policy, so a draft can
--     never be exposed regardless of any application-layer mistake.
-- Mirrors the pure governance module `src/lib/announcements.ts` (same transition +
-- publish-role rule), so the two layers cannot drift.

create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  slug          text not null unique,
  title         text not null check (char_length(title) between 1 and 200),
  body          text not null default '',
  status        text not null default 'draft' check (status in ('draft', 'pending', 'published')),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  submitted_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists announcements_workspace_status_idx
  on public.announcements (workspace_id, status, created_at desc);
create index if not exists announcements_slug_idx
  on public.announcements (slug);

alter table public.announcements enable row level security;

-- Explicit grants (self-documenting the surface for a security-load-bearing table,
-- matching the missions/cost_incidents convention). RLS is the real gate; the anon
-- SELECT is intended and safe (the published-only policy restricts it).
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
grant select on public.announcements to anon;

-- 1. Workspace members read their own workspace's announcements (all statuses).
--    Anon has no auth.uid(), so `is_workspace_member` is false for it here.
drop policy if exists "announcements members read" on public.announcements;
create policy "announcements members read"
  on public.announcements for select
  using (public.is_workspace_member(workspace_id));

-- 2. Public (incl. anon) reads ONLY published announcements. The status predicate
--    is structural: a draft/pending row can never match this policy.
drop policy if exists "announcements public read published" on public.announcements;
create policy "announcements public read published"
  on public.announcements for select
  using (status = 'published');

-- 3. A CONTRIBUTING member (owner/admin/member, NOT a read-only viewer) may insert a
--    draft (status must be draft; created_by = self). The role gate mirrors the pure
--    `applyTransition` rule, so the DB and the app cannot drift on who may contribute.
drop policy if exists "announcements members create draft" on public.announcements;
create policy "announcements members create draft"
  on public.announcements for insert
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
    and status = 'draft'
    and created_by = auth.uid()
  );

-- 4. A contributing member may update a draft/pending row, but CANNOT flip it to
--    published via a plain update (the with-check forbids the published status), and a
--    viewer cannot edit at all (role gate). Publishing is owned exclusively by the
--    SECURITY DEFINER RPC below.
drop policy if exists "announcements members update" on public.announcements;
create policy "announcements members update"
  on public.announcements for update
  using (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
    and status in ('draft', 'pending')
  )
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
    and status in ('draft', 'pending')
  );

drop trigger if exists trg_announcements_updated on public.announcements;
create trigger trg_announcements_updated
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- Governed publish: owner/admin only, pending -> published. SECURITY DEFINER so it
-- can write the published status (which the member update policy forbids), but it
-- re-checks `can_manage_workspace` first, so an unprivileged caller is rejected at
-- the DB layer even if the app-layer guard were bypassed.
create or replace function public.publish_announcement(
  _announcement_id uuid,
  _workspace_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.can_manage_workspace(_workspace_id) then
    raise exception 'Only workspace owners and admins can publish announcements.';
  end if;

  update public.announcements
    set status = 'published',
        published_at = now()
  where id = _announcement_id
    and workspace_id = _workspace_id
    and status = 'pending';

  if not found then
    raise exception 'Announcement not found, not pending, or workspace mismatch.';
  end if;
end;
$$;

revoke execute on function public.publish_announcement(uuid, uuid) from public, anon;
grant execute on function public.publish_announcement(uuid, uuid) to authenticated, service_role;

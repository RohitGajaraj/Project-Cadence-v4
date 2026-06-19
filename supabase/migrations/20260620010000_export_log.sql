-- U6-AUDIT - append-only audit trail for data-portability exports.
--
-- The U6 export wizard lets a user download their product/workspace data as JSON.
-- For an enterprise/compliance posture, every such data egress should be recorded
-- (who exported what, how much, when) so a workspace owner can audit it. This adds
-- the audit table; `exportProduct` / `exportWorkspace` write one row per export.
--
-- Append-only by design: a member may INSERT their own record and READ records for
-- themselves or any workspace they belong to (so an owner sees all egress), but
-- there are deliberately NO update/delete policies - so the trail is tamper-evident
-- for authenticated users. service_role bypasses RLS (e.g. for a future retention
-- purge of very old audit rows).

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

create policy "export_log insert own"
  on public.export_log for insert to authenticated
  with check (user_id = auth.uid());

create policy "export_log read own or workspace"
  on public.export_log for select to authenticated
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create index if not exists export_log_workspace_created_idx
  on public.export_log (workspace_id, created_at desc);
create index if not exists export_log_user_created_idx
  on public.export_log (user_id, created_at desc);

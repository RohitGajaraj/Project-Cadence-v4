-- WM-F9: isolation audit + scope leak fixes.
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-F9).
-- meetings, notes, daily_briefs, and copilot_messages were still scoped only by
-- `auth.uid() = user_id` with no workspace_id, inconsistent with the rest of the tenancy
-- model (WM-F1, WM-M2) and a latent cross-workspace scope gap once invites (WM-F5) ship.
-- This adds workspace_id + a deterministic backfill + a DUAL-KEY membership RLS to each.
--
-- The WM-F9 audit clause ("audit for any other domain table missing scope") + an
-- adversarial review extended the same fix to the prototype family (prototypes,
-- prototype_files, prototype_messages, prototype_attachments), scheduler_proposals, and
-- ritual_sessions (which already had a workspace_id column but an owner-only policy). Ten
-- tables total. sync_mappings is an explicit documented deferral (see the audit verdict
-- block lower down). Public-share policies on prototypes/prototype_files are preserved.
--
-- The RLS stays USER-PRIVATE per the acceptance ("a second member cannot read the owner's
-- meetings/notes/briefs/chat"): the new policy is `auth.uid() = user_id AND
-- is_workspace_member(workspace_id)`, which adds workspace scoping and never widens access
-- (a second member still cannot read another member's rows).
--
-- NOT NULL is made safe the WM-M2 way (NOT the WM-F1 way): a BEFORE-INSERT trigger fills
-- workspace_id from NEW.user_id (NOT auth.uid()), so it works for the user-authed writers
-- (meetings/notes/copilot/brief) AND the service-role agent tool `notes.create`
-- (registry.server.ts), where auth.uid() is null. No app insert needs to set workspace_id.
--
-- Idempotent. Depends on WM-F1/earlier (workspaces, is_workspace_member,
-- ensure_user_default_workspace). Activates on the founder's next publish (not dormant).

-- Shared BEFORE-INSERT filler: tag the row's workspace from its own user_id when unset.
-- SECURITY DEFINER + sourced from NEW.user_id, so it is service-role-safe.
create or replace function public.set_row_workspace_from_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if NEW.workspace_id is null then
    NEW.workspace_id := public.ensure_user_default_workspace(NEW.user_id);
  end if;
  return NEW;
end;
$$;

-- 1. meetings
alter table public.meetings
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.meetings set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_meetings_workspace on public.meetings;
create trigger trg_set_meetings_workspace
  before insert on public.meetings
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.meetings where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 meetings backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.meetings alter column workspace_id set not null;
create index if not exists meetings_workspace_id_idx on public.meetings (workspace_id);
drop policy if exists "own meetings all" on public.meetings;
create policy "own meetings in member workspace" on public.meetings
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 2. notes
alter table public.notes
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.notes set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_notes_workspace on public.notes;
create trigger trg_set_notes_workspace
  before insert on public.notes
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.notes where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 notes backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.notes alter column workspace_id set not null;
create index if not exists notes_workspace_id_idx on public.notes (workspace_id);
drop policy if exists "own notes all" on public.notes;
create policy "own notes in member workspace" on public.notes
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 3. daily_briefs
alter table public.daily_briefs
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.daily_briefs set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_daily_briefs_workspace on public.daily_briefs;
create trigger trg_set_daily_briefs_workspace
  before insert on public.daily_briefs
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.daily_briefs where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 daily_briefs backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.daily_briefs alter column workspace_id set not null;
create index if not exists daily_briefs_workspace_id_idx on public.daily_briefs (workspace_id);
drop policy if exists "own briefs all" on public.daily_briefs;
create policy "own briefs in member workspace" on public.daily_briefs
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 4. copilot_messages
alter table public.copilot_messages
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.copilot_messages set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_copilot_messages_workspace on public.copilot_messages;
create trigger trg_set_copilot_messages_workspace
  before insert on public.copilot_messages
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.copilot_messages where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 copilot_messages backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.copilot_messages alter column workspace_id set not null;
create index if not exists copilot_messages_workspace_id_idx on public.copilot_messages (workspace_id);
drop policy if exists "own messages all" on public.copilot_messages;
create policy "own messages in member workspace" on public.copilot_messages
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- ===========================================================================
-- Audit extension (adversarial-review-driven; WM-F9 "audit for any other domain
-- table missing scope"). The same owner-only / no-workspace_id leak class was
-- found on the prototype family, scheduler_proposals, and ritual_sessions (which
-- already carried a workspace_id column but kept an owner-only policy, so the
-- column was decorative). Identical safe pattern: the dual-key RLS is strictly
-- MORE restrictive than the prior auth.uid() = user_id (it can never widen
-- access), and the trigger fills workspace_id from NEW.user_id. The public-share
-- SELECT policies on prototypes / prototype_files are PRESERVED (only the owner
-- "all" policy is swapped).
--
-- Audit verdict on `sync_mappings` (owner-only, no workspace_id): DEFERRED, not a
-- silent miss. It is connector-internal sync STATE (local<->remote version
-- mapping), not user content, and is read per-user by the sync engine; scoping it
-- belongs with the connectors workspace-binding work once the sync reader pattern
-- is confirmed. It stays strictly user-private (auth.uid() = user_id) until then.
-- ===========================================================================

-- 5. prototypes (preserve the "public prototypes readable" share policy)
alter table public.prototypes
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototypes set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_prototypes_workspace on public.prototypes;
create trigger trg_set_prototypes_workspace
  before insert on public.prototypes
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.prototypes where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototypes backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.prototypes alter column workspace_id set not null;
create index if not exists prototypes_workspace_id_idx on public.prototypes (workspace_id);
drop policy if exists "own prototypes all" on public.prototypes;
create policy "own prototypes in member workspace" on public.prototypes
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 6. prototype_files (preserve the "public prototype_files readable" share policy)
alter table public.prototype_files
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototype_files set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_prototype_files_workspace on public.prototype_files;
create trigger trg_set_prototype_files_workspace
  before insert on public.prototype_files
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.prototype_files where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototype_files backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.prototype_files alter column workspace_id set not null;
create index if not exists prototype_files_workspace_id_idx on public.prototype_files (workspace_id);
drop policy if exists "own prototype_files all" on public.prototype_files;
create policy "own prototype_files in member workspace" on public.prototype_files
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 7. prototype_messages
alter table public.prototype_messages
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototype_messages set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_prototype_messages_workspace on public.prototype_messages;
create trigger trg_set_prototype_messages_workspace
  before insert on public.prototype_messages
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.prototype_messages where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototype_messages backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.prototype_messages alter column workspace_id set not null;
create index if not exists prototype_messages_workspace_id_idx on public.prototype_messages (workspace_id);
drop policy if exists "own prototype_messages all" on public.prototype_messages;
create policy "own prototype_messages in member workspace" on public.prototype_messages
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 8. prototype_attachments (existing policy is named "own attachments all")
alter table public.prototype_attachments
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prototype_attachments set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_prototype_attachments_workspace on public.prototype_attachments;
create trigger trg_set_prototype_attachments_workspace
  before insert on public.prototype_attachments
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.prototype_attachments where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 prototype_attachments backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.prototype_attachments alter column workspace_id set not null;
create index if not exists prototype_attachments_workspace_id_idx on public.prototype_attachments (workspace_id);
drop policy if exists "own attachments all" on public.prototype_attachments;
create policy "own attachments in member workspace" on public.prototype_attachments
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 9. scheduler_proposals
alter table public.scheduler_proposals
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.scheduler_proposals set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_scheduler_proposals_workspace on public.scheduler_proposals;
create trigger trg_set_scheduler_proposals_workspace
  before insert on public.scheduler_proposals
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.scheduler_proposals where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 scheduler_proposals backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.scheduler_proposals alter column workspace_id set not null;
create index if not exists scheduler_proposals_workspace_id_idx on public.scheduler_proposals (workspace_id);
drop policy if exists "own scheduler_proposals all" on public.scheduler_proposals;
create policy "own scheduler_proposals in member workspace" on public.scheduler_proposals
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- 10. ritual_sessions (workspace_id column already exists but was unenforced;
--     backfill any nulls, add the filler trigger, enforce NOT NULL + dual-key RLS)
alter table public.ritual_sessions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.ritual_sessions set workspace_id = public.ensure_user_default_workspace(user_id)
  where workspace_id is null;
drop trigger if exists trg_set_ritual_sessions_workspace on public.ritual_sessions;
create trigger trg_set_ritual_sessions_workspace
  before insert on public.ritual_sessions
  for each row execute function public.set_row_workspace_from_user();
do $$
declare n bigint;
begin
  select count(*) into n from public.ritual_sessions where workspace_id is null;
  if n > 0 then raise exception 'WM-F9 ritual_sessions backfill incomplete: % null workspace_id', n; end if;
end $$;
alter table public.ritual_sessions alter column workspace_id set not null;
create index if not exists ritual_sessions_workspace_id_idx on public.ritual_sessions (workspace_id);
drop policy if exists "own ritual_sessions all" on public.ritual_sessions;
create policy "own ritual_sessions in member workspace" on public.ritual_sessions
  for all
  using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
  with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));

-- WM-F4 UI / Members surface: identity for the workspace members list.
--
-- profiles RLS is own-row-only (auth.uid() = id) and a member's email lives in auth.users,
-- so a normal client/server read can never show co-members' names or emails. This
-- membership-gated SECURITY DEFINER RPC returns each member's role + identity (display_name
-- from profiles, email from auth.users) to any caller who is themselves a member of the
-- workspace. It is READ-ONLY (no writes) and the membership gate runs first, so it leaks
-- nothing to a non-member. auth.uid() reads the request JWT and is preserved across the
-- SECURITY DEFINER boundary, so is_workspace_member(_workspace_id) checks the CALLER.

create or replace function public.workspace_members_with_identity(_workspace_id uuid)
returns table (
  user_id uuid,
  role text,
  created_at timestamptz,
  display_name text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(_workspace_id) then
    raise exception 'Not a member of this workspace';
  end if;

  return query
    select
      m.user_id,
      m.role::text,
      m.created_at,
      p.display_name,
      u.email::text
    from public.workspace_members m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.workspace_id = _workspace_id
    order by m.created_at asc;
end;
$$;

grant execute on function public.workspace_members_with_identity(uuid) to authenticated;

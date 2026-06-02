
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text default 'AI Product Manager',
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  north_star text,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "own projects all" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  status text not null default 'todo',
  priority text not null default 'medium',
  is_deep_work boolean not null default false,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "own tasks all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index tasks_user_due on public.tasks(user_id, due_date);

-- meetings
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  stakeholder text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.meetings enable row level security;
create policy "own meetings all" on public.meetings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index meetings_user_start on public.meetings(user_id, start_at);

-- notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "own notes all" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- daily_briefs
create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null,
  summary text not null default '',
  focus_score int not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, brief_date)
);
alter table public.daily_briefs enable row level security;
create policy "own briefs all" on public.daily_briefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- copilot_messages
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.copilot_messages enable row level security;
create policy "own messages all" on public.copilot_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index copilot_user_created on public.copilot_messages(user_id, created_at);

-- profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

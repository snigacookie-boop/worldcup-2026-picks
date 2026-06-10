-- Run this entire file in the Supabase SQL editor (one shot).
-- It is idempotent: safe to re-run.

-- =============== PROFILES ===============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
-- The signup form passes `username` in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
  v_suffix int := 0;
  v_candidate text;
begin
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_username := regexp_replace(lower(v_username), '[^a-z0-9_-]', '', 'g');
  if length(v_username) < 3 then
    v_username := 'player' || substring(new.id::text, 1, 6);
  end if;

  v_candidate := v_username;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_username || v_suffix::text;
  end loop;

  insert into public.profiles (id, username) values (new.id, v_candidate);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============== ROUNDS ===============
-- Text PKs (group, r16, etc.) so the client and sync function can reference them by name.
create table if not exists public.rounds (
  id text primary key,
  name text not null,
  points_per_correct integer not null default 1,
  display_order integer not null default 0
);

insert into public.rounds (id, name, points_per_correct, display_order) values
  ('group',   'Group Stage',    1,  10),
  ('r32',     'Round of 32',    2,  20),
  ('r16',     'Round of 16',    3,  30),
  ('quarter', 'Quarter-finals', 5,  40),
  ('semi',    'Semi-finals',    8,  50),
  ('third',   'Third-place',    10, 55),
  ('final',   'Final',          15, 60)
on conflict (id) do nothing;

-- =============== MATCHES ===============
-- Synced from football-data.org by the Netlify function. `id` is e.g. "football-data-12345".
-- `goals` is reserved for goal-scorer data (football-data.org free tier does not include this;
-- admin can populate it manually later or upgrade the data source).
create table if not exists public.matches (
  id text primary key,
  external_id text,
  round_id text references public.rounds(id),
  home_team text not null,
  away_team text not null,
  home_code text,
  away_code text,
  kickoff timestamptz not null,
  home_score integer,
  away_score integer,
  status text not null default 'SCHEDULED',
  winner text,
  venue text,
  city text,
  elapsed integer,
  goals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists matches_kickoff_idx on public.matches (kickoff);
create index if not exists matches_round_idx on public.matches (round_id);

-- =============== PICKS ===============
create table if not exists public.picks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  pick text not null check (pick in ('HOME','AWAY','DRAW')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists picks_user_idx on public.picks (user_id);

-- =============== RLS ===============
alter table public.profiles enable row level security;
alter table public.rounds   enable row level security;
alter table public.matches  enable row level security;
alter table public.picks    enable row level security;

-- profiles: any authenticated user can read; only the owner can update their own row.
drop policy if exists "profiles_read_all"   on public.profiles;
create policy "profiles_read_all" on public.profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- rounds: read by all authenticated; write only by admins.
drop policy if exists "rounds_read_all"     on public.rounds;
create policy "rounds_read_all" on public.rounds for select using (auth.role() = 'authenticated');
drop policy if exists "rounds_admin_write"  on public.rounds;
create policy "rounds_admin_write" on public.rounds for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- matches: read by all authenticated; writes via service role (sync function) or admin.
drop policy if exists "matches_read_all"    on public.matches;
create policy "matches_read_all" on public.matches for select using (auth.role() = 'authenticated');
drop policy if exists "matches_admin_write" on public.matches;
create policy "matches_admin_write" on public.matches for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- picks: read all; write own only, and only before kickoff.
drop policy if exists "picks_read_all"      on public.picks;
create policy "picks_read_all" on public.picks for select using (auth.role() = 'authenticated');
drop policy if exists "picks_self_insert"   on public.picks;
create policy "picks_self_insert" on public.picks for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  );
drop policy if exists "picks_self_update"   on public.picks;
create policy "picks_self_update" on public.picks for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  )
  with check (auth.uid() = user_id);
drop policy if exists "picks_self_delete"   on public.picks;
create policy "picks_self_delete" on public.picks for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  );

-- =============== LEADERBOARD VIEW ===============
create or replace view public.leaderboard as
select
  p.id as user_id,
  p.username,
  coalesce(sum(case when pk.pick = m.winner then r.points_per_correct else 0 end), 0)::int as points,
  count(pk.id) filter (where m.winner is not null) as picks_settled,
  count(pk.id) as picks_made
from public.profiles p
left join public.picks pk on pk.user_id = p.id
left join public.matches m on m.id = pk.match_id
left join public.rounds r on r.id = m.round_id
group by p.id, p.username
order by points desc;

grant select on public.leaderboard to authenticated;

-- =============== REALTIME ===============
-- Tell Postgres replication to publish row changes for the tables the UI subscribes to.
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.picks;
alter publication supabase_realtime add table public.rounds;

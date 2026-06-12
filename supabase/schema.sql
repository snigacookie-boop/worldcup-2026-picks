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

-- Admin override: admins can write any pick at any time (for dispute resolution / corrections).
-- Multiple permissive policies OR together, so this adds an admin-only path on top of the user-self path.
drop policy if exists "picks_admin_write" on public.picks;
create policy "picks_admin_write" on public.picks for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- =============== BONUS QUESTIONS ===============
-- Players answer once at the start of the tournament (winner, top scorer, etc.).
-- Each question has its own lock_at; default seeds use 2026-06-27 (start of R32 / knockout rounds).
create table if not exists public.bonus_questions (
  id text primary key,
  prompt text not null,
  options jsonb,                          -- array of allowed answers, or null for free text
  points integer not null default 5,
  lock_at timestamptz,                    -- after this point, only admin can change answers
  correct_answer text,                    -- admin sets after the tournament ends
  display_order integer not null default 0
);

create table if not exists public.bonus_answers (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.bonus_questions(id) on delete cascade,
  answer text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

-- Seed three default questions. Lock at the kickoff of the first knockout match (R32 starts 2026-06-27).
insert into public.bonus_questions (id, prompt, points, lock_at, display_order) values
  ('winner',     'Who will win the World Cup?',                                       15, '2026-06-27T00:00:00Z', 10),
  ('topscorer',  'Tournament top goal scorer (player name)',                          10, '2026-06-27T00:00:00Z', 20),
  ('darkhorse',  'Dark horse — which non-favorite team reaches the semi-finals?',     8,  '2026-06-27T00:00:00Z', 30)
on conflict (id) do nothing;

alter table public.bonus_questions enable row level security;
alter table public.bonus_answers   enable row level security;

drop policy if exists "bq_read"        on public.bonus_questions;
create policy "bq_read" on public.bonus_questions for select to authenticated using (true);
drop policy if exists "bq_admin_write" on public.bonus_questions;
create policy "bq_admin_write" on public.bonus_questions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "ba_read"        on public.bonus_answers;
create policy "ba_read" on public.bonus_answers for select to authenticated using (true);
drop policy if exists "ba_self_write"  on public.bonus_answers;
create policy "ba_self_write" on public.bonus_answers for all to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.bonus_questions q where q.id = question_id and (q.lock_at is null or q.lock_at > now()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.bonus_questions q where q.id = question_id and (q.lock_at is null or q.lock_at > now()))
  );
drop policy if exists "ba_admin_write" on public.bonus_answers;
create policy "ba_admin_write" on public.bonus_answers for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- =============== MATCH PICK COUNTS (pool consensus) ===============
-- The Schedule UI renders these as "60% picked MEX" once a match is locked.
create or replace view public.match_pick_counts as
select
  m.id as match_id,
  count(*) filter (where pk.pick = 'HOME')::int as home_count,
  count(*) filter (where pk.pick = 'DRAW')::int as draw_count,
  count(*) filter (where pk.pick = 'AWAY')::int as away_count,
  count(pk.id)::int as total
from public.matches m
left join public.picks pk on pk.match_id = m.id
group by m.id;

grant select on public.match_pick_counts to authenticated;

-- =============== LEADERBOARD VIEW (picks + bonus combined) ===============
-- Drop first so column types can change on re-runs (Postgres rejects CREATE OR REPLACE
-- when a column's type would differ).
drop view if exists public.leaderboard;
create view public.leaderboard as
with pick_totals as (
  select
    p.id as user_id,
    p.username,
    coalesce(sum(case when pk.pick = m.winner then r.points_per_correct else 0 end), 0)::int as pick_points,
    count(pk.id) filter (where m.winner is not null)::int as picks_settled,
    count(pk.id)::int as picks_made
  from public.profiles p
  left join public.picks pk on pk.user_id = p.id
  left join public.matches m on m.id = pk.match_id
  left join public.rounds r on r.id = m.round_id
  group by p.id, p.username
),
bonus_totals as (
  select
    ba.user_id,
    coalesce(sum(case when ba.answer = bq.correct_answer then bq.points else 0 end), 0)::int as bonus_points
  from public.bonus_answers ba
  join public.bonus_questions bq on bq.id = ba.question_id
  group by ba.user_id
)
select
  pt.user_id,
  pt.username,
  (pt.pick_points + coalesce(bt.bonus_points, 0))::int as points,
  pt.picks_settled,
  pt.picks_made,
  pt.pick_points,
  coalesce(bt.bonus_points, 0)::int as bonus_points
from pick_totals pt
left join bonus_totals bt on bt.user_id = pt.user_id
order by points desc;

grant select on public.leaderboard to authenticated;

-- =============== REALTIME ===============
-- Tell Postgres replication to publish row changes for the tables the UI subscribes to.
-- Idempotent: each ALTER is wrapped to swallow "already member of publication" errors so re-runs succeed.
do $$
begin
  begin alter publication supabase_realtime add table public.matches;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.picks;           exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.rounds;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bonus_questions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bonus_answers;   exception when duplicate_object then null; end;
end $$;

-- Sideways Rally online leaderboard (Supabase / Postgres).
-- Run this once in the project's SQL Editor. Anyone with the game can read times and add their own;
-- nobody can change or delete rows from the game (there are no update/delete policies).

create table if not exists public.times (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 20),
  stage text not null check (stage ~ '^(pine|frost|mesa|forest)(-r)?(-night|-rain)?$' or stage ~ '^daily-[0-9]{8}$'),
  car text not null check (car in ('foca', 'impressa', 'lancha', 'delta', 'pejo', 'kwattro', 'selica', 'saveiro')),
  time real not null check (time > 20 and time < 1200),
  splits real[] not null default '{}' check (cardinality(splits) <= 4)
);
create index if not exists times_stage_time on public.times (stage, time);

alter table public.times enable row level security;
drop policy if exists "read times" on public.times;
create policy "read times" on public.times for select to anon, authenticated using (true);
drop policy if exists "add a time" on public.times;
create policy "add a time" on public.times for insert to anon, authenticated with check (true);

-- one row per driver (name, case-insensitive), stage and car: their best
create or replace view public.best_times with (security_invoker = true) as
  select distinct on (lower(name), stage, car) name, stage, car, time, created_at
  from public.times
  order by lower(name), stage, car, time asc, created_at asc;

grant select, insert on public.times to anon, authenticated;
grant select on public.best_times to anon, authenticated;

-- 2026-10 · the No. 1's ghost. Run this once more (it only adds a column): each time can carry its run as a packed,
-- deflated, base64url ghost (3–6 KB), so the fastest driver on a road can be raced the way they drove it.
alter table public.times add column if not exists ghost text check (ghost is null or char_length(ghost) < 40000);

-- 2026-10 · the Saveiro's times are listed on the board (they never count for No. 1, the game sees to that).
-- Lets the bonus car through the car check.
alter table public.times drop constraint if exists times_car_check;
alter table public.times add constraint times_car_check check (car in ('foca', 'impressa', 'lancha', 'delta', 'pejo', 'kwattro', 'selica', 'saveiro'));

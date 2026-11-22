-- Exercise app schema for LacChe/tools, following CONVENTIONS.md.
-- App id: exercise. Tables are exercise_<thing>; shared infrastructure is hub_<thing>.
-- Every policy requires hub_has_access('exercise'), like the other apps.
-- Units: weight in kg, distance in meters, time in seconds. The client converts for display.
--
-- Shared (any user with access can read; only the creator can edit):
--   exercise_categories, exercise_catalog, exercise_routines, hub_profiles
-- Private (each user only ever gets their own rows):
--   exercise_sessions, exercise_sets
--
-- Users are created by hand in Supabase. For each new user, also add:
--   1) a hub_profiles row (display name, used for 'created by')
--   2) hub_app_access rows for the apps they may use
-- See the snippet near the bottom.

-- ---------------------------------------------------------------
-- 0. HUB_PROFILES: display names, so shared rows can show who created them.
--    Shared infrastructure, so it gets the hub_ prefix. Rows are added by hand.
-- ---------------------------------------------------------------
create table hub_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (length(btrim(display_name)) > 0)
);
alter table hub_profiles enable row level security;

-- Anyone who has access to at least one app can read names; users can rename themselves.
create policy hub_profiles_read on hub_profiles for select
  using (exists (select 1 from public.hub_app_access a where a.user_id = auth.uid()));
create policy hub_profiles_update_own on hub_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Backfill: one profile per existing user, named from the email until you edit it.
insert into hub_profiles (user_id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict do nothing;

-- ---------------------------------------------------------------
-- 1. EXERCISE_CATEGORIES: small lookup list (text key, label_en, label_zh, sort_order).
-- ---------------------------------------------------------------
create table exercise_categories (
  slug        text primary key,
  label_en    text not null,
  label_zh    text,
  sort_order  integer not null
);
alter table exercise_categories enable row level security;
create policy exercise_categories_read on exercise_categories for select
  using (public.hub_has_access('exercise'));

insert into exercise_categories (slug, label_en, label_zh, sort_order) values
  ('strength', 'Strength', '力量', 1),
  ('core',     'Core',     '核心', 2),
  ('cardio',   'Cardio',   '有氧', 3),
  ('stretch',  'Stretch',  '拉伸', 4);

-- ---------------------------------------------------------------
-- 2. EXERCISE_CATALOG: shared list of exercises. Each declares which metrics it uses,
--    so the UI only shows relevant inputs.
--    Names: name_en and name_zh, at least one required. The client shows the current
--    language and falls back to the other one.
--    Families: a variant points at its base exercise with parent_id, e.g. 'curl hammer'
--    -> 'curl'. 'All curls' is the parent plus its children.
-- ---------------------------------------------------------------
create table exercise_catalog (
  id          bigint generated always as identity primary key,
  created_by  uuid default auth.uid() references hub_profiles(user_id) on delete set null,
  name_en     text unique,
  name_zh     text unique,
  parent_id   bigint references exercise_catalog(id) on delete set null,
  category    text references exercise_categories(slug) on update cascade,
  -- Metrics come in two tiers. Subset of: reps, weight, duration, distance
  required_metrics text[] not null,              -- always shown, always filled in
  optional_metrics text[] not null default '{}', -- shown behind a '+ add weight' style toggle
  primary_metric   text not null,                -- what the trend chart plots
  unilateral  boolean not null default false,    -- done per side (side plank, one arm row)
  archived    boolean not null default false,    -- hide instead of delete; history stays intact
  constraint exercise_catalog_name_en_check check (name_en is null or btrim(name_en) <> ''),
  constraint exercise_catalog_name_zh_check check (name_zh is null or btrim(name_zh) <> ''),
  constraint exercise_catalog_names_check   check (name_en is not null or name_zh is not null),
  constraint exercise_catalog_parent_check  check (parent_id is distinct from id),
  constraint exercise_catalog_required_check
    check (required_metrics <@ array['reps','weight','duration','distance']),
  constraint exercise_catalog_optional_check
    check (optional_metrics <@ array['reps','weight','duration','distance']),
  constraint exercise_catalog_tiers_check
    check (not (required_metrics && optional_metrics)),
  constraint exercise_catalog_primary_check
    check (primary_metric in ('weight','volume','duration','distance'))
);
alter table exercise_catalog enable row level security;
create policy exercise_catalog_read on exercise_catalog for select
  using (public.hub_has_access('exercise'));
create policy exercise_catalog_insert_own on exercise_catalog for insert
  with check (created_by = auth.uid() and public.hub_has_access('exercise'));
create policy exercise_catalog_update_own on exercise_catalog for update
  using (created_by = auth.uid() and public.hub_has_access('exercise'))
  with check (created_by = auth.uid() and public.hub_has_access('exercise'));
create policy exercise_catalog_delete_own on exercise_catalog for delete
  using (created_by = auth.uid() and public.hub_has_access('exercise'));
-- Deleting an exercise that anyone has logged fails (exercise_sets references it). Archive instead.

-- ---------------------------------------------------------------
-- 3. EXERCISE_ROUTINES: shared templates, one table. The exercises live in a jsonb
--    array, in order:  [{"exercise_id": 12, "sets": 3}, {"exercise_id": 7, "sets": 3}]
--    Starting a routine creates a session and pre-fills each exercise from the
--    user's own last session of it. Same bilingual name rule as the catalog.
-- ---------------------------------------------------------------
create table exercise_routines (
  id          bigint generated always as identity primary key,
  created_by  uuid default auth.uid() references hub_profiles(user_id) on delete set null,
  name_en     text unique,
  name_zh     text unique,
  notes       text,
  items       jsonb not null default '[]',
  archived    boolean not null default false,
  constraint exercise_routines_name_en_check check (name_en is null or btrim(name_en) <> ''),
  constraint exercise_routines_name_zh_check check (name_zh is null or btrim(name_zh) <> ''),
  constraint exercise_routines_names_check   check (name_en is not null or name_zh is not null),
  constraint exercise_routines_items_check   check (jsonb_typeof(items) = 'array')
);
alter table exercise_routines enable row level security;
create policy exercise_routines_read on exercise_routines for select
  using (public.hub_has_access('exercise'));
create policy exercise_routines_insert_own on exercise_routines for insert
  with check (created_by = auth.uid() and public.hub_has_access('exercise'));
create policy exercise_routines_update_own on exercise_routines for update
  using (created_by = auth.uid() and public.hub_has_access('exercise'))
  with check (created_by = auth.uid() and public.hub_has_access('exercise'));
create policy exercise_routines_delete_own on exercise_routines for delete
  using (created_by = auth.uid() and public.hub_has_access('exercise'));

-- ---------------------------------------------------------------
-- 4. EXERCISE_SESSIONS: private. One workout day per user (date only, no timestamps).
--    The policy compares user_id to whoever is asking, so a plain
--    'select * from exercise_sessions' only returns that user's own rows.
-- ---------------------------------------------------------------
create table exercise_sessions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date  date not null,
  routine_id  bigint references exercise_routines(id) on delete set null,  -- null for freeform
  bodyweight  numeric,                       -- kg, optional
  notes       text,
  unique (user_id, entry_date),
  unique (id, user_id)                       -- lets sets prove they belong to the same user
);
alter table exercise_sessions enable row level security;
create policy exercise_sessions_own on exercise_sessions for all
  using (user_id = auth.uid() and public.hub_has_access('exercise'))
  with check (user_id = auth.uid() and public.hub_has_access('exercise'));

-- ---------------------------------------------------------------
-- 5. EXERCISE_SETS: private. One row per set. Metric columns are nullable:
--    NULL = not applicable, 0 = genuinely zero.
--    position = order of the set within the session (1, 2, 3 ... across all exercises),
--    which gives exercise order for free and supports supersets and circuits.
-- ---------------------------------------------------------------
create table exercise_sets (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id    bigint not null,
  exercise_id   bigint not null references exercise_catalog(id),
  position      int not null,
  reps          int,
  weight        numeric,                     -- kg
  duration_sec  int,
  distance_m    numeric,                     -- meters
  rpe           numeric check (rpe between 1 and 10),
  side          text check (side in ('left','right')),   -- only for unilateral exercises
  is_warmup     boolean not null default false,          -- excluded from trends and volume
  notes         text,
  unique (session_id, position),
  -- Same user as the session, so nobody can attach sets to someone else's day.
  foreign key (session_id, user_id) references exercise_sessions (id, user_id) on delete cascade
);
create index exercise_sets_user_exercise_idx on exercise_sets (user_id, exercise_id);
alter table exercise_sets enable row level security;
create policy exercise_sets_own on exercise_sets for all
  using (user_id = auth.uid() and public.hub_has_access('exercise'))
  with check (user_id = auth.uid() and public.hub_has_access('exercise'));

-- ---------------------------------------------------------------
-- ACCESS: everyone gets the exercise app for now.
-- Later, gate by deleting or not inserting rows for specific users.
-- ---------------------------------------------------------------
insert into hub_app_access (user_id, app_id)
select u.id, 'exercise' from auth.users u
on conflict do nothing;

-- Adding a new user later (after creating them in Supabase Auth):
--   insert into hub_profiles (user_id, display_name) values ('<user uuid>', '<name>');
--   insert into hub_app_access (user_id, app_id) values
--     ('<user uuid>', 'exercise'), ('<user uuid>', 'expenses'), ('<user uuid>', 'wachter');

-- ---------------------------------------------------------------
-- EXAMPLE DATA, mapped from the PDF (commented out)
-- ---------------------------------------------------------------
-- insert into exercise_catalog (name_en, name_zh, category, required_metrics, optional_metrics, primary_metric, unilateral) values
--   ('squat dumbbell', '哑铃深蹲',   'strength', '{reps,weight}',     '{}',         'weight',   false),
--   ('press dumbbell', '哑铃推举',   'strength', '{reps,weight}',     '{}',         'weight',   false),
--   ('crunches',       '卷腹',       'core',     '{reps}',            '{weight}',   'volume',   false),
--   ('plank',          '平板支撑',   'core',     '{duration}',        '{weight}',   'duration', false),
--   ('plank side',     '侧平板支撑', 'core',     '{duration}',        '{weight}',   'duration', true),
--   ('mabu',           '马步',       'strength', '{duration}',        '{weight}',   'duration', false),  -- horse stance
--   ('walk farmer',    '农夫行走',   'strength', '{distance,weight}', '{duration}', 'distance', false),
--   ('running',        '跑步',       'cardio',   '{duration}',        '{distance}', 'duration', false);
--
-- A family: the base exercise, then variants pointing at it.
--   insert into exercise_catalog (name_en, name_zh, category, required_metrics, primary_metric) values
--     ('curl', '弯举', 'strength', '{reps,weight}', 'weight');
--   insert into exercise_catalog (name_en, name_zh, parent_id, category, required_metrics, primary_metric) values
--     ('curl hammer', '锤式弯举', (select id from exercise_catalog where name_en = 'curl'),
--      'strength', '{reps,weight}', 'weight');
--
-- 2026/4/2: squat 3x10 @ 45 becomes one session + three set rows:
--   exercise_sessions(entry_date '2026-04-02')
--   exercise_sets(exercise 'squat dumbbell', position 1, reps 10, weight 45)
--   exercise_sets(exercise 'squat dumbbell', position 2, reps 10, weight 45)
--   exercise_sets(exercise 'squat dumbbell', position 3, reps 10, weight 45)
--   the next exercise continues at position 4, 5, 6 ...
--
-- Plank (Dec 2025 data was '3 sets, 30 reps' which really meant 30 seconds):
--   exercise_sets(exercise 'plank', position n, duration_sec 30)
-- Walk farmer '3 50 50' (3 sets, 50 meters, weight 50):
--   exercise_sets(exercise 'walk farmer', position n, distance_m 50, weight 50)
-- Weighted plank: same exercise, optional weight filled in only when used:
--   exercise_sets(exercise 'plank', position n, duration_sec 45, weight 10)
-- Side plank, one row per side:
--   exercise_sets(exercise 'plank side', position n,   duration_sec 30, side 'left')
--   exercise_sets(exercise 'plank side', position n+1, duration_sec 30, side 'right')
--
-- A routine (a Chinese-only name is fine too):
--   insert into exercise_routines (name_en, name_zh, items) values ('Core day', '核心日', '[
--     {"exercise_id": <crunches id>, "sets": 3},
--     {"exercise_id": <plank id>,    "sets": 3},
--     {"exercise_id": <mabu id>,     "sets": 3}
--   ]');

-- ---------------------------------------------------------------
-- EXAMPLE QUERIES (row-level security filters by user automatically)
-- ---------------------------------------------------------------
-- Exercises with their creator's name:
--   select coalesce(c.name_en, c.name_zh) as name, p.display_name as creator
--   from exercise_catalog c left join hub_profiles p on p.user_id = c.created_by;
--
-- Weight trend for one exercise (top set per day, warm-ups excluded):
--   select s.entry_date, max(l.weight) as top_weight
--   from exercise_sets l join exercise_sessions s on s.id = l.session_id
--   where l.exercise_id = :id and not l.is_warmup
--   group by s.entry_date order by s.entry_date;
--
-- Volume per day (reps x weight):
--   select s.entry_date, sum(l.reps * l.weight) as volume
--   from exercise_sets l join exercise_sessions s on s.id = l.session_id
--   where l.exercise_id = :id and not l.is_warmup
--   group by s.entry_date order by s.entry_date;
--
-- Rebuild the old grid view (exercise x date) from the long table:
--   select coalesce(c.name_en, c.name_zh) as name, s.entry_date,
--          count(*) as sets, max(l.reps) as reps, max(l.weight) as weight
--   from exercise_sets l
--   join exercise_sessions s on s.id = l.session_id
--   join exercise_catalog c on c.id = l.exercise_id
--   group by 1, s.entry_date;
--
-- Last session of an exercise (what a routine pre-fills from):
--   select l.* from exercise_sets l join exercise_sessions s on s.id = l.session_id
--   where l.exercise_id = :id
--     and s.entry_date = (select max(s2.entry_date)
--                         from exercise_sets l2 join exercise_sessions s2 on s2.id = l2.session_id
--                         where l2.exercise_id = :id and s2.entry_date < :today)
--   order by l.position;

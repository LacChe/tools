-- Run in the Supabase SQL editor (after schema.sql, functions.sql and grants.sql).
-- Daily values per exercise for the Progress page. Warm-up sets are excluded.
--   top_weight        heaviest set (kg)
--   volume            sum of reps x weight; just the reps when a set has no weight
--   max_duration_sec  longest set
--   total_distance_m  sum of distances
-- security invoker: row-level security applies as the caller, so only their own sets are counted.
create or replace function public.exercise_progress(p_exercise_ids bigint[], p_from date, p_to date)
returns table (
  entry_date date,
  exercise_id bigint,
  top_weight numeric,
  volume numeric,
  max_duration_sec int,
  total_distance_m numeric
)
language sql
stable
security invoker
set search_path to ''
as $$
  select s.entry_date,
         l.exercise_id,
         max(l.weight),
         sum(case when l.reps is null then 0 when l.weight is null then l.reps else l.reps * l.weight end),
         max(l.duration_sec),
         sum(l.distance_m)
  from public.exercise_sets l
  join public.exercise_sessions s on s.id = l.session_id and s.user_id = l.user_id
  where l.exercise_id = any (p_exercise_ids)
    and not l.is_warmup
    and s.entry_date between p_from and p_to
  group by s.entry_date, l.exercise_id
  order by s.entry_date;
$$;

grant execute on function public.exercise_progress(bigint[], date, date) to authenticated;

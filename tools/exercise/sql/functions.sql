-- Run after schema.sql.
create or replace function public.exercise_add_set(
  p_entry_date date, p_exercise_id bigint,
  p_reps int default null, p_weight numeric default null,
  p_duration_sec int default null, p_distance_m numeric default null,
  p_rpe numeric default null, p_side text default null,
  p_is_warmup boolean default false, p_notes text default null
) returns public.exercise_sets
language plpgsql
set search_path to ''
as $$
declare
  v_session bigint;
  v_row public.exercise_sets;
begin
  insert into public.exercise_sessions (entry_date) values (p_entry_date)
  on conflict (user_id, entry_date) do nothing;

  select id into v_session from public.exercise_sessions
  where user_id = auth.uid() and entry_date = p_entry_date;

  insert into public.exercise_sets
    (session_id, exercise_id, position, reps, weight, duration_sec, distance_m, rpe, side, is_warmup, notes)
  values (
    v_session, p_exercise_id,
    coalesce((select max(position) from public.exercise_sets where session_id = v_session), 0) + 1,
    p_reps, p_weight, p_duration_sec, p_distance_m, p_rpe, p_side, p_is_warmup, p_notes
  )
  returning * into v_row;
  return v_row;
end $$;

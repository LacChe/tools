-- Run after schema.sql and functions.sql.
-- Tables created in the SQL editor are not automatically readable by the signed-in role,
-- so the app got "permission denied for table ...". Row-level security still decides which rows.
-- Only `authenticated` gets access; `anon` gets nothing.

grant select on public.exercise_categories to authenticated;
grant select on public.hub_profiles to authenticated;
grant update (display_name) on public.hub_profiles to authenticated;

grant select, insert, update, delete on public.exercise_catalog to authenticated;
grant select, insert, update, delete on public.exercise_routines to authenticated;
grant select, insert, update, delete on public.exercise_sessions to authenticated;
grant select, insert, update, delete on public.exercise_sets to authenticated;

grant execute on function public.exercise_add_set(
  date, bigint, int, numeric, int, numeric, numeric, text, boolean, text
) to authenticated;

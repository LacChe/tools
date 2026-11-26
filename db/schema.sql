-- Generated from Supabase (public schema) by .github/workflows/db-snapshot.yml.
-- Do not edit by hand: change the database, then run the workflow again.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exercise_sets" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "session_id" bigint NOT NULL,
    "exercise_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "reps" integer,
    "weight" numeric,
    "duration_sec" integer,
    "distance_m" numeric,
    "rpe" numeric,
    "side" "text",
    "is_warmup" boolean DEFAULT false NOT NULL,
    "notes" "text",
    CONSTRAINT "exercise_sets_rpe_check" CHECK ((("rpe" >= (1)::numeric) AND ("rpe" <= (10)::numeric))),
    CONSTRAINT "exercise_sets_side_check" CHECK (("side" = ANY (ARRAY['left'::"text", 'right'::"text"])))
);


ALTER TABLE "public"."exercise_sets" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exercise_add_set"("p_entry_date" "date", "p_exercise_id" bigint, "p_reps" integer DEFAULT NULL::integer, "p_weight" numeric DEFAULT NULL::numeric, "p_duration_sec" integer DEFAULT NULL::integer, "p_distance_m" numeric DEFAULT NULL::numeric, "p_rpe" numeric DEFAULT NULL::numeric, "p_side" "text" DEFAULT NULL::"text", "p_is_warmup" boolean DEFAULT false, "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."exercise_sets"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."exercise_add_set"("p_entry_date" "date", "p_exercise_id" bigint, "p_reps" integer, "p_weight" numeric, "p_duration_sec" integer, "p_distance_m" numeric, "p_rpe" numeric, "p_side" "text", "p_is_warmup" boolean, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exercise_progress"("p_exercise_ids" bigint[], "p_from" "date", "p_to" "date") RETURNS TABLE("entry_date" "date", "exercise_id" bigint, "top_weight" numeric, "volume" numeric, "max_duration_sec" integer, "total_distance_m" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."exercise_progress"("p_exercise_ids" bigint[], "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses_entries" (
    "id" bigint NOT NULL,
    "entry_date" "date" NOT NULL,
    "category" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expenses_entries" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expenses_add_entry"("p_entry_date" "date", "p_category" "text", "p_currency" "text", "p_amount" numeric) RETURNS "public"."expenses_entries"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  insert into public.expenses_entries (entry_date, category, currency, amount)
  values (p_entry_date, p_category, p_currency, round(p_amount, 2))
  on conflict (entry_date, category, currency)
  do update set amount = public.expenses_entries.amount + excluded.amount
  returning *;
$$;


ALTER FUNCTION "public"."expenses_add_entry"("p_entry_date" "date", "p_category" "text", "p_currency" "text", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_has_access"("p_app_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.hub_app_access a
    where a.user_id = auth.uid() and a.app_id = p_app_id
  );
$$;


ALTER FUNCTION "public"."hub_has_access"("p_app_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_entries" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "day_key" "text" NOT NULL,
    "iv" "text" NOT NULL,
    "ciphertext" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cycle_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_keys" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "password_salt" "text" NOT NULL,
    "iterations" integer NOT NULL,
    "password_wrapped" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cycle_keys_iterations_check" CHECK (("iterations" >= 600000))
);


ALTER TABLE "public"."cycle_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_catalog" (
    "id" bigint NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "name_en" "text",
    "name_zh" "text",
    "parent_id" bigint,
    "category" "text",
    "required_metrics" "text"[] NOT NULL,
    "optional_metrics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "primary_metric" "text" NOT NULL,
    "unilateral" boolean DEFAULT false NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "exercise_catalog_name_en_check" CHECK ((("name_en" IS NULL) OR ("btrim"("name_en") <> ''::"text"))),
    CONSTRAINT "exercise_catalog_name_zh_check" CHECK ((("name_zh" IS NULL) OR ("btrim"("name_zh") <> ''::"text"))),
    CONSTRAINT "exercise_catalog_names_check" CHECK ((("name_en" IS NOT NULL) OR ("name_zh" IS NOT NULL))),
    CONSTRAINT "exercise_catalog_optional_check" CHECK (("optional_metrics" <@ ARRAY['reps'::"text", 'weight'::"text", 'duration'::"text", 'distance'::"text"])),
    CONSTRAINT "exercise_catalog_parent_check" CHECK (("parent_id" IS DISTINCT FROM "id")),
    CONSTRAINT "exercise_catalog_primary_check" CHECK (("primary_metric" = ANY (ARRAY['weight'::"text", 'volume'::"text", 'duration'::"text", 'distance'::"text"]))),
    CONSTRAINT "exercise_catalog_required_check" CHECK (("required_metrics" <@ ARRAY['reps'::"text", 'weight'::"text", 'duration'::"text", 'distance'::"text"])),
    CONSTRAINT "exercise_catalog_tiers_check" CHECK ((NOT ("required_metrics" && "optional_metrics")))
);


ALTER TABLE "public"."exercise_catalog" OWNER TO "postgres";


ALTER TABLE "public"."exercise_catalog" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exercise_catalog_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."exercise_categories" (
    "slug" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_zh" "text",
    "sort_order" integer NOT NULL
);


ALTER TABLE "public"."exercise_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_routines" (
    "id" bigint NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "name_en" "text",
    "name_zh" "text",
    "notes" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "exercise_routines_items_check" CHECK (("jsonb_typeof"("items") = 'array'::"text")),
    CONSTRAINT "exercise_routines_name_en_check" CHECK ((("name_en" IS NULL) OR ("btrim"("name_en") <> ''::"text"))),
    CONSTRAINT "exercise_routines_name_zh_check" CHECK ((("name_zh" IS NULL) OR ("btrim"("name_zh") <> ''::"text"))),
    CONSTRAINT "exercise_routines_names_check" CHECK ((("name_en" IS NOT NULL) OR ("name_zh" IS NOT NULL)))
);


ALTER TABLE "public"."exercise_routines" OWNER TO "postgres";


ALTER TABLE "public"."exercise_routines" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exercise_routines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."exercise_sessions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "entry_date" "date" NOT NULL,
    "routine_id" bigint,
    "bodyweight" numeric,
    "notes" "text"
);


ALTER TABLE "public"."exercise_sessions" OWNER TO "postgres";


ALTER TABLE "public"."exercise_sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exercise_sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."exercise_sets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exercise_sets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."expenses_categories" (
    "slug" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "label_zh" "text"
);


ALTER TABLE "public"."expenses_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses_currencies" (
    "code" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "label_zh" "text"
);


ALTER TABLE "public"."expenses_currencies" OWNER TO "postgres";


ALTER TABLE "public"."expenses_entries" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."expenses_entries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."expenses_settings" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "default_currency" "text" DEFAULT 'CNY'::"text" NOT NULL
);


ALTER TABLE "public"."expenses_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_app_access" (
    "user_id" "uuid" NOT NULL,
    "app_id" "text" NOT NULL
);


ALTER TABLE "public"."hub_app_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    CONSTRAINT "hub_profiles_display_name_check" CHECK (("length"("btrim"("display_name")) > 0))
);


ALTER TABLE "public"."hub_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_push_subscriptions" (
    "endpoint" "text" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth_secret" "text" NOT NULL
);


ALTER TABLE "public"."hub_push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wachter_items" (
    "id" integer NOT NULL,
    "book" "text" NOT NULL,
    "col" integer NOT NULL,
    "row" numeric NOT NULL,
    "label_en" "text" NOT NULL,
    "label_zh" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_zh" "text" NOT NULL,
    "body_en" "text" NOT NULL,
    "body_zh" "text" NOT NULL,
    CONSTRAINT "wachter_items_book_check" CHECK (("book" = ANY (ARRAY['wf'::"text", 'sw'::"text"])))
);


ALTER TABLE "public"."wachter_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wachter_links" (
    "from_id" integer NOT NULL,
    "to_id" integer NOT NULL,
    "kind" "text" NOT NULL,
    "back_ref" boolean DEFAULT false NOT NULL,
    CONSTRAINT "wachter_links_kind_check" CHECK (("kind" = ANY (ARRAY['required'::"text", 'optional'::"text"])))
);


ALTER TABLE "public"."wachter_links" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cycle_entries"
    ADD CONSTRAINT "cycle_entries_pkey" PRIMARY KEY ("user_id", "day_key");



ALTER TABLE ONLY "public"."cycle_keys"
    ADD CONSTRAINT "cycle_keys_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_name_en_key" UNIQUE ("name_en");



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_name_zh_key" UNIQUE ("name_zh");



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_categories"
    ADD CONSTRAINT "exercise_categories_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."exercise_routines"
    ADD CONSTRAINT "exercise_routines_name_en_key" UNIQUE ("name_en");



ALTER TABLE ONLY "public"."exercise_routines"
    ADD CONSTRAINT "exercise_routines_name_zh_key" UNIQUE ("name_zh");



ALTER TABLE ONLY "public"."exercise_routines"
    ADD CONSTRAINT "exercise_routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_sessions"
    ADD CONSTRAINT "exercise_sessions_id_user_id_key" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."exercise_sessions"
    ADD CONSTRAINT "exercise_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_sessions"
    ADD CONSTRAINT "exercise_sessions_user_id_entry_date_key" UNIQUE ("user_id", "entry_date");



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_session_id_position_key" UNIQUE ("session_id", "position");



ALTER TABLE ONLY "public"."expenses_categories"
    ADD CONSTRAINT "expenses_categories_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."expenses_currencies"
    ADD CONSTRAINT "expenses_currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."expenses_entries"
    ADD CONSTRAINT "expenses_entries_entry_date_category_currency_key" UNIQUE ("entry_date", "category", "currency");



ALTER TABLE ONLY "public"."expenses_entries"
    ADD CONSTRAINT "expenses_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses_settings"
    ADD CONSTRAINT "expenses_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."hub_app_access"
    ADD CONSTRAINT "hub_app_access_pkey" PRIMARY KEY ("user_id", "app_id");



ALTER TABLE ONLY "public"."hub_profiles"
    ADD CONSTRAINT "hub_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."hub_push_subscriptions"
    ADD CONSTRAINT "hub_push_subscriptions_pkey" PRIMARY KEY ("endpoint");



ALTER TABLE ONLY "public"."wachter_items"
    ADD CONSTRAINT "wachter_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wachter_links"
    ADD CONSTRAINT "wachter_links_pkey" PRIMARY KEY ("from_id", "to_id");



CREATE INDEX "exercise_sets_user_exercise_idx" ON "public"."exercise_sets" USING "btree" ("user_id", "exercise_id");



ALTER TABLE ONLY "public"."cycle_entries"
    ADD CONSTRAINT "cycle_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_keys"
    ADD CONSTRAINT "cycle_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."exercise_categories"("slug") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."hub_profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_routines"
    ADD CONSTRAINT "exercise_routines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."hub_profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_sessions"
    ADD CONSTRAINT "exercise_sessions_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."exercise_routines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_sessions"
    ADD CONSTRAINT "exercise_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id");



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_session_id_user_id_fkey" FOREIGN KEY ("session_id", "user_id") REFERENCES "public"."exercise_sessions"("id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses_entries"
    ADD CONSTRAINT "expenses_entries_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."expenses_categories"("slug") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."expenses_entries"
    ADD CONSTRAINT "expenses_entries_currency_fkey" FOREIGN KEY ("currency") REFERENCES "public"."expenses_currencies"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."expenses_settings"
    ADD CONSTRAINT "expenses_settings_default_currency_fkey" FOREIGN KEY ("default_currency") REFERENCES "public"."expenses_currencies"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."expenses_settings"
    ADD CONSTRAINT "expenses_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_app_access"
    ADD CONSTRAINT "hub_app_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_profiles"
    ADD CONSTRAINT "hub_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_push_subscriptions"
    ADD CONSTRAINT "hub_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wachter_links"
    ADD CONSTRAINT "wachter_links_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "public"."wachter_items"("id");



ALTER TABLE ONLY "public"."wachter_links"
    ADD CONSTRAINT "wachter_links_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "public"."wachter_items"("id");



ALTER TABLE "public"."cycle_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cycle_entries_own" ON "public"."cycle_entries" TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('cycle'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('cycle'::"text")));



ALTER TABLE "public"."cycle_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cycle_keys_own" ON "public"."cycle_keys" TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('cycle'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('cycle'::"text")));



ALTER TABLE "public"."exercise_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_catalog_delete_own" ON "public"."exercise_catalog" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



CREATE POLICY "exercise_catalog_insert_own" ON "public"."exercise_catalog" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



CREATE POLICY "exercise_catalog_read" ON "public"."exercise_catalog" FOR SELECT USING ("public"."hub_has_access"('exercise'::"text"));



CREATE POLICY "exercise_catalog_update_own" ON "public"."exercise_catalog" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text"))) WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



ALTER TABLE "public"."exercise_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_categories_read" ON "public"."exercise_categories" FOR SELECT USING ("public"."hub_has_access"('exercise'::"text"));



ALTER TABLE "public"."exercise_routines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_routines_delete_own" ON "public"."exercise_routines" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



CREATE POLICY "exercise_routines_insert_own" ON "public"."exercise_routines" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



CREATE POLICY "exercise_routines_read" ON "public"."exercise_routines" FOR SELECT USING ("public"."hub_has_access"('exercise'::"text"));



CREATE POLICY "exercise_routines_update_own" ON "public"."exercise_routines" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text"))) WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



ALTER TABLE "public"."exercise_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_sessions_own" ON "public"."exercise_sessions" USING ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



ALTER TABLE "public"."exercise_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_sets_own" ON "public"."exercise_sets" USING ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('exercise'::"text")));



ALTER TABLE "public"."expenses_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_categories_read" ON "public"."expenses_categories" FOR SELECT TO "authenticated" USING ("public"."hub_has_access"('expenses'::"text"));



ALTER TABLE "public"."expenses_currencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_currencies_read" ON "public"."expenses_currencies" FOR SELECT TO "authenticated" USING ("public"."hub_has_access"('expenses'::"text"));



ALTER TABLE "public"."expenses_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_entries_access" ON "public"."expenses_entries" TO "authenticated" USING ("public"."hub_has_access"('expenses'::"text")) WITH CHECK ("public"."hub_has_access"('expenses'::"text"));



ALTER TABLE "public"."expenses_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_settings_own" ON "public"."expenses_settings" TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('expenses'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."hub_has_access"('expenses'::"text")));



ALTER TABLE "public"."hub_app_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_app_access_select_own" ON "public"."hub_app_access" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."hub_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_profiles_read" ON "public"."hub_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hub_app_access" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "hub_profiles_update_own" ON "public"."hub_profiles" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."hub_push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_push_subscriptions_own" ON "public"."hub_push_subscriptions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."wachter_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wachter_items_read" ON "public"."wachter_items" FOR SELECT TO "authenticated" USING ("public"."hub_has_access"('wachter'::"text"));



ALTER TABLE "public"."wachter_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wachter_links_read" ON "public"."wachter_links" FOR SELECT TO "authenticated" USING ("public"."hub_has_access"('wachter'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_sets" TO "anon";
GRANT ALL ON TABLE "public"."exercise_sets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_sets" TO "service_role";



GRANT ALL ON FUNCTION "public"."exercise_add_set"("p_entry_date" "date", "p_exercise_id" bigint, "p_reps" integer, "p_weight" numeric, "p_duration_sec" integer, "p_distance_m" numeric, "p_rpe" numeric, "p_side" "text", "p_is_warmup" boolean, "p_notes" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."exercise_progress"("p_exercise_ids" bigint[], "p_from" "date", "p_to" "date") TO "authenticated";



GRANT ALL ON TABLE "public"."expenses_entries" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses_entries" TO "service_role";



REVOKE ALL ON FUNCTION "public"."expenses_add_entry"("p_entry_date" "date", "p_category" "text", "p_currency" "text", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expenses_add_entry"("p_entry_date" "date", "p_category" "text", "p_currency" "text", "p_amount" numeric) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."hub_has_access"("p_app_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hub_has_access"("p_app_id" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_entries" TO "anon";
GRANT ALL ON TABLE "public"."cycle_entries" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_entries" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_keys" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."cycle_keys" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_keys" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_catalog" TO "anon";
GRANT ALL ON TABLE "public"."exercise_catalog" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_catalog" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_categories" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_categories" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_categories" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_routines" TO "anon";
GRANT ALL ON TABLE "public"."exercise_routines" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_routines" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_sessions" TO "anon";
GRANT ALL ON TABLE "public"."exercise_sessions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_sessions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses_categories" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses_categories" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses_currencies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses_currencies" TO "service_role";



GRANT ALL ON TABLE "public"."expenses_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses_settings" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_app_access" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_app_access" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_profiles" TO "service_role";



GRANT UPDATE("display_name") ON TABLE "public"."hub_profiles" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."hub_push_subscriptions" TO "authenticated";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hub_push_subscriptions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."wachter_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."wachter_items" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."wachter_links" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."wachter_links" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";








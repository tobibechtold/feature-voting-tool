


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_feedback_cascade"("p_feedback_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM votes WHERE feedback_id = p_feedback_id;
  DELETE FROM comments WHERE feedback_id = p_feedback_id;
  DELETE FROM feedback WHERE id = p_feedback_id;
END;
$$;


ALTER FUNCTION "public"."delete_feedback_cascade"("p_feedback_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_for_feedback"("p_feedback_id" "uuid", "p_voter_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO votes (feedback_id, voter_id) VALUES (p_feedback_id, p_voter_id)
  ON CONFLICT (feedback_id, voter_id) DO NOTHING;
  
  SELECT count(*) INTO v_count FROM votes WHERE feedback_id = p_feedback_id;
  UPDATE feedback SET vote_count = v_count WHERE id = p_feedback_id;
  
  RETURN jsonb_build_object('vote_count', v_count);
END;
$$;


ALTER FUNCTION "public"."vote_for_feedback"("p_feedback_id" "uuid", "p_voter_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text"
);


ALTER TABLE "public"."apps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_admin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "commenter_email" "text",
    "notify_on_reply" boolean DEFAULT false
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "vote_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "submitter_email" "text",
    "notify_on_updates" boolean DEFAULT false,
    "version" "text",
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'planned'::"text", 'progress'::"text", 'completed'::"text", 'wont_do'::"text"]))),
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['feature'::"text", 'bug'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feedback_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."version_releases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "released_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."version_releases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "voter_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."apps"
    ADD CONSTRAINT "apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."apps"
    ADD CONSTRAINT "apps_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_attachments"
    ADD CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."version_releases"
    ADD CONSTRAINT "version_releases_app_id_version_key" UNIQUE ("app_id", "version");



ALTER TABLE ONLY "public"."version_releases"
    ADD CONSTRAINT "version_releases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_feedback_id_voter_id_key" UNIQUE ("feedback_id", "voter_id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_attachments"
    ADD CONSTRAINT "feedback_attachments_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."version_releases"
    ADD CONSTRAINT "version_releases_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE CASCADE;



CREATE POLICY "Admin delete feedback attachments" ON "public"."feedback_attachments" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can create comments" ON "public"."comments" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete apps" ON "public"."apps" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete comments" ON "public"."comments" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert apps" ON "public"."apps" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage version releases" ON "public"."version_releases" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update apps" ON "public"."apps" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update feedback" ON "public"."feedback" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Anyone can create feedback" ON "public"."feedback" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read version releases" ON "public"."version_releases" FOR SELECT USING (true);



CREATE POLICY "Anyone can view apps" ON "public"."apps" FOR SELECT USING (true);



CREATE POLICY "Anyone can view comments" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view feedback" ON "public"."feedback" FOR SELECT USING (true);



CREATE POLICY "Anyone can view votes" ON "public"."votes" FOR SELECT USING (true);



CREATE POLICY "Anyone can vote" ON "public"."votes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert feedback attachments" ON "public"."feedback_attachments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read feedback attachments" ON "public"."feedback_attachments" FOR SELECT USING (true);



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."apps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."version_releases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."delete_feedback_cascade"("p_feedback_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_feedback_cascade"("p_feedback_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_feedback_cascade"("p_feedback_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_for_feedback"("p_feedback_id" "uuid", "p_voter_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."vote_for_feedback"("p_feedback_id" "uuid", "p_voter_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vote_for_feedback"("p_feedback_id" "uuid", "p_voter_id" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."apps" TO "anon";
GRANT ALL ON TABLE "public"."apps" TO "authenticated";
GRANT ALL ON TABLE "public"."apps" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_attachments" TO "anon";
GRANT ALL ON TABLE "public"."feedback_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."version_releases" TO "anon";
GRANT ALL ON TABLE "public"."version_releases" TO "authenticated";
GRANT ALL ON TABLE "public"."version_releases" TO "service_role";



GRANT ALL ON TABLE "public"."votes" TO "anon";
GRANT ALL ON TABLE "public"."votes" TO "authenticated";
GRANT ALL ON TABLE "public"."votes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































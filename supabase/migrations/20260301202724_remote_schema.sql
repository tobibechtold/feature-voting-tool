drop extension if exists "pg_net";

drop policy "Admins can delete apps" on "public"."apps";

drop policy "Admins can insert apps" on "public"."apps";

drop policy "Admins can update apps" on "public"."apps";

drop policy "Admins can create comments" on "public"."comments";

drop policy "Admins can delete comments" on "public"."comments";

drop policy "Admins can update feedback" on "public"."feedback";

drop policy "Admin delete feedback attachments" on "public"."feedback_attachments";

drop policy "Admins can manage version releases" on "public"."version_releases";

alter table "public"."comments" drop constraint "comments_feedback_id_fkey";

alter table "public"."feedback" drop constraint "feedback_app_id_fkey";

alter table "public"."feedback_attachments" drop constraint "feedback_attachments_feedback_id_fkey";

alter table "public"."version_releases" drop constraint "version_releases_app_id_fkey";

alter table "public"."votes" drop constraint "votes_feedback_id_fkey";

drop function if exists "public"."has_role"(_user_id uuid, _role app_role);

alter table "public"."user_roles" alter column "role" set data type public.app_role using "role"::text::public.app_role;

alter table "public"."comments" add constraint "comments_feedback_id_fkey" FOREIGN KEY (feedback_id) REFERENCES public.feedback(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_feedback_id_fkey";

alter table "public"."feedback" add constraint "feedback_app_id_fkey" FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE not valid;

alter table "public"."feedback" validate constraint "feedback_app_id_fkey";

alter table "public"."feedback_attachments" add constraint "feedback_attachments_feedback_id_fkey" FOREIGN KEY (feedback_id) REFERENCES public.feedback(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_attachments" validate constraint "feedback_attachments_feedback_id_fkey";

alter table "public"."version_releases" add constraint "version_releases_app_id_fkey" FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE not valid;

alter table "public"."version_releases" validate constraint "version_releases_app_id_fkey";

alter table "public"."votes" add constraint "votes_feedback_id_fkey" FOREIGN KEY (feedback_id) REFERENCES public.feedback(id) ON DELETE CASCADE not valid;

alter table "public"."votes" validate constraint "votes_feedback_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;


  create policy "Admins can delete apps"
  on "public"."apps"
  as permissive
  for delete
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can insert apps"
  on "public"."apps"
  as permissive
  for insert
  to public
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can update apps"
  on "public"."apps"
  as permissive
  for update
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can create comments"
  on "public"."comments"
  as permissive
  for insert
  to public
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can delete comments"
  on "public"."comments"
  as permissive
  for delete
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can update feedback"
  on "public"."feedback"
  as permissive
  for update
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admin delete feedback attachments"
  on "public"."feedback_attachments"
  as permissive
  for delete
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can manage version releases"
  on "public"."version_releases"
  as permissive
  for all
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admin delete feedback attachment files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'feedback-attachments'::text));



  create policy "Admins can manage logos"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using (((bucket_id = 'app-logos'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)))
with check (((bucket_id = 'app-logos'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "Public can view logos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'app-logos'::text));



  create policy "Public read feedback attachment files"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'feedback-attachments'::text));



  create policy "Public upload feedback attachment files"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'feedback-attachments'::text));




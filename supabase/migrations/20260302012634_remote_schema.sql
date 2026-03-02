drop trigger if exists "trg_default_release_target_platform" on "public"."feedback_release_targets";

drop trigger if exists "trg_validate_release_group_platform" on "public"."release_group_platforms";

drop trigger if exists "trg_seed_release_group_platform_defaults" on "public"."release_groups";

drop policy "Admins can manage feedback release targets" on "public"."feedback_release_targets";

drop policy "Anyone can read feedback release targets" on "public"."feedback_release_targets";

drop policy "Admins can manage release group platforms" on "public"."release_group_platforms";

drop policy "Anyone can read release group platforms" on "public"."release_group_platforms";

drop policy "Admins can manage release groups" on "public"."release_groups";

drop policy "Anyone can read release groups" on "public"."release_groups";

revoke delete on table "public"."feedback_release_targets" from "anon";

revoke insert on table "public"."feedback_release_targets" from "anon";

revoke references on table "public"."feedback_release_targets" from "anon";

revoke select on table "public"."feedback_release_targets" from "anon";

revoke trigger on table "public"."feedback_release_targets" from "anon";

revoke truncate on table "public"."feedback_release_targets" from "anon";

revoke update on table "public"."feedback_release_targets" from "anon";

revoke delete on table "public"."feedback_release_targets" from "authenticated";

revoke insert on table "public"."feedback_release_targets" from "authenticated";

revoke references on table "public"."feedback_release_targets" from "authenticated";

revoke select on table "public"."feedback_release_targets" from "authenticated";

revoke trigger on table "public"."feedback_release_targets" from "authenticated";

revoke truncate on table "public"."feedback_release_targets" from "authenticated";

revoke update on table "public"."feedback_release_targets" from "authenticated";

revoke delete on table "public"."feedback_release_targets" from "service_role";

revoke insert on table "public"."feedback_release_targets" from "service_role";

revoke references on table "public"."feedback_release_targets" from "service_role";

revoke select on table "public"."feedback_release_targets" from "service_role";

revoke trigger on table "public"."feedback_release_targets" from "service_role";

revoke truncate on table "public"."feedback_release_targets" from "service_role";

revoke update on table "public"."feedback_release_targets" from "service_role";

revoke delete on table "public"."release_group_platforms" from "anon";

revoke insert on table "public"."release_group_platforms" from "anon";

revoke references on table "public"."release_group_platforms" from "anon";

revoke select on table "public"."release_group_platforms" from "anon";

revoke trigger on table "public"."release_group_platforms" from "anon";

revoke truncate on table "public"."release_group_platforms" from "anon";

revoke update on table "public"."release_group_platforms" from "anon";

revoke delete on table "public"."release_group_platforms" from "authenticated";

revoke insert on table "public"."release_group_platforms" from "authenticated";

revoke references on table "public"."release_group_platforms" from "authenticated";

revoke select on table "public"."release_group_platforms" from "authenticated";

revoke trigger on table "public"."release_group_platforms" from "authenticated";

revoke truncate on table "public"."release_group_platforms" from "authenticated";

revoke update on table "public"."release_group_platforms" from "authenticated";

revoke delete on table "public"."release_group_platforms" from "service_role";

revoke insert on table "public"."release_group_platforms" from "service_role";

revoke references on table "public"."release_group_platforms" from "service_role";

revoke select on table "public"."release_group_platforms" from "service_role";

revoke trigger on table "public"."release_group_platforms" from "service_role";

revoke truncate on table "public"."release_group_platforms" from "service_role";

revoke update on table "public"."release_group_platforms" from "service_role";

revoke delete on table "public"."release_groups" from "anon";

revoke insert on table "public"."release_groups" from "anon";

revoke references on table "public"."release_groups" from "anon";

revoke select on table "public"."release_groups" from "anon";

revoke trigger on table "public"."release_groups" from "anon";

revoke truncate on table "public"."release_groups" from "anon";

revoke update on table "public"."release_groups" from "anon";

revoke delete on table "public"."release_groups" from "authenticated";

revoke insert on table "public"."release_groups" from "authenticated";

revoke references on table "public"."release_groups" from "authenticated";

revoke select on table "public"."release_groups" from "authenticated";

revoke trigger on table "public"."release_groups" from "authenticated";

revoke truncate on table "public"."release_groups" from "authenticated";

revoke update on table "public"."release_groups" from "authenticated";

revoke delete on table "public"."release_groups" from "service_role";

revoke insert on table "public"."release_groups" from "service_role";

revoke references on table "public"."release_groups" from "service_role";

revoke select on table "public"."release_groups" from "service_role";

revoke trigger on table "public"."release_groups" from "service_role";

revoke truncate on table "public"."release_groups" from "service_role";

revoke update on table "public"."release_groups" from "service_role";

alter table "public"."feedback_release_targets" drop constraint "feedback_release_targets_feedback_id_fkey";

alter table "public"."feedback_release_targets" drop constraint "feedback_release_targets_feedback_id_release_group_id_platf_key";

alter table "public"."feedback_release_targets" drop constraint "feedback_release_targets_platform_nonempty_check";

alter table "public"."feedback_release_targets" drop constraint "feedback_release_targets_release_group_id_fkey";

alter table "public"."release_group_platforms" drop constraint "release_group_platforms_platform_nonempty_check";

alter table "public"."release_group_platforms" drop constraint "release_group_platforms_release_group_id_fkey";

alter table "public"."release_group_platforms" drop constraint "release_group_platforms_release_group_id_platform_key";

alter table "public"."release_group_platforms" drop constraint "release_group_platforms_status_check";

alter table "public"."release_group_platforms" drop constraint "release_group_platforms_version_nonempty_check";

alter table "public"."release_groups" drop constraint "release_groups_app_id_fkey";

alter table "public"."release_groups" drop constraint "release_groups_app_id_semver_key";

alter table "public"."release_groups" drop constraint "release_groups_semver_nonempty_check";

drop view if exists "public"."changelog_release_items";

drop function if exists "public"."default_release_target_platform"();

drop function if exists "public"."seed_release_group_platform_defaults"();

drop function if exists "public"."validate_release_group_platform"();

alter table "public"."feedback_release_targets" drop constraint "feedback_release_targets_pkey";

alter table "public"."release_group_platforms" drop constraint "release_group_platforms_pkey";

alter table "public"."release_groups" drop constraint "release_groups_pkey";

drop index if exists "public"."feedback_release_targets_feedback_id_release_group_id_platf_key";

drop index if exists "public"."feedback_release_targets_feedback_idx";

drop index if exists "public"."feedback_release_targets_group_idx";

drop index if exists "public"."feedback_release_targets_pkey";

drop index if exists "public"."release_group_platforms_group_idx";

drop index if exists "public"."release_group_platforms_pkey";

drop index if exists "public"."release_group_platforms_release_group_id_platform_key";

drop index if exists "public"."release_groups_app_id_idx";

drop index if exists "public"."release_groups_app_id_semver_key";

drop index if exists "public"."release_groups_pkey";

drop table "public"."feedback_release_targets";

drop table "public"."release_group_platforms";

drop table "public"."release_groups";



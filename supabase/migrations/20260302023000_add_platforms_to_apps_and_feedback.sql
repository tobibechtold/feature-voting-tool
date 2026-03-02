begin;

alter table public.apps
  add column if not exists platforms text[];

update public.apps
set platforms = array['web']::text[]
where platforms is null
   or coalesce(array_length(platforms, 1), 0) = 0;

alter table public.apps
  alter column platforms set default array['web']::text[],
  alter column platforms set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'apps_platforms_nonempty_check'
      and conrelid = 'public.apps'::regclass
  ) then
    alter table public.apps
      add constraint apps_platforms_nonempty_check
      check (array_length(platforms, 1) > 0);
  end if;
end $$;

alter table public.feedback
  add column if not exists platform text;

update public.feedback f
set platform = a.platforms[1]
from public.apps a
where f.app_id = a.id
  and f.type = 'bug'
  and f.platform is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_platform_type_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_platform_type_check
      check (
        (type = 'bug' and platform is not null and btrim(platform) <> '')
        or
        (type <> 'bug' and platform is null)
      ) not valid;
  end if;
end $$;

alter table public.feedback validate constraint feedback_platform_type_check;

create or replace function public.validate_feedback_platform()
returns trigger
language plpgsql
as $$
declare
  app_platforms text[];
begin
  select platforms into app_platforms
  from public.apps
  where id = new.app_id;

  if app_platforms is null or array_length(app_platforms, 1) is null then
    raise exception 'App % has no supported platforms configured', new.app_id;
  end if;

  if new.type = 'bug' then
    if new.platform is null or btrim(new.platform) = '' then
      raise exception 'Platform is required for bug feedback';
    end if;

    if not (new.platform = any(app_platforms)) then
      raise exception 'Platform "%" is not supported by this app', new.platform;
    end if;
  else
    new.platform := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_feedback_platform on public.feedback;

create trigger trg_validate_feedback_platform
before insert or update of app_id, type, platform
on public.feedback
for each row
execute function public.validate_feedback_platform();

create index if not exists feedback_app_platform_bug_idx
  on public.feedback (app_id, platform)
  where type = 'bug';

commit;

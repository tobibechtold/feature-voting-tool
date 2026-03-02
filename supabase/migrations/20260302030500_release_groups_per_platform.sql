begin;

create table if not exists public.release_groups (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  semver text not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  unique (app_id, semver)
);

create table if not exists public.release_group_platforms (
  id uuid primary key default gen_random_uuid(),
  release_group_id uuid not null references public.release_groups(id) on delete cascade,
  platform text not null,
  version text not null,
  status text not null default 'planned',
  released_at date,
  created_at timestamptz not null default now(),
  unique (release_group_id, platform)
);

create table if not exists public.feedback_release_targets (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  release_group_id uuid not null references public.release_groups(id) on delete cascade,
  platform text,
  created_at timestamptz not null default now(),
  unique (feedback_id, release_group_id, platform)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'release_group_platforms_status_check'
      and conrelid = 'public.release_group_platforms'::regclass
  ) then
    alter table public.release_group_platforms
      add constraint release_group_platforms_status_check
      check (status = any (array['planned'::text, 'released'::text]));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'release_group_platforms_platform_nonempty_check'
      and conrelid = 'public.release_group_platforms'::regclass
  ) then
    alter table public.release_group_platforms
      add constraint release_group_platforms_platform_nonempty_check
      check (btrim(platform) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'release_group_platforms_version_nonempty_check'
      and conrelid = 'public.release_group_platforms'::regclass
  ) then
    alter table public.release_group_platforms
      add constraint release_group_platforms_version_nonempty_check
      check (btrim(version) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'release_groups_semver_nonempty_check'
      and conrelid = 'public.release_groups'::regclass
  ) then
    alter table public.release_groups
      add constraint release_groups_semver_nonempty_check
      check (btrim(semver) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_release_targets_platform_nonempty_check'
      and conrelid = 'public.feedback_release_targets'::regclass
  ) then
    alter table public.feedback_release_targets
      add constraint feedback_release_targets_platform_nonempty_check
      check (platform is null or btrim(platform) <> '');
  end if;
end $$;

create or replace function public.validate_release_group_platform()
returns trigger
language plpgsql
as $$
declare
  app_platforms text[];
  platform_count int;
begin
  select a.platforms
  into app_platforms
  from public.release_groups rg
  join public.apps a on a.id = rg.app_id
  where rg.id = new.release_group_id;

  if app_platforms is null or array_length(app_platforms, 1) is null then
    raise exception 'App for release group % has no platforms configured', new.release_group_id;
  end if;

  platform_count := array_length(app_platforms, 1);

  if new.platform = 'all' then
    if platform_count <= 1 then
      raise exception 'Platform "all" is only valid for apps with multiple platforms';
    end if;
  elsif not (new.platform = any(app_platforms)) then
    raise exception 'Platform "%" is not configured for this app', new.platform;
  end if;

  if new.status = 'released' and new.released_at is null then
    new.released_at := current_date;
  end if;

  if new.status = 'planned' then
    new.released_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_release_group_platform on public.release_group_platforms;
create trigger trg_validate_release_group_platform
before insert or update of platform, status, released_at, release_group_id
on public.release_group_platforms
for each row
execute function public.validate_release_group_platform();

create or replace function public.default_release_target_platform()
returns trigger
language plpgsql
as $$
declare
  app_platforms text[];
  platform_count int;
begin
  if not exists (
    select 1
    from public.feedback f
    join public.release_groups rg on rg.id = new.release_group_id
    where f.id = new.feedback_id
      and f.app_id = rg.app_id
  ) then
    raise exception 'Feedback and release group must belong to the same app';
  end if;

  select platforms into app_platforms
  from public.apps a
  join public.feedback f on f.app_id = a.id
  where f.id = new.feedback_id;

  platform_count := coalesce(array_length(app_platforms, 1), 0);

  if new.platform is null or btrim(new.platform) = '' then
    if platform_count > 1 then
      new.platform := 'all';
    else
      new.platform := coalesce(app_platforms[1], 'web');
    end if;
  end if;

  if new.platform = 'all' and platform_count <= 1 then
    raise exception 'Platform "all" is only valid for apps with multiple platforms';
  end if;

  if new.platform <> 'all' and not (new.platform = any(app_platforms)) then
    raise exception 'Platform "%" is not configured for this app', new.platform;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_default_release_target_platform on public.feedback_release_targets;
create trigger trg_default_release_target_platform
before insert or update of feedback_id, release_group_id, platform
on public.feedback_release_targets
for each row
execute function public.default_release_target_platform();

create or replace function public.seed_release_group_platform_defaults()
returns trigger
language plpgsql
as $$
declare
  app_platforms text[];
  platform_count int;
begin
  select a.platforms
  into app_platforms
  from public.apps a
  where a.id = new.app_id;

  platform_count := coalesce(array_length(app_platforms, 1), 0);

  if platform_count > 1 then
    insert into public.release_group_platforms (release_group_id, platform, version, status)
    values (new.id, 'all', new.semver, 'planned')
    on conflict (release_group_id, platform) do nothing;
  elsif platform_count = 1 then
    insert into public.release_group_platforms (release_group_id, platform, version, status)
    values (new.id, app_platforms[1], new.semver, 'planned')
    on conflict (release_group_id, platform) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_seed_release_group_platform_defaults on public.release_groups;
create trigger trg_seed_release_group_platform_defaults
after insert on public.release_groups
for each row
execute function public.seed_release_group_platform_defaults();

create index if not exists release_groups_app_id_idx
  on public.release_groups (app_id);

create index if not exists release_group_platforms_group_idx
  on public.release_group_platforms (release_group_id, platform);

create index if not exists feedback_release_targets_feedback_idx
  on public.feedback_release_targets (feedback_id);

create index if not exists feedback_release_targets_group_idx
  on public.feedback_release_targets (release_group_id, platform);

insert into public.release_groups (app_id, semver)
select src.app_id, src.version
from (
  select distinct f.app_id, f.version
  from public.feedback f
  where f.version is not null and btrim(f.version) <> ''
  union
  select distinct vr.app_id, vr.version
  from public.version_releases vr
) src
on conflict (app_id, semver) do nothing;

insert into public.release_group_platforms (release_group_id, platform, version, status, released_at)
select
  rg.id,
  case
    when coalesce(array_length(a.platforms, 1), 0) > 1 then 'all'
    else coalesce(a.platforms[1], 'web')
  end as platform,
  rg.semver as version,
  case when vr.released_at is null then 'planned' else 'released' end as status,
  vr.released_at
from public.release_groups rg
join public.apps a on a.id = rg.app_id
left join public.version_releases vr
  on vr.app_id = rg.app_id and vr.version = rg.semver
on conflict (release_group_id, platform) do nothing;

insert into public.feedback_release_targets (feedback_id, release_group_id, platform)
select
  f.id,
  rg.id,
  case
    when coalesce(array_length(a.platforms, 1), 0) > 1 then
      case
        when f.platform is null or btrim(f.platform) = '' then 'all'
        when f.platform = 'all' then 'all'
        when f.platform = any(a.platforms) then f.platform
        else 'all'
      end
    else
      case
        when f.platform is null or btrim(f.platform) = '' then coalesce(a.platforms[1], 'web')
        when f.platform = any(a.platforms) then f.platform
        else coalesce(a.platforms[1], 'web')
      end
  end as platform
from public.feedback f
join public.release_groups rg
  on rg.app_id = f.app_id
 and rg.semver = f.version
join public.apps a
  on a.id = f.app_id
where f.version is not null
  and btrim(f.version) <> ''
on conflict (feedback_id, release_group_id, platform) do nothing;

alter table public.feedback_release_targets
  alter column platform set not null;

create or replace view public.changelog_release_items as
select
  rg.id as release_group_id,
  rg.app_id,
  rg.semver,
  rg.title,
  rg.notes,
  rg.created_at as release_created_at,
  rgp.platform,
  rgp.version as platform_version,
  rgp.status as platform_status,
  rgp.released_at,
  f.id as feedback_id,
  f.type as feedback_type,
  f.title as feedback_title,
  f.description as feedback_description,
  f.status as feedback_status,
  frt.platform as feedback_target_platform
from public.release_groups rg
join public.release_group_platforms rgp on rgp.release_group_id = rg.id
left join public.feedback_release_targets frt on frt.release_group_id = rg.id
left join public.feedback f on f.id = frt.feedback_id;

alter table public.release_groups enable row level security;
alter table public.release_group_platforms enable row level security;
alter table public.feedback_release_targets enable row level security;

drop policy if exists "Anyone can read release groups" on public.release_groups;
create policy "Anyone can read release groups"
  on public.release_groups
  for select
  using (true);

drop policy if exists "Admins can manage release groups" on public.release_groups;
create policy "Admins can manage release groups"
  on public.release_groups
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Anyone can read release group platforms" on public.release_group_platforms;
create policy "Anyone can read release group platforms"
  on public.release_group_platforms
  for select
  using (true);

drop policy if exists "Admins can manage release group platforms" on public.release_group_platforms;
create policy "Admins can manage release group platforms"
  on public.release_group_platforms
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Anyone can read feedback release targets" on public.feedback_release_targets;
create policy "Anyone can read feedback release targets"
  on public.feedback_release_targets
  for select
  using (true);

drop policy if exists "Admins can manage feedback release targets" on public.feedback_release_targets;
create policy "Admins can manage feedback release targets"
  on public.feedback_release_targets
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

grant all on table public.release_groups to anon;
grant all on table public.release_groups to authenticated;
grant all on table public.release_groups to service_role;

grant all on table public.release_group_platforms to anon;
grant all on table public.release_group_platforms to authenticated;
grant all on table public.release_group_platforms to service_role;

grant all on table public.feedback_release_targets to anon;
grant all on table public.feedback_release_targets to authenticated;
grant all on table public.feedback_release_targets to service_role;

grant all on table public.changelog_release_items to anon;
grant all on table public.changelog_release_items to authenticated;
grant all on table public.changelog_release_items to service_role;

commit;

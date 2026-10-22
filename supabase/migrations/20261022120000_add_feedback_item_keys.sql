begin;

-- Per-app item keys (e.g. INTAKE) and per-app feedback numbers (e.g. 42),
-- combined in the app as INTAKE-42.

-- 1. App columns
alter table public.apps
  add column item_key text,
  add column next_item_number integer not null default 1;

-- 2. Key derivation from a slug: uppercase, strip non [A-Z0-9], prefix X if
-- it starts with a digit, pad with X to 2 chars, truncate to 10. On collision
-- with an existing app key, append 2, 3, ... re-truncating the base so the
-- total stays <= 10 chars.
create or replace function public.derive_item_key(p_slug text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix text;
  v_n integer := 1;
begin
  v_base := regexp_replace(upper(coalesce(p_slug, '')), '[^A-Z0-9]', '', 'g');
  if v_base ~ '^[0-9]' then
    v_base := 'X' || v_base;
  end if;
  if length(v_base) < 2 then
    v_base := rpad(v_base, 2, 'X');
  end if;
  v_base := left(v_base, 10);

  v_candidate := v_base;
  while exists (select 1 from public.apps where item_key = v_candidate) loop
    v_n := v_n + 1;
    v_suffix := v_n::text;
    v_candidate := left(v_base, 10 - length(v_suffix)) || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

-- 3. Backfill existing apps one by one so later rows see earlier keys
do $$
declare
  r record;
begin
  for r in select id, slug from public.apps order by created_at, id loop
    update public.apps
    set item_key = public.derive_item_key(r.slug)
    where id = r.id;
  end loop;
end $$;

-- 4. Constraints
alter table public.apps
  alter column item_key set not null,
  add constraint apps_item_key_key unique (item_key),
  add constraint apps_item_key_format check (item_key ~ '^[A-Z][A-Z0-9]{1,9}$');

-- 5. Derive a key for new apps that do not provide one
create or replace function public.set_app_item_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.item_key is null then
    new.item_key := public.derive_item_key(new.slug);
  end if;
  return new;
end;
$$;

create trigger apps_set_item_key
  before insert on public.apps
  for each row execute function public.set_app_item_key();

-- 6. Feedback numbers, backfilled per app in creation order
alter table public.feedback
  add column number integer;

update public.feedback f
set number = numbered.rn
from (
  select id, row_number() over (partition by app_id order by created_at, id) as rn
  from public.feedback
) numbered
where f.id = numbered.id;

update public.apps
set next_item_number = coalesce(
  (select max(number) from public.feedback where app_id = apps.id), 0
) + 1;

alter table public.feedback
  alter column number set not null,
  add constraint feedback_app_id_number_key unique (app_id, number);

-- 7. Assign the next number on insert. Security definer so anonymous
-- submitters (who cannot update apps) still advance the counter; any
-- client-supplied number is overwritten.
create or replace function public.assign_feedback_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.apps
  set next_item_number = next_item_number + 1
  where id = new.app_id
  returning next_item_number - 1 into new.number;
  return new;
end;
$$;

create trigger feedback_assign_number
  before insert on public.feedback
  for each row execute function public.assign_feedback_number();

-- 8. Numbers are immutable
create or replace function public.keep_feedback_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.number := old.number;
  return new;
end;
$$;

create trigger feedback_keep_number
  before update on public.feedback
  for each row execute function public.keep_feedback_number();

commit;

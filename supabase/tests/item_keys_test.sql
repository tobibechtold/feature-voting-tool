begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Schema
select has_column('public', 'apps', 'item_key', 'apps.item_key exists');
select has_column('public', 'feedback', 'number', 'feedback.number exists');

-- Pure base derivation (no apps inserted yet in this transaction, and no
-- pre-existing apps derive to these keys)
select is(public.derive_item_key('roadmap-tool'), 'ROADMAPTOO', 'derive strips non-alnum and truncates to 10');
select is(public.derive_item_key('intake'), 'INTAKE', 'derive uppercases');
select is(public.derive_item_key('9lives'), 'X9LIVES', 'derive prefixes X when starting with a digit');
select is(public.derive_item_key('a'), 'AX', 'derive pads to 2 chars');

-- Apps get a derived item_key on insert, with collision suffixes
insert into public.apps (id, name, slug)
values ('00000000-0000-0000-0000-00000000a001', 'Intake', 'intake');
insert into public.apps (id, name, slug)
values ('00000000-0000-0000-0000-00000000a002', 'In Take', 'in-take');
insert into public.apps (id, name, slug)
values ('00000000-0000-0000-0000-00000000a003', 'Roadmap Tool', 'roadmap-tool');
insert into public.apps (id, name, slug)
values ('00000000-0000-0000-0000-00000000a004', 'Roadmaptool', 'roadmaptool');

select is(
  (select item_key from public.apps where id = '00000000-0000-0000-0000-00000000a001'),
  'INTAKE', 'app without key gets derived key');
select is(
  (select item_key from public.apps where id = '00000000-0000-0000-0000-00000000a002'),
  'INTAKE2', 'colliding key gets suffix 2');
select is(
  (select item_key from public.apps where id = '00000000-0000-0000-0000-00000000a003'),
  'ROADMAPTOO', 'long slug gets truncated key');
select is(
  (select item_key from public.apps where id = '00000000-0000-0000-0000-00000000a004'),
  'ROADMAPTO2', 'colliding truncated key re-truncates base to fit suffix');

-- Explicit keys must match the format
select throws_ok(
  $$insert into public.apps (name, slug, item_key) values ('Lower', 'lower-key', 'abc')$$,
  '23514', null, 'lowercase item_key is rejected');
select throws_ok(
  $$insert into public.apps (name, slug, item_key) values ('Hyphen', 'hyphen-key', 'A-B')$$,
  '23514', null, 'hyphenated item_key is rejected');

-- Feedback numbers are per app, sequential
insert into public.feedback (id, app_id, type, title, description) values
  ('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000a001', 'feature', 'one', 'd');
insert into public.feedback (id, app_id, type, title, description) values
  ('00000000-0000-0000-0000-0000000f0002', '00000000-0000-0000-0000-00000000a001', 'feature', 'two', 'd');
insert into public.feedback (id, app_id, type, title, description) values
  ('00000000-0000-0000-0000-0000000f0003', '00000000-0000-0000-0000-00000000a001', 'feature', 'three', 'd');
insert into public.feedback (id, app_id, type, title, description) values
  ('00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-00000000a002', 'feature', 'other', 'd');

select results_eq(
  $$select number from public.feedback
    where app_id = '00000000-0000-0000-0000-00000000a001' order by number$$,
  array[1, 2, 3],
  'feedback in one app is numbered 1, 2, 3');
select is(
  (select number from public.feedback where id = '00000000-0000-0000-0000-0000000f0101'),
  1, 'numbering is per app');

-- Numbers are never reused
delete from public.feedback where id = '00000000-0000-0000-0000-0000000f0003';
insert into public.feedback (id, app_id, type, title, description) values
  ('00000000-0000-0000-0000-0000000f0004', '00000000-0000-0000-0000-00000000a001', 'feature', 'four', 'd');
select is(
  (select number from public.feedback where id = '00000000-0000-0000-0000-0000000f0004'),
  4, 'deleted number is not reused');

-- Forged number on insert is overwritten
insert into public.feedback (id, app_id, type, title, description, number) values
  ('00000000-0000-0000-0000-0000000f0005', '00000000-0000-0000-0000-00000000a001', 'feature', 'forged', 'd', 999);
select is(
  (select number from public.feedback where id = '00000000-0000-0000-0000-0000000f0005'),
  5, 'forged number on insert is replaced by next counter value');

-- Number is immutable
update public.feedback set number = 50 where id = '00000000-0000-0000-0000-0000000f0001';
select is(
  (select number from public.feedback where id = '00000000-0000-0000-0000-0000000f0001'),
  1, 'number cannot be changed by update');

-- Anonymous insert still gets a number (trigger is security definer)
set local role anon;
insert into public.feedback (id, app_id, type, title, description, number) values
  ('00000000-0000-0000-0000-0000000f0006', '00000000-0000-0000-0000-00000000a001', 'feature', 'anon', 'd', 999);
reset role;
select is(
  (select number from public.feedback where id = '00000000-0000-0000-0000-0000000f0006'),
  6, 'anon insert gets next number');

select * from finish();
rollback;

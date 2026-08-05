begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.api_tokens enable row level security;

drop policy if exists "Admins can view api tokens" on public.api_tokens;
create policy "Admins can view api tokens"
  on public.api_tokens for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can update api tokens" on public.api_tokens;
create policy "Admins can update api tokens"
  on public.api_tokens for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No insert/delete policies: creation goes through the RPC below (which
-- hashes the token), and tokens are revoked rather than deleted.

create or replace function public.create_api_token(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can create API tokens';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Token name is required';
  end if;

  v_token := 'fvt_' || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.api_tokens (name, token_hash, created_by)
  values (trim(p_name), encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());

  return v_token;
end;
$$;

revoke execute on function public.create_api_token(text) from public;
revoke execute on function public.create_api_token(text) from anon;
grant execute on function public.create_api_token(text) to authenticated;

commit;

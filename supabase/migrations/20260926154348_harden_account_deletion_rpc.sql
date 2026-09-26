-- Applied to Pendly production as migration 20260926154348.
-- Keeps the public RPC security-invoker and moves privileged deletion into private schema.

create schema if not exists private;

create or replace function private.delete_my_account_impl()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet.';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function private.delete_my_account_impl() from public;
revoke all on function private.delete_my_account_impl() from anon;
revoke all on function private.delete_my_account_impl() from authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;
  perform private.delete_my_account_impl();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

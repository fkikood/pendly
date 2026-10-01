-- Pendly Admin Feedback Console
-- Authorization is based on a server-issued Supabase app_metadata.role claim.
-- Never set this claim from user-editable user_metadata or the browser.
begin;

create table if not exists public.feedback_admin_notes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback_reports(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  note text not null check (char_length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.feedback_admin_notes enable row level security;

create or replace function public.is_pendly_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

drop policy if exists "Pendly admins read all feedback" on public.feedback_reports;
create policy "Pendly admins read all feedback"
on public.feedback_reports for select to authenticated
using (public.is_pendly_admin());

drop policy if exists "Pendly admins update feedback" on public.feedback_reports;
create policy "Pendly admins update feedback"
on public.feedback_reports for update to authenticated
using (public.is_pendly_admin())
with check (public.is_pendly_admin());

drop policy if exists "Pendly admins read internal notes" on public.feedback_admin_notes;
create policy "Pendly admins read internal notes"
on public.feedback_admin_notes for select to authenticated
using (public.is_pendly_admin());

drop policy if exists "Pendly admins add internal notes" on public.feedback_admin_notes;
create policy "Pendly admins add internal notes"
on public.feedback_admin_notes for insert to authenticated
with check (public.is_pendly_admin() and admin_user_id = auth.uid());

grant select, update on public.feedback_reports to authenticated;
grant select, insert on public.feedback_admin_notes to authenticated;
grant execute on function public.is_pendly_admin() to authenticated;

commit;

begin;
alter table public.feedback_reports drop constraint if exists feedback_reports_status_check;
alter table public.feedback_reports add constraint feedback_reports_status_check
  check (status = any (array['open','in_progress','awaiting_approval','resolved']::text[]));

create table if not exists public.feedback_admin_audit (
  id bigint generated always as identity primary key,
  feedback_id uuid not null references public.feedback_reports(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('status_changed','resolution_changed')),
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);
alter table public.feedback_admin_audit enable row level security;
drop policy if exists "Pendly admins read feedback audit" on public.feedback_admin_audit;
create policy "Pendly admins read feedback audit" on public.feedback_admin_audit
for select to authenticated using (public.is_pendly_admin());
grant select on public.feedback_admin_audit to authenticated;

create or replace function public.audit_feedback_admin_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.feedback_admin_audit(feedback_id,actor_user_id,action,old_status,new_status)
    values(new.id,auth.uid(),'status_changed',old.status,new.status);
  end if;
  if old.resolution_note is distinct from new.resolution_note then
    insert into public.feedback_admin_audit(feedback_id,actor_user_id,action,old_status,new_status)
    values(new.id,auth.uid(),'resolution_changed',old.status,new.status);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_feedback_admin_change() from public, anon, authenticated;
drop trigger if exists feedback_admin_audit_change on public.feedback_reports;
create trigger feedback_admin_audit_change
after update on public.feedback_reports
for each row execute function public.audit_feedback_admin_change();
commit;
begin;
create table if not exists public.feedback_email_events (
 id bigint generated always as identity primary key,
 provider text not null default 'resend',
 provider_event_id text not null unique,
 provider_email_id text,
 event_type text not null,
 recipient text,
 occurred_at timestamptz,
 feedback_id uuid references public.feedback_reports(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.feedback_email_events enable row level security;
drop policy if exists "Pendly admins read email events" on public.feedback_email_events;
create policy "Pendly admins read email events" on public.feedback_email_events for select to authenticated using (public.is_pendly_admin());
grant select on public.feedback_email_events to authenticated;
create index if not exists feedback_email_events_email_id_idx on public.feedback_email_events(provider_email_id);
commit;
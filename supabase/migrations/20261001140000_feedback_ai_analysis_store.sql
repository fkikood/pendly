begin;
create table if not exists public.feedback_ai_analyses (
 id uuid primary key default gen_random_uuid(),
 feedback_id uuid not null references public.feedback_reports(id) on delete cascade,
 requested_by uuid not null references auth.users(id) on delete restrict,
 provider text not null default 'openai',
 model text not null,
 diagnosis text not null,
 likely_causes jsonb not null default '[]'::jsonb,
 proposed_fix text not null,
 test_plan jsonb not null default '[]'::jsonb,
 risk_level text not null check (risk_level in ('low','medium','high')),
 created_at timestamptz not null default now()
);
alter table public.feedback_ai_analyses enable row level security;
drop policy if exists "Pendly admins read AI analyses" on public.feedback_ai_analyses;
create policy "Pendly admins read AI analyses" on public.feedback_ai_analyses
for select to authenticated using (public.is_pendly_admin());
grant select on public.feedback_ai_analyses to authenticated;
commit;
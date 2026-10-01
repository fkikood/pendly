-- Pendly Plus entitlement foundation. No payment provider or billing is activated by this migration.
create table if not exists public.user_entitlements (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' check (plan in ('free','plus')),
 status text not null default 'inactive' check (status in ('inactive','trialing','active','past_due','canceled','expired')),
 current_period_end timestamptz,
 provider text,
 provider_customer_id text,
 provider_subscription_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint user_entitlements_provider_check check (provider is null or provider in ('stripe'))
);
alter table public.user_entitlements enable row level security;
revoke all on public.user_entitlements from anon, authenticated;
grant select on public.user_entitlements to authenticated;
drop policy if exists "Users can read their own entitlement" on public.user_entitlements;
create policy "Users can read their own entitlement" on public.user_entitlements for select to authenticated using (user_id = (select auth.uid()));
create or replace function public.has_pendly_plus() returns boolean language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.user_entitlements e where e.user_id = (select auth.uid()) and e.plan = 'plus' and e.status in ('trialing','active') and (e.current_period_end is null or e.current_period_end > now())); $$;
revoke all on function public.has_pendly_plus() from public, anon;
grant execute on function public.has_pendly_plus() to authenticated;
create or replace function public.set_user_entitlement_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists set_user_entitlements_updated_at on public.user_entitlements;
create trigger set_user_entitlements_updated_at before update on public.user_entitlements for each row execute function public.set_user_entitlement_updated_at();
-- Writes are intentionally restricted to trusted server-side service-role operations.

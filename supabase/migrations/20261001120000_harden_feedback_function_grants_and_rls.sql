begin;

-- These routines are invoked by table triggers, not through the PostgREST RPC API.
-- Remove default PUBLIC and API-role EXECUTE grants while preserving trigger execution.
revoke all on function public.prepare_feedback_identity() from public, anon, authenticated;
revoke all on function public.set_feedback_resolution_timestamp() from public, anon, authenticated;
revoke all on function public.trigger_feedback_email() from public, anon, authenticated;

-- Avoid per-row repeated auth function evaluation in feedback RLS policies.
drop policy if exists "Users can read own feedback" on public.feedback_reports;
create policy "Users can read own feedback"
on public.feedback_reports for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can submit feedback" on public.feedback_reports;
create policy "Users can submit feedback"
on public.feedback_reports for insert to anon, authenticated
with check (
  ((select auth.uid()) is null and user_id is null)
  or
  ((select auth.uid()) is not null and user_id = (select auth.uid()))
);

commit;
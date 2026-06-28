-- Run in Supabase SQL Editor. Safe to run again.
-- Signed-out visitors remain blocked; only authenticated app users are allowed.

alter table public.client_payments enable row level security;

grant select, insert, update, delete
  on table public.client_payments
  to authenticated;

drop policy if exists "WeSet authenticated users manage client payments"
  on public.client_payments;

create policy "WeSet authenticated users manage client payments"
  on public.client_payments
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

notify pgrst, 'reload schema';


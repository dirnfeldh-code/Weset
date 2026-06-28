-- Run once in Supabase SQL Editor. Safe to run again.
create table if not exists public.expense_vat_records (
  expense_id uuid primary key references public.expenses(id) on delete cascade,
  enabled boolean not null default false,
  rate numeric not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expense_vat_records enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expense_vat_records' and policyname = 'Authenticated users can read expense_vat_records') then
    create policy "Authenticated users can read expense_vat_records" on public.expense_vat_records for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expense_vat_records' and policyname = 'Authenticated users can insert expense_vat_records') then
    create policy "Authenticated users can insert expense_vat_records" on public.expense_vat_records for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expense_vat_records' and policyname = 'Authenticated users can update expense_vat_records') then
    create policy "Authenticated users can update expense_vat_records" on public.expense_vat_records for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expense_vat_records' and policyname = 'Authenticated users can delete expense_vat_records') then
    create policy "Authenticated users can delete expense_vat_records" on public.expense_vat_records for delete to authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';


-- WeSet invoice table repair
-- Run this in Supabase SQL Editor if invoice saving says a column is missing.
-- It is safe to run more than once and it does not delete invoice data.

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists quote_id uuid null references public.quotes(id) on delete set null,
  add column if not exists client_id uuid null references public.clients(id) on delete set null,
  add column if not exists status text not null default 'Unpaid',
  add column if not exists subtotal numeric not null default 0,
  add column if not exists vat_enabled boolean not null default false,
  add column if not exists vat_rate numeric not null default 0,
  add column if not exists vat_amount numeric not null default 0,
  add column if not exists total numeric not null default 0,
  add column if not exists invoice_html text,
  add column if not exists due_date date,
  add column if not exists terms text,
  add column if not exists notes text,
  add column if not exists sent_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists invoices_invoice_number_key
  on public.invoices(invoice_number)
  where invoice_number is not null;

alter table public.invoices enable row level security;

do $$
declare
  policy_name text;
begin
  policy_name := 'Authenticated users can read invoices';
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = policy_name) then
    execute format('create policy %I on public.invoices for select to authenticated using (true)', policy_name);
  end if;

  policy_name := 'Authenticated users can insert invoices';
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = policy_name) then
    execute format('create policy %I on public.invoices for insert to authenticated with check (true)', policy_name);
  end if;

  policy_name := 'Authenticated users can update invoices';
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = policy_name) then
    execute format('create policy %I on public.invoices for update to authenticated using (true) with check (true)', policy_name);
  end if;

  policy_name := 'Authenticated users can delete invoices';
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = policy_name) then
    execute format('create policy %I on public.invoices for delete to authenticated using (true)', policy_name);
  end if;
end $$;

notify pgrst, 'reload schema';

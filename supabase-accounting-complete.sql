-- WeSet accounting completion tables
-- Run this in Supabase SQL Editor. It is safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  quote_id uuid null references public.quotes(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  status text not null default 'Unpaid',
  subtotal numeric not null default 0,
  vat_enabled boolean not null default false,
  vat_rate numeric not null default 0,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  invoice_html text,
  due_date date,
  terms text,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null default current_date,
  client_id uuid null references public.clients(id) on delete set null,
  invoice_number text null,
  amount numeric not null default 0,
  method text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_vat_records (
  expense_id uuid primary key references public.expenses(id) on delete cascade,
  enabled boolean not null default false,
  rate numeric not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vat_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null default current_date,
  amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.client_payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_vat_records enable row level security;
alter table public.vat_payments enable row level security;

do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array[
    'app_settings',
    'invoices',
    'client_payments',
    'expense_categories',
    'expense_vat_records',
    'vat_payments'
  ]
  loop
    policy_name := 'Authenticated users can read ' || target_table;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = target_table and policyname = policy_name) then
      execute format('create policy %I on public.%I for select to authenticated using (true)', policy_name, target_table);
    end if;

    policy_name := 'Authenticated users can insert ' || target_table;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = target_table and policyname = policy_name) then
      execute format('create policy %I on public.%I for insert to authenticated with check (true)', policy_name, target_table);
    end if;

    policy_name := 'Authenticated users can update ' || target_table;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = target_table and policyname = policy_name) then
      execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', policy_name, target_table);
    end if;

    policy_name := 'Authenticated users can delete ' || target_table;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = target_table and policyname = policy_name) then
      execute format('create policy %I on public.%I for delete to authenticated using (true)', policy_name, target_table);
    end if;
  end loop;
end $$;

insert into public.expense_categories(name)
values
  ('Supplier purchases'),
  ('Subcontractors'),
  ('Delivery'),
  ('Tools and equipment'),
  ('Software'),
  ('Marketing'),
  ('Travel'),
  ('Office overheads'),
  ('Other')
on conflict (name) do nothing;

notify pgrst, 'reload schema';

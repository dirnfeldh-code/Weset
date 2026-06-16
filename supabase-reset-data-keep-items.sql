-- WeSet reset data but keep item catalogue
-- Run this in Supabase SQL Editor.
-- This keeps public.items exactly as it is now.
-- It does NOT delete Authentication users or app_users.
-- It resets business data that can contain demo/local records.

begin;

-- Quote items must be removed before quotes because they belong to quotes.
delete from public.quote_items;

-- Installations may reference quotes or clients.
delete from public.installations;

-- Expenses are business/accounting records, not item catalogue records.
delete from public.expenses;

-- Quotes may reference clients, so remove quotes before clients.
delete from public.quotes;

-- Remove clients, including old demo clients like client-1/client-2.
delete from public.clients;

commit;

select 'clients' as table_name, count(*) as rows_left from public.clients
union all
select 'quotes', count(*) from public.quotes
union all
select 'quote_items', count(*) from public.quote_items
union all
select 'installations', count(*) from public.installations
union all
select 'expenses', count(*) from public.expenses
union all
select 'items_kept', count(*) from public.items
union all
select 'app_users_kept', count(*) from public.app_users;

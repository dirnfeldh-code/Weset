-- WeSet demo data cleanup
-- Run this in Supabase SQL Editor if you want to remove starter/demo records.
-- This does NOT delete Authentication users or app_users.
-- It only removes known demo clients, quotes, quote items, expenses, and starter catalogue rows.

begin;

-- Remove quote items attached to known demo quotes first.
delete from public.quote_items
where quote_id in (
  select id
  from public.quotes
  where id::text in ('Q-1001', 'Q-1002')
     or client_id::text in ('client-1', 'client-2')
);

-- Remove any quote items that reference starter catalogue product names/codes.
delete from public.quote_items
where item_name in (
  'Desktop computer',
  'Laptop',
  'Monitor',
  'Office desk',
  'Task chair',
  'Meeting room table',
  'Room layout plan',
  'Delivery and handling',
  'On-site setup day'
);

-- Remove known demo quotes.
delete from public.quotes
where id::text in ('Q-1001', 'Q-1002')
   or client_id::text in ('client-1', 'client-2')
   or setup_address_line1 in ('12 King Street', 'The Exchange')
   or setup_city in ('Manchester', 'Leeds');

-- Remove known demo clients.
delete from public.clients
where id::text in ('client-1', 'client-2')
   or company_name in ('Northline Finance', 'Brightpath Legal')
   or email in ('amelia.grant@example.com', 'samir.patel@example.com')
   or contact_name in ('Amelia Grant', 'Samir Patel');

-- Remove known demo expenses.
delete from public.expenses
where payee in ('Furniture supplier', 'Courier partner')
   or notes in ('Desks and chairs.', 'Delivery costs.');

-- Remove starter catalogue rows only if they are still the known demo/default items.
-- If you already customised any of these, do not run this block, or recreate your custom items after.
delete from public.items
where name in (
  'Desktop computer',
  'Laptop',
  'Monitor',
  'Office desk',
  'Task chair',
  'Meeting room table',
  'Room layout plan',
  'Delivery and handling',
  'On-site setup day'
)
or product_code in (
  'DESKTOP-PC',
  'LAPTOP',
  'MONITOR',
  'DESK',
  'TASK-CHAIR',
  'MEETING-TABLE',
  'FLOOR-PLAN',
  'DELIVERY',
  'ONSITE-SETUP'
);

commit;

select 'clients' as table_name, count(*) as rows_left from public.clients
union all
select 'quotes', count(*) from public.quotes
union all
select 'quote_items', count(*) from public.quote_items
union all
select 'items', count(*) from public.items
union all
select 'expenses', count(*) from public.expenses
union all
select 'app_users', count(*) from public.app_users;

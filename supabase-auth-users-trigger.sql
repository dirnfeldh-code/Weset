-- WeSet Supabase Auth -> app_users sync
-- Run this in Supabase SQL Editor.
-- It copies every new Authentication user into public.app_users.
-- It also backfills existing Authentication users once.
-- Do not use or share the service_role key for this.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key,
  email text not null,
  full_name text,
  role text not null default 'Staff',
  permissions jsonb not null default '["dashboard", "clients", "quotes", "items", "installations", "accounting", "users"]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists full_name text;
alter table public.app_users add column if not exists role text not null default 'Staff';
alter table public.app_users add column if not exists permissions jsonb not null default '["dashboard", "clients", "quotes", "items", "installations", "accounting", "users"]'::jsonb;
alter table public.app_users add column if not exists active boolean not null default true;
alter table public.app_users add column if not exists created_at timestamptz not null default now();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  updated_count integer;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    'User'
  );

  update public.app_users
  set
    id = new.id,
    email = new.email,
    full_name = coalesce(nullif(public.app_users.full_name, ''), display_name),
    active = true
  where lower(public.app_users.email) = lower(new.email);

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    insert into public.app_users (
      id,
      email,
      full_name,
      role,
      permissions,
      active,
      created_at
    ) values (
      new.id,
      new.email,
      display_name,
      'Staff',
      '["dashboard", "clients", "quotes", "items", "installations", "accounting", "users"]'::jsonb,
      true,
      now()
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = coalesce(nullif(public.app_users.full_name, ''), excluded.full_name),
      active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill users that already exist in Supabase Authentication.
update public.app_users as app_user
set
  id = auth_user.id,
  email = auth_user.email,
  full_name = coalesce(
    nullif(app_user.full_name, ''),
    auth_user.raw_user_meta_data ->> 'name',
    auth_user.raw_user_meta_data ->> 'full_name',
    split_part(auth_user.email, '@', 1),
    'User'
  ),
  active = true
from auth.users as auth_user
where auth_user.email is not null
  and lower(app_user.email) = lower(auth_user.email);

insert into public.app_users (
  id,
  email,
  full_name,
  role,
  permissions,
  active,
  created_at
)
select
  auth_user.id,
  auth_user.email,
  coalesce(
    auth_user.raw_user_meta_data ->> 'name',
    auth_user.raw_user_meta_data ->> 'full_name',
    split_part(auth_user.email, '@', 1),
    'User'
  ) as full_name,
  'Staff' as role,
  '["dashboard", "clients", "quotes", "items", "installations", "accounting", "users"]'::jsonb as permissions,
  true as active,
  now() as created_at
from auth.users as auth_user
where auth_user.email is not null
  and not exists (
    select 1
    from public.app_users as app_user
    where app_user.id = auth_user.id
       or lower(app_user.email) = lower(auth_user.email)
  );

select id, email, full_name, role, permissions, active
from public.app_users
order by created_at desc;

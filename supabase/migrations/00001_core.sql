-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00001 : core types, user profiles, reference data
-- =============================================================

-- ---------- Enums ----------
do $$ begin
  create type public.user_role as enum ('owner','manager','cashier','inventory');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','bank','wallet','credit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum
    ('purchase','sale','sales_return','purchase_return','damage','lost','adjustment','initial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tx_status as enum ('completed','cancelled');
exception when duplicate_object then null; end $$;

-- ---------- Generic helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =============================================================
--  PROFILES  (one row per login user)
-- =============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text not null default '',
  phone         text,
  role          public.user_role not null default 'cashier',
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a auth user is created (Supabase Auth).
-- The FIRST signed-up user becomes the shop owner; everyone after that
-- starts as a cashier and must be given a role by the owner.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_has_owner boolean;
  v_role public.user_role;
begin
  -- serialise first sign-ups so two people cannot both become owner
  perform pg_advisory_xact_lock(987654321);

  select exists (
    select 1 from public.profiles where role = 'owner' and is_active
  ) into v_has_owner;

  v_role := case when v_has_owner
                 then 'cashier'::public.user_role
                 else 'owner'::public.user_role end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync with auth user email
create or replace function public.handle_user_email_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_update();

-- =============================================================
--  REFERENCE DATA : categories, brands, units
-- =============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists categories_name_key
  on public.categories (lower(name));

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists brands_name_key
  on public.brands (lower(name));

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

create table if not exists public.units (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,           -- Piece, Box, Kg, Meter ...
  allow_decimal boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists units_name_key
  on public.units (lower(name));

create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

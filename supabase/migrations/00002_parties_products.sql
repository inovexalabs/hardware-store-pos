-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00002 : suppliers, customers, products, conversions
-- =============================================================

-- =============================================================
--  SUPPLIERS
-- =============================================================
create table if not exists public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  company          text,
  phone            text,
  address          text,
  email            text,
  pan_vat          text,
  notes            text,
  balance_payable  numeric(14,2) not null default 0,  -- money we owe supplier
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists suppliers_name_idx on public.suppliers (lower(name));
create index if not exists suppliers_phone_idx on public.suppliers (phone);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- =============================================================
--  CUSTOMERS
-- =============================================================
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  address       text,
  email         text,
  credit_limit  numeric(14,2) not null default 0,   -- 0 = no limit set
  notes         text,
  balance_due   numeric(14,2) not null default 0,   -- money customer owes us
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (lower(name));
create index if not exists customers_phone_idx on public.customers (phone);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- =============================================================
--  PRODUCTS  (stock is always held in the product's base unit)
-- =============================================================
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  sku             text not null,
  barcode         text,
  category_id     uuid references public.categories (id) on delete set null,
  brand_id        uuid references public.brands (id) on delete set null,
  unit_id         uuid not null references public.units (id),
  supplier_id     uuid references public.suppliers (id) on delete set null,
  purchase_price  numeric(14,2) not null default 0 check (purchase_price >= 0),
  selling_price   numeric(14,2) not null default 0 check (selling_price >= 0),
  wholesale_price numeric(14,2) not null default 0 check (wholesale_price >= 0),
  stock           numeric(14,3) not null default 0,
  min_stock       numeric(14,3) not null default 0 check (min_stock >= 0),
  avg_cost        numeric(14,4) not null default 0 check (avg_cost >= 0),
  rack            text,
  tax_rate        numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  image_url       text,
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
  -- stock is never allowed to go below zero by the business functions,
  -- except when the shop setting "allow negative stock" is switched on
);

-- SKU / barcode must be unique among active products (case-insensitive SKU)
create unique index if not exists products_sku_key
  on public.products (lower(sku)) where is_active;

create unique index if not exists products_barcode_key
  on public.products (barcode)
  where is_active and barcode is not null and barcode <> '';

create index if not exists products_name_idx on public.products (lower(name));
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_brand_idx on public.products (brand_id);
create index if not exists products_supplier_idx on public.products (supplier_id);
create index if not exists products_stock_idx on public.products (stock);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =============================================================
--  UNIT CONVERSIONS  (per product:  1 Box = 100 Piece)
-- =============================================================
create table if not exists public.unit_conversions (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  from_unit_id uuid not null references public.units (id),
  to_unit_id   uuid not null references public.units (id),
  factor       numeric(14,4) not null check (factor > 0),
  created_at   timestamptz not null default now(),
  constraint ck_unit_conversion_diff check (from_unit_id <> to_unit_id),
  constraint uq_unit_conversion unique (product_id, from_unit_id, to_unit_id)
);

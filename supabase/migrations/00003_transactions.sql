-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00003 : transactions, payments, stock, audit, settings
-- =============================================================

-- =============================================================
--  SHOP SETTINGS (single row)
-- =============================================================
create table if not exists public.shop_settings (
  id                   boolean primary key default true check (id),
  shop_name            text not null default 'My Hardware Shop',
  address              text,
  phone                text,
  email                text,
  pan_vat              text,
  logo_url             text,
  invoice_prefix       text not null default 'INV',
  purchase_prefix      text not null default 'PUR',
  receipt_size         text not null default '80mm'
                         check (receipt_size in ('58mm','80mm','a4')),
  tax_enabled          boolean not null default true,
  tax_rate             numeric(5,2) not null default 13 check (tax_rate >= 0 and tax_rate <= 100),
  invoice_footer       text not null default 'Thank you for your business!',
  allow_negative_stock boolean not null default false,
  onboarding_done      boolean not null default false,
  updated_by           uuid references public.profiles (id) on delete set null,
  updated_at           timestamptz not null default now()
);

insert into public.shop_settings (id) values (true)
on conflict (id) do nothing;

create trigger shop_settings_set_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

-- =============================================================
--  PERMISSIONS  (what each role is allowed to do)
-- =============================================================
create table if not exists public.permissions (
  code        text primary key,
  description text not null default ''
);

create table if not exists public.role_permissions (
  role            public.user_role not null,
  permission_code text not null references public.permissions (code) on delete cascade,
  primary key (role, permission_code)
);

-- =============================================================
--  SALES
-- =============================================================
create sequence if not exists public.invoice_number_seq start 1;
create sequence if not exists public.purchase_number_seq start 1;
create sequence if not exists public.sales_return_number_seq start 1;
create sequence if not exists public.purchase_return_number_seq start 1;

create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text not null unique,
  customer_id     uuid references public.customers (id) on delete set null,
  user_id         uuid references public.profiles (id) on delete set null,
  subtotal        numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount      numeric(14,2) not null default 0 check (tax_amount >= 0),
  total           numeric(14,2) not null default 0 check (total >= 0),
  paid_amount     numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_amount      numeric(14,2) not null default 0 check (due_amount >= 0),
  payment_method  public.payment_method not null default 'cash',
  status          public.tx_status not null default 'completed',
  notes           text,
  cancel_reason   text,
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint ck_sales_paid_within_total check (paid_amount <= total),
  constraint ck_sales_due_matches check (due_amount = total - paid_amount)
);

create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists sales_user_idx on public.sales (user_id);
create index if not exists sales_created_idx on public.sales (created_at desc);
create index if not exists sales_status_idx on public.sales (status);

create table if not exists public.sale_items (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references public.sales (id) on delete cascade,
  product_id     uuid not null references public.products (id),
  quantity       numeric(14,3) not null check (quantity > 0),
  unit_price     numeric(14,2) not null check (unit_price >= 0),
  cost_price     numeric(14,4) not null default 0 check (cost_price >= 0),  -- avg cost snapshot for COGS
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount     numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total     numeric(14,2) not null check (line_total >= 0),
  created_at     timestamptz not null default now(),
  constraint uq_sale_product unique (sale_id, product_id)
);

create index if not exists sale_items_product_idx on public.sale_items (product_id);

-- =============================================================
--  PURCHASES
-- =============================================================
create table if not exists public.purchases (
  id                 uuid primary key default gen_random_uuid(),
  purchase_number    text not null unique,
  supplier_invoice_no text,
  supplier_id        uuid not null references public.suppliers (id),
  user_id            uuid references public.profiles (id) on delete set null,
  subtotal           numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount    numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount         numeric(14,2) not null default 0 check (tax_amount >= 0),
  total              numeric(14,2) not null default 0 check (total >= 0),
  paid_amount        numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_amount         numeric(14,2) not null default 0 check (due_amount >= 0),
  payment_method     public.payment_method not null default 'credit',
  status             public.tx_status not null default 'completed',
  notes              text,
  cancel_reason      text,
  cancelled_at       timestamptz,
  cancelled_by       uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint ck_purchases_paid_within_total check (paid_amount <= total),
  constraint ck_purchases_due_matches check (due_amount = total - paid_amount)
);

create index if not exists purchases_supplier_idx on public.purchases (supplier_id);
create index if not exists purchases_created_idx on public.purchases (created_at desc);

create table if not exists public.purchase_items (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null references public.purchases (id) on delete cascade,
  product_id    uuid not null references public.products (id),
  quantity      numeric(14,3) not null check (quantity > 0),      -- in unit_id
  unit_id       uuid not null references public.units (id),       -- unit entered by user
  base_quantity numeric(14,3) not null check (base_quantity > 0), -- converted to product base unit
  unit_price    numeric(14,2) not null check (unit_price >= 0),   -- price per entered unit
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount    numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total    numeric(14,2) not null check (line_total >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists purchase_items_product_idx on public.purchase_items (product_id);

-- =============================================================
--  RETURNS
-- =============================================================
create table if not exists public.sales_returns (
  id            uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  sale_id       uuid not null references public.sales (id),
  customer_id   uuid references public.customers (id) on delete set null,
  user_id       uuid references public.profiles (id) on delete set null,
  reason        text,
  subtotal      numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount    numeric(14,2) not null default 0 check (tax_amount >= 0),
  total         numeric(14,2) not null default 0 check (total >= 0),
  created_at    timestamptz not null default now(),
  constraint ck_sales_returns_total check (total = subtotal + tax_amount)
);

create index if not exists sales_returns_sale_idx on public.sales_returns (sale_id);

create table if not exists public.sales_return_items (
  id                uuid primary key default gen_random_uuid(),
  sales_return_id   uuid not null references public.sales_returns (id) on delete cascade,
  product_id        uuid not null references public.products (id),
  quantity          numeric(14,3) not null check (quantity > 0),
  unit_price        numeric(14,2) not null check (unit_price >= 0),
  line_total        numeric(14,2) not null check (line_total >= 0),
  created_at        timestamptz not null default now()
);

create table if not exists public.purchase_returns (
  id            uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  purchase_id   uuid not null references public.purchases (id),
  supplier_id   uuid not null references public.suppliers (id),
  user_id       uuid references public.profiles (id) on delete set null,
  reason        text,
  total         numeric(14,2) not null default 0 check (total >= 0),
  created_at    timestamptz not null default now()
);

create table if not exists public.purchase_return_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_return_id uuid not null references public.purchase_returns (id) on delete cascade,
  product_id         uuid not null references public.products (id),
  quantity           numeric(14,3) not null check (quantity > 0),
  unit_price         numeric(14,2) not null check (unit_price >= 0),
  line_total         numeric(14,2) not null check (line_total >= 0),
  created_at         timestamptz not null default now()
);

-- =============================================================
--  PAYMENTS (money received from customers / paid to suppliers)
-- =============================================================
create table if not exists public.customer_payments (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  sale_id     uuid references public.sales (id) on delete set null,
  amount      numeric(14,2) not null check (amount > 0),
  method      public.payment_method not null default 'cash',
  reference   text,
  notes       text,
  user_id     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists customer_payments_customer_idx
  on public.customer_payments (customer_id, created_at desc);

create table if not exists public.supplier_payments (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  purchase_id uuid references public.purchases (id) on delete set null,
  amount      numeric(14,2) not null check (amount > 0),
  method      public.payment_method not null default 'cash',
  reference   text,
  notes       text,
  user_id     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists supplier_payments_supplier_idx
  on public.supplier_payments (supplier_id, created_at desc);

-- =============================================================
--  EXPENSES
-- =============================================================
create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists expense_categories_name_key
  on public.expense_categories (lower(name));

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.expense_categories (id),
  amount       numeric(14,2) not null check (amount > 0),
  spent_on     date not null default (now() at time zone 'Asia/Kathmandu')::date,
  method       public.payment_method not null default 'cash',
  description  text,
  receipt_url  text,
  user_id      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (spent_on desc);
create index if not exists expenses_category_idx on public.expenses (category_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- =============================================================
--  STOCK MOVEMENTS  (every stock change leaves a trace)
-- =============================================================
create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id),
  quantity_change  numeric(14,3) not null,
  previous_stock   numeric(14,3) not null,
  new_stock        numeric(14,3) not null,
  movement_type    public.movement_type not null,
  reason           text,
  user_id          uuid references public.profiles (id) on delete set null,
  reference_type   text,      -- 'sale' | 'purchase' | 'sales_return' | 'purchase_return' | ...
  reference_id     uuid,
  created_at      timestamptz not null default now(),
  constraint ck_stock_movement_consistent
    check (new_stock = previous_stock + quantity_change)
);

create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_created_idx
  on public.stock_movements (created_at desc);
create index if not exists stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id);

create table if not exists public.stock_adjustments (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id),
  movement_id  uuid not null references public.stock_movements (id),
  reason       text not null,
  user_id      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists stock_adjustments_product_idx
  on public.stock_adjustments (product_id, created_at desc);

-- =============================================================
--  HELD (PAUSED) SALES
-- =============================================================
create table if not exists public.held_sales (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  customer_id uuid references public.customers (id) on delete set null,
  items       jsonb not null,
  user_id     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger held_sales_set_updated_at
  before update on public.held_sales
  for each row execute function public.set_updated_at();

-- =============================================================
--  AUDIT LOG
-- =============================================================
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_user_idx on public.audit_logs (user_id);

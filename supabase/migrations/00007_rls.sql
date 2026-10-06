-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00007 : Row Level Security
--  Every table is locked down; the database enforces roles,
--  not just the interface.
-- =============================================================

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.brands              enable row level security;
alter table public.units               enable row level security;
alter table public.suppliers           enable row level security;
alter table public.customers           enable row level security;
alter table public.products            enable row level security;
alter table public.unit_conversions    enable row level security;
alter table public.shop_settings       enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_items          enable row level security;
alter table public.purchases           enable row level security;
alter table public.purchase_items      enable row level security;
alter table public.sales_returns       enable row level security;
alter table public.sales_return_items  enable row level security;
alter table public.purchase_returns    enable row level security;
alter table public.purchase_return_items enable row level security;
alter table public.customer_payments   enable row level security;
alter table public.supplier_payments   enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.expenses            enable row level security;
alter table public.stock_movements     enable row level security;
alter table public.stock_adjustments   enable row level security;
alter table public.held_sales          enable row level security;
alter table public.audit_logs          enable row level security;

-- ---------- PROFILES ----------
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own_or_manage" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_permission('users.manage'))
  with check (id = auth.uid() or public.has_permission('users.manage'));

-- ---------- REFERENCE DATA ----------
create policy "categories_select" on public.categories
  for select to authenticated using (public.has_permission('products.view'));

create policy "categories_write" on public.categories
  for insert to authenticated with check (public.has_permission('products.write'));

create policy "categories_update" on public.categories
  for update to authenticated
  using (public.has_permission('products.write'))
  with check (public.has_permission('products.write'));

create policy "categories_delete" on public.categories
  for delete to authenticated using (public.has_permission('products.write'));

create policy "brands_select" on public.brands
  for select to authenticated using (public.has_permission('products.view'));

create policy "brands_write" on public.brands
  for insert to authenticated with check (public.has_permission('products.write'));

create policy "brands_update" on public.brands
  for update to authenticated
  using (public.has_permission('products.write'))
  with check (public.has_permission('products.write'));

create policy "brands_delete" on public.brands
  for delete to authenticated using (public.has_permission('products.write'));

create policy "units_select" on public.units
  for select to authenticated using (public.has_permission('products.view'));

create policy "units_write" on public.units
  for insert to authenticated with check (public.has_permission('products.write'));

create policy "units_update" on public.units
  for update to authenticated
  using (public.has_permission('products.write'))
  with check (public.has_permission('products.write'));

create policy "units_delete" on public.units
  for delete to authenticated using (public.has_permission('products.write'));

create policy "unit_conversions_select" on public.unit_conversions
  for select to authenticated using (public.has_permission('products.view'));

create policy "unit_conversions_insert" on public.unit_conversions
  for insert to authenticated with check (public.has_permission('products.write'));

create policy "unit_conversions_update" on public.unit_conversions
  for update to authenticated
  using (public.has_permission('products.write'))
  with check (public.has_permission('products.write'));

create policy "unit_conversions_delete" on public.unit_conversions
  for delete to authenticated using (public.has_permission('products.write'));

-- ---------- SUPPLIERS ----------
create policy "suppliers_select" on public.suppliers
  for select to authenticated using (public.has_permission('suppliers.view'));

create policy "suppliers_insert" on public.suppliers
  for insert to authenticated with check (public.has_permission('suppliers.write'));

create policy "suppliers_update" on public.suppliers
  for update to authenticated
  using (public.has_permission('suppliers.write'))
  with check (public.has_permission('suppliers.write'));

-- soft delete only: deactivate from the interface, never remove history
create policy "suppliers_delete" on public.suppliers
  for delete to authenticated using (false);

-- ---------- CUSTOMERS ----------
create policy "customers_select" on public.customers
  for select to authenticated using (public.has_permission('customers.view'));

create policy "customers_insert" on public.customers
  for insert to authenticated with check (public.has_permission('customers.write'));

create policy "customers_update" on public.customers
  for update to authenticated
  using (public.has_permission('customers.write'))
  with check (public.has_permission('customers.write'));

create policy "customers_delete" on public.customers
  for delete to authenticated using (false);

-- ---------- PRODUCTS ----------
create policy "products_select" on public.products
  for select to authenticated using (public.has_permission('products.view'));

create policy "products_insert" on public.products
  for insert to authenticated with check (public.has_permission('products.write'));

create policy "products_update" on public.products
  for update to authenticated
  using (public.has_permission('products.write'))
  with check (public.has_permission('products.write'));

create policy "products_delete" on public.products
  for delete to authenticated using (false);

-- ---------- SHOP SETTINGS ----------
create policy "shop_settings_select" on public.shop_settings
  for select to authenticated using (true);

create policy "shop_settings_update" on public.shop_settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ---------- PERMISSIONS (read-only in the app) ----------
create policy "permissions_select" on public.permissions
  for select to authenticated using (true);

create policy "role_permissions_select" on public.role_permissions
  for select to authenticated using (true);

-- ---------- SALES (read-only for clients; writes only via RPC) ----------
create policy "sales_select" on public.sales
  for select to authenticated using (public.has_permission('sales.view'));

create policy "sale_items_select" on public.sale_items
  for select to authenticated using (public.has_permission('sales.view'));

-- ---------- PURCHASES (read-only for clients; writes only via RPC) ----------
create policy "purchases_select" on public.purchases
  for select to authenticated using (public.has_permission('purchases.view'));

create policy "purchase_items_select" on public.purchase_items
  for select to authenticated using (public.has_permission('purchases.view'));

-- ---------- RETURNS ----------
create policy "sales_returns_select" on public.sales_returns
  for select to authenticated
  using (public.has_permission('sales.view') or public.has_permission('returns.process'));

create policy "sales_return_items_select" on public.sales_return_items
  for select to authenticated
  using (public.has_permission('sales.view') or public.has_permission('returns.process'));

create policy "purchase_returns_select" on public.purchase_returns
  for select to authenticated
  using (public.has_permission('purchases.view') or public.has_permission('returns.process'));

create policy "purchase_return_items_select" on public.purchase_return_items
  for select to authenticated
  using (public.has_permission('purchases.view') or public.has_permission('returns.process'));

-- ---------- PAYMENTS (read-only for clients; writes only via RPC) ----------
create policy "customer_payments_select" on public.customer_payments
  for select to authenticated using (public.has_permission('customers.view'));

create policy "supplier_payments_select" on public.supplier_payments
  for select to authenticated using (public.has_permission('suppliers.view'));

-- ---------- EXPENSES ----------
create policy "expense_categories_select" on public.expense_categories
  for select to authenticated using (public.has_permission('expenses.view'));

create policy "expense_categories_write" on public.expense_categories
  for insert to authenticated with check (public.has_permission('expenses.write'));

create policy "expenses_select" on public.expenses
  for select to authenticated using (public.has_permission('expenses.view'));

create policy "expenses_insert" on public.expenses
  for insert to authenticated with check (public.has_permission('expenses.write'));

create policy "expenses_update" on public.expenses
  for update to authenticated
  using (public.has_permission('expenses.write'))
  with check (public.has_permission('expenses.write'));

create policy "expenses_delete" on public.expenses
  for delete to authenticated using (public.has_permission('expenses.write'));

-- ---------- STOCK (read-only for clients; writes only via RPC) ----------
create policy "stock_movements_select" on public.stock_movements
  for select to authenticated using (public.has_permission('products.view'));

create policy "stock_adjustments_select" on public.stock_adjustments
  for select to authenticated using (public.has_permission('stock.adjust'));

-- ---------- HELD SALES (own rows only) ----------
create policy "held_sales_select" on public.held_sales
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('sales.cancel'));

create policy "held_sales_insert" on public.held_sales
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission('sales.create'));

create policy "held_sales_update" on public.held_sales
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "held_sales_delete" on public.held_sales
  for delete to authenticated using (user_id = auth.uid());

-- ---------- AUDIT LOG ----------
create policy "audit_logs_select" on public.audit_logs
  for select to authenticated using (public.has_permission('audit.view'));

create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated with check (user_id = auth.uid());

-- No update/delete policies anywhere on audit_logs: history is never edited.

-- =============================================================
--  COLUMN / TABLE PRIVILEGES (defense in depth)
--  Even with RLS, clients simply cannot write columns that only
--  the database functions are allowed to change.
-- =============================================================

-- Stock and average cost only change through the DB functions:
-- clients may create/edit products, but can never write those two columns.
revoke insert, update, delete on table public.products from anon, authenticated;
grant insert (name, sku, barcode, category_id, brand_id, unit_id, supplier_id,
              purchase_price, selling_price, wholesale_price, min_stock,
              rack, tax_rate, image_url, description, is_active)
  on table public.products to authenticated;
grant update (name, sku, barcode, category_id, brand_id, unit_id, supplier_id,
              purchase_price, selling_price, wholesale_price, min_stock,
              rack, tax_rate, image_url, description, is_active)
  on table public.products to authenticated;
-- (no delete grant: products are deactivated, never removed)

-- Balances only change through the DB functions
revoke insert, update, delete on table public.customers from anon, authenticated;
grant insert (name, phone, address, email, credit_limit, notes)
  on table public.customers to authenticated;
grant update (name, phone, address, email, credit_limit, notes, is_active)
  on table public.customers to authenticated;

revoke insert, update, delete on table public.suppliers from anon, authenticated;
grant insert (name, company, phone, address, email, pan_vat, notes)
  on table public.suppliers to authenticated;
grant update (name, company, phone, address, email, pan_vat, notes, is_active)
  on table public.suppliers to authenticated;

-- money/stock transactions only happen through the DB functions
revoke insert, update, delete on table public.sales from anon, authenticated;
revoke insert, update, delete on table public.sale_items from anon, authenticated;
revoke insert, update, delete on table public.purchases from anon, authenticated;
revoke insert, update, delete on table public.purchase_items from anon, authenticated;
revoke insert, update, delete on table public.sales_returns from anon, authenticated;
revoke insert, update, delete on table public.sales_return_items from anon, authenticated;
revoke insert, update, delete on table public.purchase_returns from anon, authenticated;
revoke insert, update, delete on table public.purchase_return_items from anon, authenticated;
revoke insert, update, delete on table public.customer_payments from anon, authenticated;
revoke insert, update, delete on table public.supplier_payments from anon, authenticated;
revoke insert, update, delete on table public.stock_movements from anon, authenticated;
revoke insert, update, delete on table public.stock_adjustments from anon, authenticated;

-- audit history is append-only
revoke update, delete on table public.audit_logs from anon, authenticated;

-- profiles: users can edit their own name/phone only;
-- role changes go through public.update_user()
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

-- keep clients away from the permission matrix
revoke insert, update, delete on table public.permissions from anon, authenticated;
revoke insert, update, delete on table public.role_permissions from anon, authenticated;

-- sequences are only used inside the security-definer functions
revoke all on all sequences in schema public from anon, authenticated;

-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00013 : faster row level security
--
--  The security rules called has_permission() / auth.uid() once
--  for EVERY row a query looked at.  Listing 20 products out of
--  20,000 ran the permission check 20,000 times (~270 ms).
--  Wrapping the call in (select …) lets Postgres run it once per
--  query and reuse the answer.  Same rules, same results.
--  (Supabase's recommended pattern for RLS performance.)
-- =============================================================

alter policy accounts_select on public.accounts
  using ((select public.has_permission('accounting.view')));
alter policy audit_logs_insert on public.audit_logs
  with check ((user_id = (select auth.uid())));
alter policy audit_logs_select on public.audit_logs
  using ((select public.has_permission('audit.view')));
alter policy brands_delete on public.brands
  using ((select public.has_permission('products.write')));
alter policy brands_select on public.brands
  using ((select public.has_permission('products.view')));
alter policy brands_update on public.brands
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));
alter policy brands_write on public.brands
  with check ((select public.has_permission('products.write')));
alter policy categories_delete on public.categories
  using ((select public.has_permission('products.write')));
alter policy categories_select on public.categories
  using ((select public.has_permission('products.view')));
alter policy categories_update on public.categories
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));
alter policy categories_write on public.categories
  with check ((select public.has_permission('products.write')));
alter policy customer_payments_select on public.customer_payments
  using ((select public.has_permission('customers.view')));
alter policy customers_insert on public.customers
  with check ((select public.has_permission('customers.write')));
alter policy customers_select on public.customers
  using ((select public.has_permission('customers.view')));
alter policy customers_update on public.customers
  using ((select public.has_permission('customers.write')))
  with check ((select public.has_permission('customers.write')));
alter policy expense_categories_select on public.expense_categories
  using ((select public.has_permission('expenses.view')));
alter policy expense_categories_write on public.expense_categories
  with check ((select public.has_permission('expenses.write')));
alter policy expenses_delete on public.expenses
  using ((select public.has_permission('expenses.write')));
alter policy expenses_insert on public.expenses
  with check ((select public.has_permission('expenses.write')));
alter policy expenses_select on public.expenses
  using ((select public.has_permission('expenses.view')));
alter policy expenses_update on public.expenses
  using ((select public.has_permission('expenses.write')))
  with check ((select public.has_permission('expenses.write')));
alter policy held_sales_delete on public.held_sales
  using ((user_id = (select auth.uid())));
alter policy held_sales_insert on public.held_sales
  with check (((user_id = (select auth.uid())) AND (select public.has_permission('sales.create'))));
alter policy held_sales_select on public.held_sales
  using (((user_id = (select auth.uid())) OR (select public.has_permission('sales.cancel'))));
alter policy held_sales_update on public.held_sales
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy journal_entries_select on public.journal_entries
  using ((select public.has_permission('accounting.view')));
alter policy journal_lines_select on public.journal_lines
  using ((select public.has_permission('accounting.view')));
alter policy products_insert on public.products
  with check ((select public.has_permission('products.write')));
alter policy products_select on public.products
  using ((select public.has_permission('products.view')));
alter policy products_update on public.products
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));
alter policy profiles_update_own_or_manage on public.profiles
  using (((id = (select auth.uid())) OR (select public.has_permission('users.manage'))))
  with check (((id = (select auth.uid())) OR (select public.has_permission('users.manage'))));
alter policy purchase_items_select on public.purchase_items
  using ((select public.has_permission('purchases.view')));
alter policy purchase_return_items_select on public.purchase_return_items
  using (((select public.has_permission('purchases.view')) OR (select public.has_permission('returns.process'))));
alter policy purchase_returns_select on public.purchase_returns
  using (((select public.has_permission('purchases.view')) OR (select public.has_permission('returns.process'))));
alter policy purchases_select on public.purchases
  using ((select public.has_permission('purchases.view')));
alter policy sale_items_select on public.sale_items
  using ((select public.has_permission('sales.view')));
alter policy sales_select on public.sales
  using ((select public.has_permission('sales.view')));
alter policy sales_return_items_select on public.sales_return_items
  using (((select public.has_permission('sales.view')) OR (select public.has_permission('returns.process'))));
alter policy sales_returns_select on public.sales_returns
  using (((select public.has_permission('sales.view')) OR (select public.has_permission('returns.process'))));
alter policy shop_settings_update on public.shop_settings
  using ((select public.has_permission('settings.manage')))
  with check ((select public.has_permission('settings.manage')));
alter policy stock_adjustments_select on public.stock_adjustments
  using ((select public.has_permission('stock.adjust')));
alter policy stock_movements_select on public.stock_movements
  using ((select public.has_permission('products.view')));
alter policy supplier_payments_select on public.supplier_payments
  using ((select public.has_permission('suppliers.view')));
alter policy suppliers_insert on public.suppliers
  with check ((select public.has_permission('suppliers.write')));
alter policy suppliers_select on public.suppliers
  using ((select public.has_permission('suppliers.view')));
alter policy suppliers_update on public.suppliers
  using ((select public.has_permission('suppliers.write')))
  with check ((select public.has_permission('suppliers.write')));
alter policy unit_conversions_delete on public.unit_conversions
  using ((select public.has_permission('products.write')));
alter policy unit_conversions_insert on public.unit_conversions
  with check ((select public.has_permission('products.write')));
alter policy unit_conversions_select on public.unit_conversions
  using ((select public.has_permission('products.view')));
alter policy unit_conversions_update on public.unit_conversions
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));
alter policy units_delete on public.units
  using ((select public.has_permission('products.write')));
alter policy units_select on public.units
  using ((select public.has_permission('products.view')));
alter policy units_update on public.units
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));
alter policy units_write on public.units
  with check ((select public.has_permission('products.write')));

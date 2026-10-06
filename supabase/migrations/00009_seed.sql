-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00009 : seed reference data
--  (units, permissions + role matrix, expense categories,
--   default product categories)
-- =============================================================

-- ---------- UNITS ----------
insert into public.units (name, allow_decimal) values
  ('Piece',  false),
  ('Box',    false),
  ('Packet', false),
  ('Kg',     true),
  ('Gram',   true),
  ('Meter',  true),
  ('Liter',  true),
  ('Set',    false),
  ('Bag',    false),
  ('Roll',   false),
  ('Dozen',  false)
on conflict (lower(name)) do nothing;

-- ---------- PERMISSIONS ----------
insert into public.permissions (code, description) values
  ('dashboard.view',    'See the dashboard'),
  ('sales.view',        'See sales and invoices'),
  ('sales.create',      'Record new sales'),
  ('sales.cancel',      'Cancel a sale'),
  ('products.view',     'See products'),
  ('products.write',    'Add or edit products'),
  ('stock.adjust',      'Adjust stock with a reason'),
  ('purchases.view',    'See purchases'),
  ('purchases.write',   'Add or edit purchases'),
  ('purchases.cancel',  'Cancel a purchase'),
  ('returns.process',   'Process returns'),
  ('customers.view',    'See customers'),
  ('customers.write',   'Add or edit customers'),
  ('suppliers.view',    'See suppliers'),
  ('suppliers.write',   'Add or edit suppliers'),
  ('payments.record',   'Record payments'),
  ('expenses.view',     'See expenses'),
  ('expenses.write',    'Add or edit expenses'),
  ('reports.view',      'See reports and profits'),
  ('data.export',       'Export data to CSV'),
  ('settings.manage',   'Change shop settings'),
  ('users.manage',      'Manage users and roles'),
  ('audit.view',        'See the audit log')
on conflict (code) do nothing;

-- ---------- ROLE MATRIX ----------
insert into public.role_permissions (role, permission_code)
select 'owner', code from public.permissions
on conflict do nothing;

insert into public.role_permissions (role, permission_code) values
  -- Manager: runs the shop floor (no settings/users/audit/expenses)
  ('manager',    'dashboard.view'),
  ('manager',    'sales.view'),
  ('manager',    'sales.create'),
  ('manager',    'sales.cancel'),
  ('manager',    'products.view'),
  ('manager',    'products.write'),
  ('manager',    'stock.adjust'),
  ('manager',    'purchases.view'),
  ('manager',    'purchases.write'),
  ('manager',    'purchases.cancel'),
  ('manager',    'returns.process'),
  ('manager',    'customers.view'),
  ('manager',    'customers.write'),
  ('manager',    'suppliers.view'),
  ('manager',    'suppliers.write'),
  ('manager',    'payments.record'),
  ('manager',    'reports.view'),
  ('manager',    'data.export'),

  -- Cashier: counter sales only
  ('cashier',    'dashboard.view'),
  ('cashier',    'sales.view'),
  ('cashier',    'sales.create'),
  ('cashier',    'products.view'),
  ('cashier',    'customers.view'),
  ('cashier',    'customers.write'),
  ('cashier',    'payments.record'),

  -- Inventory staff: stock and purchasing
  ('inventory',  'dashboard.view'),
  ('inventory',  'products.view'),
  ('inventory',  'products.write'),
  ('inventory',  'stock.adjust'),
  ('inventory',  'purchases.view'),
  ('inventory',  'purchases.write'),
  ('inventory',  'returns.process'),
  ('inventory',  'suppliers.view')
on conflict do nothing;

-- ---------- EXPENSE CATEGORIES ----------
insert into public.expense_categories (name) values
  ('Rent'),
  ('Electricity'),
  ('Internet'),
  ('Salary'),
  ('Transportation'),
  ('Maintenance'),
  ('Office'),
  ('Miscellaneous')
on conflict (lower(name)) do nothing;

-- ---------- DEFAULT PRODUCT CATEGORIES ----------
insert into public.categories (name) values
  ('Electrical'),
  ('Plumbing'),
  ('Hardware'),
  ('Tools'),
  ('Paint'),
  ('Fasteners'),
  ('Construction Materials'),
  ('Safety Equipment')
on conflict (lower(name)) do nothing;

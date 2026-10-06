-- =============================================================
--  Inovexa Labs — Hardware Shop POS : SQL TEST SUITE
--  Runs against a local database that already has the
--  migrations + demo seed applied (see scripts/db/run.sh).
--  psql stops with a non-zero exit on the first failed assert.
-- =============================================================

-- -------------------------------------------------------------
--  Helpers
-- -------------------------------------------------------------
create or replace function public.t_assert(p_ok boolean, p_msg text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'TEST FAILED: %', p_msg;
  end if;
end $$;

create or replace function public.t_expect_error(p_sql text, p_expect text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'TEST FAILED: expected error containing "%" but query succeeded: %',
    p_expect, p_sql;
exception when others then
  if sqlerrm like 'TEST FAILED%' then
    raise;
  end if;
  if position(lower(p_expect) in lower(sqlerrm)) = 0 then
    raise exception 'TEST FAILED: expected error containing "%", got: %', p_expect, sqlerrm;
  end if;
end $$;

-- -------------------------------------------------------------
--  SETUP : test users (profiles are created by the trigger)
-- -------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local',    '{"full_name":"Test Owner"}'),
  ('22222222-2222-4222-8222-222222222222', 'manager@test.local',  '{"full_name":"Test Manager"}'),
  ('33333333-3333-4333-8333-333333333333', 'cashier@test.local',  '{"full_name":"Test Cashier"}'),
  ('44444444-4444-4444-8444-444444444444', 'inactive@test.local', '{"full_name":"Test Inactive"}'),
  ('55555555-5555-4555-8555-555555555555', 'inventory@test.local','{"full_name":"Test Inventory"}')
on conflict (id) do nothing;

update public.profiles set role = 'owner'   where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set role = 'manager' where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set role = 'cashier' where id = '33333333-3333-4333-8333-333333333333';
update public.profiles set role = 'owner', is_active = false
  where id = '44444444-4444-4444-8444-444444444444';
update public.profiles set role = 'inventory'
  where id = '55555555-5555-4555-8555-555555555555';

-- -------------------------------------------------------------
--  SETUP : test parties + products
-- -------------------------------------------------------------
insert into public.customers (name, phone, credit_limit)
values ('Test Credit Customer', '9800000001', 10000),
       ('Test Walk Customer',   '9800000002', 0);

insert into public.suppliers (name, company, phone)
values ('Test Supplier Person', 'Test Supplier Co.', '01-9999999');

insert into public.products
  (name, sku, barcode, category_id, unit_id, purchase_price, selling_price,
   wholesale_price, stock, min_stock, tax_rate, created_at)
select v.name, v.sku, v.barcode,
       (select id from public.categories where name = 'Tools'),
       (select id from public.units where name = v.unit),
       v.pp::numeric, v.sp::numeric, v.wp::numeric,
       v.stock::numeric, v.min::numeric, 13, now() - interval '10 days'
from (values
  ('Test Hammer', 'TEST-001', 'TESTBAR-001', 'Piece', '100', '150', '130', '10', '2'),
  ('Test Pipe',   'TEST-002', 'TESTBAR-002', 'Piece', '50',  '80',  '70',  '0',  '1'),
  ('Test Screw',  'TEST-003', 'TESTBAR-003', 'Piece', '1',   '2',   '1.8', '500','100'),
  ('Test Wire',   'TEST-004', 'TESTBAR-004', 'Meter', '10',  '15',  '13',  '90.5','10')
) as v(name, sku, barcode, unit, pp, sp, wp, stock, min)
where not exists (select 1 from public.products where sku = v.sku);

insert into public.stock_movements
  (product_id, quantity_change, previous_stock, new_stock, movement_type, reason, created_at)
select p.id, p.stock, 0, p.stock, 'initial', 'Opening stock', now() - interval '10 days'
from public.products p
where p.sku like 'TEST-00%' and p.stock > 0
  and not exists (select 1 from public.stock_movements sm where sm.product_id = p.id);

update public.products set avg_cost = purchase_price
 where sku like 'TEST-00%' and stock > 0 and avg_cost = 0;

-- 1 Box = 100 Piece conversion for the screw
insert into public.unit_conversions (product_id, from_unit_id, to_unit_id, factor)
select p.id,
       (select id from public.units where name = 'Box'),
       p.unit_id, 100
from public.products p
where p.sku = 'TEST-003'
on conflict do nothing;

-- =============================================================
--  PHASE : OWNER (full access)
-- =============================================================
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('role', 'authenticated', false);

select t_assert(public.dashboard_summary() ? 'inventory', 'owner sees the dashboard');
select t_assert((public.dashboard_summary() -> 'today' ->> 'customer_due') is not null,
                'owner sees money figures on the dashboard');
select t_assert(public.report_sales_totals((current_date - 30)::date, current_date::date) ? 'net_profit',
                'owner can run reports');
select t_assert(public.first_run() = false, 'first run is over once an owner exists');

-- duplicate SKU / barcode rejected
select t_expect_error(
  $q$insert into public.products (name, sku, unit_id, purchase_price, selling_price)
     select 'Copy', 'test-001', unit_id, 100, 150 from public.products where sku = 'TEST-001' $q$,
  'products_sku_key');
select t_expect_error(
  $q$insert into public.products (name, sku, barcode, unit_id, purchase_price, selling_price)
     select 'Copy2', 'TEST-099', barcode, unit_id, 100, 150
     from public.products where sku = 'TEST-001' $q$,
  'products_barcode_key');

-- stock column cannot be written by any client
select t_expect_error(
  $q$insert into public.products (name, sku, unit_id, purchase_price, selling_price, stock)
     values ('Hacker', 'TEST-098', (select id from public.units where name = 'Piece'), 1, 2, 9999) $q$,
  'permission denied for table products');

-- even the owner cannot bypass the sale function with a direct insert
select t_expect_error(
  $q$insert into public.sales (invoice_number, total) values ('HACK-1', 100) $q$,
  'permission denied for table sales');

-- normal product creation works and starts at zero stock
insert into public.products (name, sku, unit_id, purchase_price, selling_price, min_stock)
select 'Test New Product', 'TEST-010',
       (select id from public.units where name = 'Piece'), 40, 60, 5;

select t_assert((select stock from public.products where sku = 'TEST-010') = 0,
                'new product starts with zero stock');

select public.adjust_stock(
  p_product_id => (select id from public.products where sku = 'TEST-010'),
  p_new_stock => 25, p_movement_type => 'initial');

select t_assert(
  (select stock from public.products where sku = 'TEST-010') = 25
  and (select avg_cost from public.products where sku = 'TEST-010') = 40,
  'initial stock set + valued at purchase price');

-- ---------- SALES ----------
select public.create_sale(
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-001'),
                       'quantity', 2, 'unit_price', 150)),
  p_paid => 339, p_payment_method => 'cash') as r \gset

select :'r'::jsonb->>'sale_id' as sid1, :'r'::jsonb->>'invoice_number' as inv1 \gset

select t_assert((select stock from public.products where sku = 'TEST-001') = 8,
                'sale reduced hammer stock from 10 to 8');
select t_assert(:'inv1' like 'INV-%', 'invoice number generated');
select t_assert(
  (select count(*) from public.stock_movements
    where reference_id = :'sid1'::uuid) = 1,
  'stock movement recorded for the sale');
select t_assert(
  (select due_amount from public.sales where id = :'sid1'::uuid) = 0
  and (select paid_amount from public.sales where id = :'sid1'::uuid) = 339,
  'cash sale: paid 339 = 300 + 39 VAT, due 0');

-- sale edge cases
select t_expect_error($q$select public.create_sale(p_items => '[]'::jsonb)$q$, 'cart is empty');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'quantity', 100, 'unit_price', 150))) $q$, 'in stock');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-002'),
         'quantity', 1, 'unit_price', 80))) $q$, 'in stock');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'quantity', 0, 'unit_price', 150))) $q$, 'more than zero');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'quantity', 1, 'unit_price', 150)), p_paid => 9999) $q$, 'more than the total');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', '00000000-0000-4000-8000-000000000000',
         'quantity', 1, 'unit_price', 10))) $q$, 'not found');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'quantity', 1, 'unit_price', 150)), p_payment_method => 'bitcoin') $q$,
  'valid payment method');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'quantity', 1, 'unit_price', 150)), p_paid => 0,
       p_payment_method => 'credit') $q$, 'choose a customer');

-- credit sale builds a customer due
select public.create_sale(
  p_customer_id => (select id from public.customers where name = 'Test Credit Customer'),
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-001'),
                       'quantity', 1, 'unit_price', 150)),
  p_paid => 0, p_payment_method => 'credit') as r2 \gset

select :'r2'::jsonb->>'sale_id' as sid2 \gset

select t_assert((select stock from public.products where sku = 'TEST-001') = 7,
                'credit sale reduced hammer stock to 7');
select t_assert((:'r2'::jsonb->>'due')::numeric = 169.50,
                'credit sale due = 150 + 13% VAT = 169.50');
select t_assert(
  (select balance_due from public.customers where name = 'Test Credit Customer') = 169.50,
  'customer balance increased by the due amount');

-- decimal quantities (metres)
select public.create_sale(
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-004'),
                       'quantity', 2.5, 'unit_price', 15)),
  p_paid => 42.38, p_payment_method => 'cash');

select t_assert((select stock from public.products where sku = 'TEST-004') = 88,
                'decimal sale: 90.5m - 2.5m = 88m');

-- ---------- PAYMENTS ----------
select t_expect_error(
  $q$select public.record_customer_payment(
       (select id from public.customers where name = 'Test Credit Customer'), 0) $q$,
  'greater than zero');

select t_expect_error(
  'select public.record_customer_payment((select id from public.customers where name = ''Test Credit Customer''), 500, ''cash'', null, ''' || :'sid2' || '''::uuid)',
  'more than the due amount');

select public.record_customer_payment(
  p_customer_id => (select id from public.customers where name = 'Test Credit Customer'),
  p_amount => 50, p_method => 'cash', p_sale_id => :'sid2'::uuid);

select t_assert(
  (select due_amount from public.sales where id = :'sid2'::uuid) = 119.50,
  'partial payment: invoice due 169.50 - 50 = 119.50');
select t_assert(
  (select balance_due from public.customers where name = 'Test Credit Customer') = 119.50,
  'customer balance follows the payment');

-- ---------- CANCEL SALE ----------
select public.cancel_sale(:'sid1'::uuid, 'Customer changed mind');

select t_assert(
  (select status from public.sales where id = :'sid1'::uuid) = 'cancelled',
  'sale cancelled (history kept, not deleted)');
select t_assert((select stock from public.products where sku = 'TEST-001') = 9,
                'cancelled sale put 2 hammers back (7 + 2 = 9)');

select t_expect_error(
  'select public.cancel_sale(''' || :'sid1' || ''', ''again'')', 'already cancelled');

select t_expect_error(
  'select public.create_sales_return(''' || :'sid1' || ''', jsonb_build_array(jsonb_build_object(''product_id'', (select id from public.products where sku = ''TEST-001''), ''quantity'', 1)))',
  'was cancelled');

select t_expect_error(
  'select public.cancel_sale(''' || :'sid1' || ''', ''  '')', 'write a reason');

-- ---------- PURCHASES (unit conversion + moving average) ----------
select public.create_purchase(
  p_supplier_id => (select id from public.suppliers where name = 'Test Supplier Person'),
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-003'),
                       'unit_id', (select id from public.units where name = 'Box'),
                       'quantity', 5, 'unit_price', 90)),
  p_paid => 0, p_payment_method => 'credit') as r6 \gset

select :'r6'::jsonb->>'purchase_id' as pid1 \gset

select t_assert((select stock from public.products where sku = 'TEST-003') = 1000,
                '5 boxes x 100 pieces: 500 + 500 = 1000 pieces');
select t_assert((select avg_cost from public.products where sku = 'TEST-003') = 0.95,
                'moving average: (500x1 + 500x0.90) / 1000 = 0.95');
select t_assert(
  (select balance_payable from public.suppliers where name = 'Test Supplier Person') = 450,
  'unpaid purchase increased what we owe the supplier');

select t_expect_error(
  $q$select public.create_purchase(
       p_supplier_id => (select id from public.suppliers where name = 'Test Supplier Person'),
       p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-003'),
         'unit_id', (select id from public.units where name = 'Box'),
         'quantity', 10, 'unit_price', 90)),
       p_paid => 99999) $q$, 'more than the total');

select t_expect_error(
  $q$select public.create_purchase(
       p_supplier_id => (select id from public.suppliers where name = 'Test Supplier Person'),
       p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'unit_id', (select id from public.units where name = 'Box'),
         'quantity', 1, 'unit_price', 900))) $q$, 'Unit conversion is missing');

select t_expect_error(
  $q$select public.create_purchase(
       p_supplier_id => null,
       p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-001'),
         'unit_id', (select id from public.units where name = 'Piece'),
         'quantity', 1, 'unit_price', 100))) $q$, 'choose a supplier');

-- ---------- SALES RETURN ----------
select public.create_sale(
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-003'),
                       'quantity', 3, 'unit_price', 2)),
  p_paid => 6.78, p_payment_method => 'cash') as r7 \gset

select :'r7'::jsonb->>'sale_id' as sid3 \gset

select t_assert((select stock from public.products where sku = 'TEST-003') = 997,
                'screw sale 1000 - 3 = 997');

select t_expect_error(
  'select public.create_sales_return(''' || :'sid3' || ''', jsonb_build_array(jsonb_build_object(''product_id'', (select id from public.products where sku = ''TEST-003''), ''quantity'', 4)))',
  'only return up to');

select public.create_sales_return(
  p_sale_id => :'sid3'::uuid,
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-003'),
                       'quantity', 1)),
  p_reason => 'Wrong size') as r8 \gset

select t_assert((select stock from public.products where sku = 'TEST-003') = 998,
                'return put 1 screw back: 997 + 1 = 998');

-- return of the credit sale settles the invoice
select public.create_sales_return(
  p_sale_id => :'sid2'::uuid,
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-001'),
                       'quantity', 1)),
  p_reason => 'Bought by mistake');

select t_assert(
  (select due_amount from public.sales where id = :'sid2'::uuid) = 0
  and (select paid_amount from public.sales where id = :'sid2'::uuid) = 169.50,
  'full return settled the invoice (due 0)');
select t_assert(
  (select balance_due from public.customers where name = 'Test Credit Customer') = -50,
  'return credits the customer: 119.50 - 169.50 = advance of 50');
select t_assert((select stock from public.products where sku = 'TEST-001') = 10,
                'return put the hammer back: 9 + 1 = 10');

select t_expect_error(
  'select public.record_customer_payment((select id from public.customers where name = ''Test Credit Customer''), 10, ''cash'', null, ''' || :'sid2' || '''::uuid)',
  'already fully paid');

-- ---------- PURCHASE RETURN ----------
select public.create_purchase_return(
  p_purchase_id => :'pid1'::uuid,
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-003'),
                       'quantity', 200)),
  p_reason => 'Bad batch') as r9 \gset

select t_assert((select stock from public.products where sku = 'TEST-003') = 798,
                'purchase return took 200 screws out: 998 - 200 = 798');
select t_assert(
  (select balance_payable from public.suppliers where name = 'Test Supplier Person') = 270,
  'supplier owes us less after the return: 450 - 180 = 270');
select t_assert(
  (select stock from public.products where sku = 'TEST-003')
  = (select sum(quantity_change) from public.stock_movements sm
       join public.products p on p.id = sm.product_id
      where p.sku = 'TEST-003'),
  'screw stock matches the movement history');

-- ---------- STOCK ADJUSTMENTS ----------
select t_expect_error(
  $q$select public.adjust_stock(
       (select id from public.products where sku = 'TEST-001'), 9, 'adjustment') $q$,
  'write a reason');

select t_expect_error(
  $q$select public.adjust_stock(
       (select id from public.products where sku = 'TEST-001'), -5, 'damage', 'broken') $q$,
  'less than zero');

select t_expect_error(
  $q$select public.adjust_stock(
       (select id from public.products where sku = 'TEST-001'), 10, 'damage', 'broken') $q$,
  'Nothing to change');

select public.adjust_stock(
  (select id from public.products where sku = 'TEST-001'), 9, 'damage',
  '3 hammers damaged in the rack');

select t_assert((select stock from public.products where sku = 'TEST-001') = 9,
                'damage adjustment applied');
select t_assert(
  (select count(*) from public.stock_adjustments sa
     join public.products p on p.id = sa.product_id
    where p.sku = 'TEST-001') = 1,
  'adjustment recorded with its reason');

-- ---------- STATEMENT / USERS / SETTINGS / EXPENSES ----------
select t_assert(
  (select count(*) from public.report_customer_statement(
     (select id from public.customers where name = 'Test Credit Customer'),
     (current_date - 30)::date, current_date::date)) > 0,
  'customer statement lists sales, payments and returns');

-- a customer who pays part at the counter only owes the rest
select public.create_sale(
  p_customer_id => (select id from public.customers where name = 'Test Credit Customer'),
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-003'),
                       'quantity', 10, 'unit_price', 5, 'discount', 0)),
  p_discount => 0, p_paid => 30, p_payment_method => 'cash') as r_stmt \gset

select t_assert(
  (select initial_paid from public.sales where id = (:'r_stmt'::jsonb->>'sale_id')::uuid) = 30,
  'counter payment is remembered on the invoice');

select t_assert(
  (select s.balance
     from public.report_customer_statement(
       (select id from public.customers where name = 'Test Credit Customer'),
       '2000-01-01'::date, (current_date + 1)::date) with ordinality as s(entry_date, description, debit, credit, balance, n)
    order by s.n desc limit 1)
  = (select balance_due from public.customers where name = 'Test Credit Customer'),
  'customer statement ends on the customer balance (counter payments counted)');

select t_assert(
  (select count(*) from public.report_customer_statement(
     (select id from public.customers where name = 'Test Credit Customer'),
     (current_date + 1)::date, (current_date + 1)::date)) = 1
  and (select balance from public.report_customer_statement(
     (select id from public.customers where name = 'Test Credit Customer'),
     (current_date + 1)::date, (current_date + 1)::date))
  = (select balance_due from public.customers where name = 'Test Credit Customer'),
  'opening balance carries everything before the period');

-- cancelling clears what was still due, and the statement shows it
select public.cancel_sale((:'r_stmt'::jsonb->>'sale_id')::uuid, 'Statement test');
select t_assert(
  (select balance_due from public.customers where name = 'Test Credit Customer') = -50,
  'cancelled invoice no longer owed');
select t_assert(
  (select s.balance
     from public.report_customer_statement(
       (select id from public.customers where name = 'Test Credit Customer'),
       '2000-01-01'::date, (current_date + 1)::date) with ordinality as s(entry_date, description, debit, credit, balance, n)
    order by s.n desc limit 1) = -50,
  'customer statement still ends on the balance after a cancellation');

select t_assert(
  (select s.balance
     from public.report_supplier_statement(
       (select id from public.suppliers where name = 'Test Supplier Person'),
       '2000-01-01'::date, (current_date + 1)::date) with ordinality as s(entry_date, description, debit, credit, balance, n)
    order by s.n desc limit 1)
  = (select balance_payable from public.suppliers where name = 'Test Supplier Person'),
  'supplier statement ends on the supplier balance');

select public.update_user('33333333-3333-4333-8333-333333333333', 'manager');
select t_assert(
  (select role from public.profiles where id = '33333333-3333-4333-8333-333333333333') = 'manager',
  'owner can change a user role');
select public.update_user('33333333-3333-4333-8333-333333333333', 'cashier');
select t_assert(
  (select role from public.profiles where id = '33333333-3333-4333-8333-333333333333') = 'cashier',
  'role changed back');

select t_expect_error(
  $q$select public.update_user('11111111-1111-4111-8111-111111111111', 'cashier') $q$,
  'your own role');

update public.shop_settings
   set invoice_footer = 'TEST FOOTER — thank you'
 where invoice_footer <> 'TEST FOOTER — thank you';
select t_assert(
  (select invoice_footer from public.shop_settings) = 'TEST FOOTER — thank you',
  'owner can update shop settings');
update public.shop_settings
   set invoice_footer = 'Thank you for shopping with us! — Powered by Inovexa Labs';

insert into public.expenses (category_id, amount, spent_on, method, description)
select id, 250, current_date, 'cash', 'Test expense entry'
from public.expense_categories where name = 'Miscellaneous';
select t_assert(
  (select count(*) from public.expenses where description = 'Test expense entry') = 1,
  'owner can record an expense');

insert into public.held_sales (title, items, user_id)
values ('Hold test',
        jsonb_build_array(jsonb_build_object('product_id',
          (select id from public.products where sku = 'TEST-001'),
          'quantity', 1, 'unit_price', 150)),
        '11111111-1111-4111-8111-111111111111');
select t_assert(
  (select count(*) from public.held_sales where title = 'Hold test') = 1,
  'owner can hold a sale');

-- deactivated products can be replaced by a new one with the same SKU
update public.products set is_active = false where sku = 'TEST-002';
insert into public.products (name, sku, unit_id, purchase_price, selling_price)
select 'Test Pipe (new)', 'TEST-002',
       (select id from public.units where name = 'Piece'), 50, 80;
select t_assert(
  (select count(*) from public.products where sku = 'TEST-002') = 2,
  'inactive product frees its SKU for reuse');
update public.products set is_active = false where sku = 'TEST-002' and name = 'Test Pipe (new)';

-- =============================================================
--  PHASE : CASHIER (counter access only)
-- =============================================================
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);

select t_assert(
  (select count(*) from public.products where is_active) > 0,
  'cashier can search products for the POS');
select t_assert(
  (select count(*) from public.categories) > 0,
  'cashier can see categories');

select t_expect_error(
  $q$insert into public.products (name, sku, unit_id, purchase_price, selling_price)
     values ('Cashier Product', 'TEST-020',
             (select id from public.units where name = 'Piece'), 10, 20) $q$,
  'row-level security');

select t_expect_error(
  $q$update public.products set stock = 999 where sku = 'TEST-001' $q$,
  'permission denied for table products');

update public.products set name = 'Renamed by cashier' where sku = 'TEST-001';
select t_assert(
  (select name from public.products where sku = 'TEST-001') = 'Test Hammer',
  'cashier cannot rename products (0 rows updated)');

select t_expect_error(
  $q$insert into public.sales (invoice_number, total) values ('HACK-2', 100) $q$,
  'permission denied for table sales');

select t_expect_error(
  $q$delete from public.products where sku = 'TEST-010' $q$,
  'permission denied for table products');

select t_expect_error(
  $q$insert into public.categories (name) values ('Hacked') $q$,
  'row-level security');-- cashier CAN sell (the POS works)
select public.create_sale(
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-004'),
                       'quantity', 0.5, 'unit_price', 15)),
  p_paid => 8.48, p_payment_method => 'cash') as r10 \gset

select :'r10'::jsonb->>'sale_id' as sid4 \gset

select t_assert((select stock from public.products where sku = 'TEST-004') = 87.5,
                'cashier sale: 88 - 0.5 = 87.5');
select t_assert(
  (select count(*) from public.audit_logs) = 0,
  'cashier cannot read the audit log');
select t_assert(
  (select count(*) from public.expenses) = 0,
  'cashier cannot see expenses');
select t_expect_error(
  $q$insert into public.expenses (category_id, amount, description)
     values ('00000000-0000-4000-8000-000000000099', 10, 'nope') $q$,
  'row-level security');

select t_expect_error(
  $q$select public.report_sales_totals(current_date - 1, current_date) $q$,
  'permission');

select t_assert((public.dashboard_summary() -> 'today' ->> 'customer_due') is null,
                'cashier dashboard hides money owed');
select t_assert(public.dashboard_summary() ? 'inventory',
                'cashier dashboard still shows stock');

select t_expect_error(
  $q$select public.cancel_sale((select id from public.sales order by created_at desc limit 1), 'x') $q$,
  'permission');
select t_expect_error(
  $q$select public.adjust_stock((select id from public.products where sku = 'TEST-001'), 1, 'damage', 'x') $q$,
  'permission');
select t_expect_error(
  $q$select public.create_sales_return((select id from public.sales order by created_at desc limit 1),
       jsonb_build_array()) $q$,
  'permission');

update public.profiles set full_name = 'Test Cashier Renamed'
 where id = '33333333-3333-4333-8333-333333333333';
select t_assert(
  (select full_name from public.profiles
    where id = '33333333-3333-4333-8333-333333333333') = 'Test Cashier Renamed',
  'cashier can edit their own display name');
update public.profiles set full_name = 'Test Cashier'
 where id = '33333333-3333-4333-8333-333333333333';

select t_expect_error(
  $q$update public.profiles set role = 'owner'
     where id = '33333333-3333-4333-8333-333333333333' $q$,
  'permission denied for table profiles');

update public.profiles set full_name = 'Hacked'
  where id = '22222222-2222-4222-8222-222222222222';
select t_assert(
  (select full_name from public.profiles
    where id = '22222222-2222-4222-8222-222222222222') = 'Test Manager',
  'cashier cannot edit another user (0 rows updated)');

select t_expect_error(
  $q$insert into public.held_sales (title, items, user_id)
     values ('Bad hold', '[]'::jsonb, '22222222-2222-4222-8222-222222222222') $q$,
  'row-level security');

-- cashier CAN record a customer payment (counter khata)
select public.record_customer_payment(
  p_customer_id => (select id from public.customers where name = 'Test Walk Customer'),
  p_amount => 100, p_method => 'cash');
select t_assert(
  (select balance_due from public.customers where name = 'Test Walk Customer') = -100,
  'cashier can record a payment');

-- =============================================================
--  PHASE : MANAGER
-- =============================================================
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);

insert into public.products (name, sku, unit_id, purchase_price, selling_price)
select 'Manager Product', 'TEST-011',
       (select id from public.units where name = 'Piece'), 30, 45;
select t_assert(
  (select count(*) from public.products where sku = 'TEST-011') = 1,
  'manager can add products');

select public.cancel_sale(:'sid4'::uuid, 'Customer cancelled at counter');
select t_assert((select stock from public.products where sku = 'TEST-004') = 88,
                'manager cancelled the cashier sale: 87.5 + 0.5 = 88');

select t_assert(
  public.report_sales_totals((current_date - 30)::date, current_date::date) ? 'gross_profit',
  'manager can run reports');
select t_assert((select count(*) from public.expenses) = 0,
                'manager cannot see expenses (owner only)');
update public.shop_settings set invoice_prefix = 'X';
select t_assert(
  (select invoice_prefix from public.shop_settings) = 'INV',
  'manager cannot change shop settings (0 rows updated)');
select t_expect_error(
  $q$select public.update_user('33333333-3333-4333-8333-333333333333', 'manager') $q$,
  'permission');
select t_assert((select count(*) from public.audit_logs) = 0,
                'manager cannot read the audit log');

-- =============================================================
--  PHASE : INVENTORY STAFF
-- =============================================================
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);

select public.create_purchase(
  p_supplier_id => (select id from public.suppliers where name = 'Test Supplier Person'),
  p_items => jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'TEST-003'),
                       'unit_id', (select id from public.units where name = 'Piece'),
                       'quantity', 100, 'unit_price', 1.10)),
  p_paid => 110, p_payment_method => 'cash');

select t_assert((select stock from public.products where sku = 'TEST-003') = 898,
                'inventory restock: 798 + 100 = 898');
select t_assert((select avg_cost from public.products where sku = 'TEST-003') = 0.9667,
                'moving average updated: (798x0.95 + 110) / 898 = 0.9667');

select public.adjust_stock(
  (select id from public.products where sku = 'TEST-001'), 12, 'adjustment',
  '2 pieces found back in the rack');
select t_assert((select stock from public.products where sku = 'TEST-001') = 12,
                'inventory staff can adjust stock');

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-003'),
         'quantity', 1, 'unit_price', 2))) $q$,
  'permission');

select t_expect_error(
  $q$insert into public.purchases (purchase_number, supplier_id, total)
     select 'HACK-P', id, 100 from public.suppliers limit 1 $q$,
  'permission denied for table purchases');

select t_assert((select count(*) from public.sales) = 0,
                'inventory staff cannot see sales');
select t_assert((select count(*) from public.suppliers) > 0,
                'inventory staff can see suppliers');
update public.products set rack = 'Z9' where sku = 'TEST-003';
select t_assert((select rack from public.products where sku = 'TEST-003') = 'Z9',
                'inventory staff can edit product details');

-- =============================================================
--  PHASE : DEACTIVATED USER
-- =============================================================
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);

select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-003'),
         'quantity', 1, 'unit_price', 2))) $q$,
  'permission');
select t_assert((select count(*) from public.products) = 0,
                'deactivated user sees nothing');
select t_expect_error($q$select public.dashboard_summary() $q$, 'permission');

-- =============================================================
--  PHASE : ANON (not signed in)
-- =============================================================
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('role', 'anon', false);

select t_assert((select count(*) from public.products) = 0,
                'anonymous visitors see no products');
select t_expect_error($q$select public.dashboard_summary() $q$, 'permission');
select t_expect_error(
  $q$select public.create_sale(p_items => jsonb_build_array(jsonb_build_object(
         'product_id', (select id from public.products where sku = 'TEST-003'),
         'quantity', 1, 'unit_price', 2))) $q$,
  'permission');

-- =============================================================
--  FINAL : database-level integrity (as superuser)
-- =============================================================
select set_config('role', 'postgres', false);
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- every product's stock equals the sum of its movements
select t_assert(
  (select count(*) from public.products p
    where p.stock is distinct from
      (select coalesce(sum(sm.quantity_change), 0)
         from public.stock_movements sm where sm.product_id = p.id)) = 0,
  'stock always matches the movement history');

-- hard constraints still hold even for a superuser
select t_expect_error(
  $q$insert into public.sales (invoice_number, total, paid_amount, due_amount)
     values ('INV-BOGUS', 100, 200, 0) $q$, 'ck_sales');

select t_expect_error(
  $q$insert into public.sales (invoice_number, total, due_amount)
     select (select invoice_number from public.sales limit 1), 100, 100 $q$,
  'invoice_number');

select t_expect_error(
  $q$insert into public.sale_items (sale_id, product_id, quantity, unit_price, line_total)
     select (select id from public.sales limit 1),
            (select id from public.products limit 1), 0, 10, 0 $q$,
  'sale_items_quantity_check');

select t_expect_error(
  $q$insert into public.customer_payments (customer_id, amount)
     select id, 0 from public.customers limit 1 $q$,
  'customer_payments_amount_check');

-- audit trail was written along the way
select t_assert(
  (select count(*) from public.audit_logs where entity = 'sale') >= 4,
  'sale actions are in the audit log');
select t_assert(
  (select count(*) from public.audit_logs where entity = 'stock_adjusted') >= 3,
  'stock adjustments are in the audit log');
select t_assert(
  (select count(*) from public.audit_logs where entity = 'settings') >= 1,
  'settings changes are in the audit log');

-- invoice numbers are sequential and unique
select t_assert(
  (select count(distinct invoice_number) from public.sales)
  = (select count(*) from public.sales),
  'invoice numbers are unique');

select t_assert(
  (select count(*) from public.products where is_active) >= 34,
  'demo seed products are present');

select t_assert(
  (select count(*) from public.customers where name = 'Test Credit Customer'
     and balance_due = -50) = 1,
  'final customer balance is correct after sale + payment + return');

select t_assert(
  (select balance_payable from public.suppliers where name = 'Test Supplier Person') = 270,
  'final supplier balance is correct after purchase + return + payment');

drop function public.t_assert(boolean, text);
drop function public.t_expect_error(text, text);

select 'ALL TESTS PASSED' as result;

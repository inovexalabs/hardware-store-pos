-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Demo seed data — a realistic Nepali hardware shop.
--  Run AFTER the migrations. Works both ways:
--    * Supabase dashboard -> SQL Editor: paste the whole file, Run
--    * psql / `supabase db reset`
--  Plain SQL only (no psql meta-commands), so the SQL editor accepts it.
--  Safe to re-run: existing products, suppliers and customers are
--  kept, and the sample transactions are only added once.
-- =============================================================

-- ---------- SHOP ----------
update public.shop_settings
   set shop_name = 'Shree Ganesh Hardware Store',
       address = 'Ward No. 5, Balaju, Kathmandu',
       phone = '01-4351122',
       email = 'info@shreeganeshhardware.com',
       pan_vat = '603456789',
       invoice_prefix = 'INV',
       purchase_prefix = 'PUR',
       receipt_size = '80mm',
       tax_enabled = true,
       tax_rate = 13,
       invoice_footer = 'Thank you for shopping with us! — Powered by Inovexa Labs'
 where id = true;

-- ---------- BRANDS ----------
insert into public.brands (name) values
  ('Anchor'), ('Havells'), ('Finolex'), ('Supreme'), ('Ashirvad'),
  ('Bosch'), ('Stanley'), ('Berger'), ('Asian Paints'), ('Dore')
on conflict (lower(name)) do nothing;

-- ---------- SUPPLIERS ----------
insert into public.suppliers (name, company, phone, address, email, pan_vat, notes)
select v.name, v.company, v.phone, v.address, v.email, v.pan_vat, v.notes
from (values
  ('Krishna Shrestha', 'Krishna Electricals Pvt. Ltd.', '01-4234567',
   'New Road, Kathmandu', 'sales@krishnaelectricals.com', '601234567',
   'Main electrical goods supplier'),
  ('Bikram Agarwal', 'Shree Balaji Plumbing Store', '01-5551234',
   'Pulchowk, Lalitpur', null, '602345678', 'Pipes and fittings'),
  ('Mingmar Tamang', 'Himal Tool House', '01-4223344',
   'Ason, Kathmandu', null, '603456789', 'Hand tools and fasteners'),
  ('Sunita KC', 'Valley Cement & Steel Suppliers', '01-4356789',
   'Kalanki, Kathmandu', null, '604567890', 'Cement, sand and steel')
) as v(name, company, phone, address, email, pan_vat, notes)
where not exists (select 1 from public.suppliers s where lower(s.name) = lower(v.name));

-- ---------- CUSTOMERS ----------
insert into public.customers (name, phone, address, credit_limit, notes)
select v.name, v.phone, v.address, v.credit_limit::numeric, v.notes
from (values
  ('Ram Bahadur Thapa', '9841234567', 'Baneshwor, Kathmandu', 50000,
   'Pays at month end'),
  ('Sita General Store', '9851123456', 'Balaju, Kathmandu', 100000, null),
  ('Nabin Construction Pvt. Ltd.', '01-4351122', 'Kalanki, Kathmandu', 200000,
   'Bulk orders'),
  ('Bikash Electronics', '9803344556', 'Chabahil, Kathmandu', 30000, null),
  ('Gita Hardware & Sanitary', '9847766555', 'Kirtipur, Kathmandu', 50000, null)
) as v(name, phone, address, credit_limit, notes)
where not exists (select 1 from public.customers c where lower(c.name) = lower(v.name));

-- ---------- PRODUCTS ----------
insert into public.products
  (name, sku, barcode, category_id, brand_id, unit_id,
   purchase_price, selling_price, wholesale_price, stock, min_stock,
   rack, tax_rate, created_at)
select v.name, v.sku, v.barcode,
       (select id from public.categories  where name = v.category),
       (select id from public.brands      where name = v.brand),
       (select id from public.units       where lower(name) = lower(v.unit)),
       v.pp::numeric, v.sp::numeric, v.wp::numeric,
       v.stock::numeric, v.min::numeric, v.rack, v.tax::numeric,
       now() - interval '30 days'
from (values
  -- ELECTRICAL
  ('Anchor One Way Switch 10A',        'ELE-001', '8901234500011', 'Electrical', 'Anchor',      'Piece', '55',   '85',   '75',   '120', '20', 'A1', '13'),
  ('Anchor One Way Switch 16A',        'ELE-002', '8901234500028', 'Electrical', 'Anchor',      'Piece', '85',   '130',  '115',  '60',  '15', 'A1', '13'),
  ('3 Pin Socket 16A',                 'ELE-003', '8901234500035', 'Electrical', 'Anchor',      'Piece', '90',   '140',  '125',  '80',  '15', 'A1', '13'),
  ('LED Bulb 9W Cool White',           'ELE-004', '8901234500042', 'Electrical', 'Havells',     'Piece', '75',   '120',  '105',  '150', '30', 'A2', '13'),
  ('LED Bulb 12W Cool White',          'ELE-005', '8901234500059', 'Electrical', 'Havells',     'Piece', '95',   '150',  '135',  '90',  '20', 'A2', '13'),
  ('PVC Conduit Pipe 20mm',            'ELE-006', '8901234500066', 'Electrical', 'Supreme',     'Meter', '18',   '28',   '24',   '240', '50', 'A3', '13'),
  ('House Wire 1.5 sq mm (90m Roll)',  'ELE-007', '8901234500073', 'Electrical', 'Finolex',     'Roll',  '1150', '1450', '1350', '10',  '3',  'A3', '13'),
  ('House Wire 2.5 sq mm (90m Roll)',  'ELE-008', '8901234500080', 'Electrical', 'Finolex',     'Roll',  '1750', '2150', '2050', '8',   '3',  'A3', '13'),
  ('MCB 32A Single Pole',              'ELE-009', '8901234500097', 'Electrical', 'Havells',     'Piece', '180',  '260',  '240',  '40',  '10', 'A4', '13'),
  ('Ceiling Rose',                     'ELE-010', '8901234500103', 'Electrical', 'Anchor',      'Piece', '40',   '65',   '58',   '70',  '15', 'A2', '13'),
  ('Junction Box 4 inch',              'ELE-011', '8901234500110', 'Electrical', 'Supreme',     'Piece', '25',   '40',   '35',   '0',   '15', 'A3', '13'),
  -- PLUMBING
  ('Teflon Tape 1/2 inch',             'PLB-001', '8901234500202', 'Plumbing',   'Supreme',     'Piece', '10',   '18',   '15',   '200', '50', 'B1', '13'),
  ('PVC Pipe 1 inch (3m)',             'PLB-002', '8901234500219', 'Plumbing',   'Supreme',     'Piece', '180',  '245',  '225',  '60',  '15', 'B1', '13'),
  ('PVC Pipe 2 inch (3m)',             'PLB-003', '8901234500226', 'Plumbing',   'Supreme',     'Piece', '320',  '420',  '395',  '40',  '10', 'B1', '13'),
  ('PVC Elbow 1 inch',                 'PLB-004', '8901234500233', 'Plumbing',   'Supreme',     'Piece', '15',   '26',   '22',   '150', '40', 'B2', '13'),
  ('PVC Tee 1 inch',                   'PLB-005', '8901234500240', 'Plumbing',   'Supreme',     'Piece', '18',   '30',   '26',   '140', '40', 'B2', '13'),
  ('Ball Valve 3/4 inch',              'PLB-006', '8901234500257', 'Plumbing',   'Ashirvad',    'Piece', '160',  '230',  '210',  '35',  '10', 'B2', '13'),
  ('CPVC Pipe 3/4 inch (3m)',          'PLB-007', '8901234500264', 'Plumbing',   'Ashirvad',    'Piece', '260',  '350',  '330',  '20',  '8',  'B3', '13'),
  ('PVC Pipe Adhesive 100ml',          'PLB-008', '8901234500271', 'Plumbing',   'Supreme',     'Piece', '90',   '140',  '125',  '45',  '10', 'B1', '13'),
  -- FASTENERS
  ('Self Drilling Screw 1 inch',       'FST-001', '8901234500301', 'Fasteners',  null,          'Piece', '1.50', '3.00', '2.50', '1250','200','C1', '13'),
  ('Wire Nail 2 inch (1kg Packet)',    'FST-002', '8901234500318', 'Fasteners',  null,          'Packet','130',  '175',  '160',  '80',  '20', 'C1', '13'),
  ('Wood Screw 2 inch (50 pcs)',       'FST-003', '8901234500325', 'Fasteners',  null,          'Piece', '1.20', '2.20', '1.90', '1800','300','C1', '13'),
  ('GI Wire 1.2mm (Bundle)',           'FST-004', '8901234500332', 'Hardware',   null,          'Roll',  '380',  '480',  '450',  '25',  '8',  'C2', '13'),
  -- TOOLS
  ('Claw Hammer 500g',                 'TLS-001', '8901234500400', 'Tools',      'Stanley',     'Piece', '420',  '550',  '510',  '25',  '5',  'D1', '13'),
  ('Screwdriver Set (6 pieces)',       'TLS-002', '8901234500417', 'Tools',      'Bosch',       'Set',   '350',  '500',  '460',  '20',  '5',  'D1', '13'),
  ('Twist Drill Bit 8mm',              'TLS-003', '8901234500424', 'Tools',      'Bosch',       'Piece', '65',   '110',  '95',   '60',  '15', 'D2', '13'),
  ('Twist Drill Bit 10mm',             'TLS-004', '8901234500431', 'Tools',      'Bosch',       'Piece', '80',   '130',  '115',  '3',   '10', 'D2', '13'),
  ('Measuring Tape 5m',                'TLS-005', '8901234500448', 'Tools',      'Stanley',     'Piece', '180',  '260',  '240',  '30',  '8',  'D1', '13'),
  -- CONSTRUCTION MATERIALS
  ('Cement OPC 50kg Bag',              'CON-001', '8901234500509', 'Construction Materials', null, 'Bag','720', '800', '780', '40', '10', 'E1', '13'),
  -- PAINT
  ('Emulsion Paint White 1 Litre',     'PNT-001', '8901234500608', 'Paint',      'Berger',      'Liter', '450',  '590',  '550',  '24',  '6',  'F1', '13'),
  ('Paint Brush 3 inch',               'PNT-002', '8901234500615', 'Paint',      null,          'Piece', '55',   '90',   '80',   '50',  '15', 'F2', '13'),
  ('Paint Roller 9 inch',              'PNT-003', '8901234500622', 'Paint',      null,          'Piece', '120',  '180',  '165',  '30',  '8',  'F2', '13'),
  -- SAFETY EQUIPMENT
  ('Safety Helmet White',              'SAF-001', '8901234500707', 'Safety Equipment', null,    'Piece', '450',  '650',  '600',  '15',  '5',  'G1', '13'),
  ('Safety Hand Gloves',               'SAF-002', '8901234500714', 'Safety Equipment', null,    'Set',   '120',  '190',  '170',  '25',  '5',  'G1', '13')
) as v(name, sku, barcode, category, brand, unit, pp, sp, wp, stock, min, rack, tax)
where not exists (select 1 from public.products where sku = v.sku);

-- opening stock movements (audit trail for the seeded stock)
insert into public.stock_movements
  (product_id, quantity_change, previous_stock, new_stock, movement_type, reason, created_at)
select p.id, p.stock, 0, p.stock, 'initial', 'Opening stock',
       now() - interval '30 days'
from public.products p
where p.stock > 0
  and not exists (select 1 from public.stock_movements sm where sm.product_id = p.id);

-- opening stock is valued at the purchase price
update public.products
   set avg_cost = purchase_price
 where avg_cost = 0 and stock > 0 and purchase_price > 0;

-- ---------- UNIT CONVERSIONS (1 Box = 100 pieces etc.) ----------
insert into public.unit_conversions (product_id, from_unit_id, to_unit_id, factor)
select p.id,
       (select id from public.units where name = 'Box'),
       p.unit_id,
       100
from public.products p
where p.sku = 'FST-001'
  and p.unit_id <> (select id from public.units where name = 'Box')
on conflict do nothing;

insert into public.unit_conversions (product_id, from_unit_id, to_unit_id, factor)
select p.id,
       (select id from public.units where name = 'Box'),
       p.unit_id,
       20
from public.products p
where p.sku = 'ELE-004'
  and p.unit_id <> (select id from public.units where name = 'Box')
on conflict do nothing;

insert into public.unit_conversions (product_id, from_unit_id, to_unit_id, factor)
select p.id,
       (select id from public.units where name = 'Packet'),
       p.unit_id,
       50
from public.products p
where p.sku = 'FST-003'
  and p.unit_id <> (select id from public.units where name = 'Packet')
on conflict do nothing;

-- =============================================================
--  SAMPLE TRANSACTIONS
--  The database functions do the work so stock, balances,
--  movements and audit entries stay perfectly consistent.
-- =============================================================

-- =============================================================
--  Everything below runs inside one block so it can keep results in
--  a variable. It is skipped if the shop already has sales.
-- =============================================================
do $seed$
declare
  r jsonb;
begin
  if exists (select 1 from public.sales) then
    raise notice 'Sample transactions skipped: this shop already has sales.';
    return;
  end if;

  -- ---------- PURCHASES ----------
  r := public.create_purchase(
    p_supplier_id => (select id from public.suppliers where company = 'Krishna Electricals Pvt. Ltd.'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-001'), 'unit_id', (select id from public.units where name='Piece'), 'quantity', 50, 'unit_price', 55),
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-004'), 'unit_id', (select id from public.units where name='Box'),      'quantity', 5,  'unit_price', 1400),
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-008'), 'unit_id', (select id from public.units where name='Roll'),     'quantity', 4,  'unit_price', 1750)
    ),
    p_supplier_invoice_no => 'KE-2201',
    p_discount => 500,
    p_tax => 0,
    p_paid => 15000,
    p_payment_method => 'bank',
    p_notes => 'Monthly electrical stock'
  );

  update public.purchases set created_at = now() - interval '25 days'
   where purchase_number = (r->>'purchase_number');
  update public.stock_movements set created_at = now() - interval '25 days'
   where reference_type = 'purchase' and reference_id = (r->>'purchase_id')::uuid;
  update public.purchase_items set created_at = now() - interval '25 days'
   where purchase_id = (r->>'purchase_id')::uuid;
  update public.audit_logs set created_at = now() - interval '25 days'
   where entity = 'purchase' and entity_id = (r->>'purchase_id');

  r := public.create_purchase(
    p_supplier_id => (select id from public.suppliers where company = 'Shree Balaji Plumbing Store'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='PLB-002'), 'unit_id', (select id from public.units where name='Piece'), 'quantity', 30, 'unit_price', 180),
      jsonb_build_object('product_id', (select id from public.products where sku='PLB-004'), 'unit_id', (select id from public.units where name='Piece'), 'quantity', 100, 'unit_price', 15),
      jsonb_build_object('product_id', (select id from public.products where sku='PLB-001'), 'unit_id', (select id from public.units where name='Piece'), 'quantity', 100, 'unit_price', 10)
    ),
    p_supplier_invoice_no => 'BP-1145',
    p_discount => 0,
    p_tax => 0,
    p_paid => 0,
    p_payment_method => 'credit',
    p_notes => 'Plumbing restock'
  );

  update public.purchases set created_at = now() - interval '18 days'
   where purchase_number = (r->>'purchase_number');
  update public.stock_movements set created_at = now() - interval '18 days'
   where reference_type = 'purchase' and reference_id = (r->>'purchase_id')::uuid;
  update public.purchase_items set created_at = now() - interval '18 days'
   where purchase_id = (r->>'purchase_id')::uuid;
  update public.audit_logs set created_at = now() - interval '18 days'
   where entity = 'purchase' and entity_id = (r->>'purchase_id');

  r := public.create_purchase(
    p_supplier_id => (select id from public.suppliers where company = 'Valley Cement & Steel Suppliers'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='CON-001'), 'unit_id', (select id from public.units where name='Bag'), 'quantity', 40, 'unit_price', 720)
    ),
    p_supplier_invoice_no => 'VS-889',
    p_discount => 0,
    p_tax => 0,
    p_paid => 28800,
    p_payment_method => 'cash'
  );

  update public.purchases set created_at = now() - interval '26 days'
   where purchase_number = (r->>'purchase_number');
  update public.stock_movements set created_at = now() - interval '26 days'
   where reference_type = 'purchase' and reference_id = (r->>'purchase_id')::uuid;
  update public.purchase_items set created_at = now() - interval '26 days'
   where purchase_id = (r->>'purchase_id')::uuid;
  update public.audit_logs set created_at = now() - interval '26 days'
   where entity = 'purchase' and entity_id = (r->>'purchase_id');

  -- ---------- SALES ----------
  -- (old credit sale, still unpaid → shows up as overdue)
  r := public.create_sale(
    p_customer_id => (select id from public.customers where name = 'Nabin Construction Pvt. Ltd.'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='CON-001'), 'quantity', 20, 'unit_price', 800),
      jsonb_build_object('product_id', (select id from public.products where sku='FST-004'),  'quantity', 5,  'unit_price', 480)
    ),
    p_discount => 0, p_paid => 0, p_payment_method => 'credit',
    p_notes => 'Site delivery — due at month end'
  );

  update public.sales set created_at = now() - interval '20 days'
   where invoice_number = (r->>'invoice_number');
  update public.sale_items set created_at = now() - interval '20 days'
   where sale_id = (r->>'sale_id')::uuid;
  update public.stock_movements set created_at = now() - interval '20 days'
   where reference_type = 'sale' and reference_id = (r->>'sale_id')::uuid;
  update public.audit_logs set created_at = now() - interval '20 days'
   where entity = 'sale' and entity_id = (r->>'sale_id');

  -- (credit sale with a partial payment later on)
  r := public.create_sale(
    p_customer_id => (select id from public.customers where name = 'Ram Bahadur Thapa'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-007'), 'quantity', 2, 'unit_price', 1450),
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-001'), 'quantity', 10, 'unit_price', 85),
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-010'), 'quantity', 6, 'unit_price', 65)
    ),
    p_discount => 50, p_paid => 2000, p_payment_method => 'cash'
  );

  update public.sales set created_at = now() - interval '8 days'
   where invoice_number = (r->>'invoice_number');
  update public.sale_items set created_at = now() - interval '8 days'
   where sale_id = (r->>'sale_id')::uuid;
  update public.stock_movements set created_at = now() - interval '8 days'
   where reference_type = 'sale' and reference_id = (r->>'sale_id')::uuid;
  update public.audit_logs set created_at = now() - interval '8 days'
   where entity = 'sale' and entity_id = (r->>'sale_id');

  r := public.record_customer_payment(
    p_customer_id => (select id from public.customers where name = 'Ram Bahadur Thapa'),
    p_amount => 1000, p_method => 'cash', p_notes => 'Part payment'
  );

  update public.customer_payments set created_at = now() - interval '6 days'
   where id = (r->>'payment_id')::uuid;
  update public.audit_logs set created_at = now() - interval '6 days'
   where entity = 'customer_payment' and entity_id = (r->>'payment_id');

  -- (yesterday's cash sale)
  r := public.create_sale(
    p_customer_id => null,
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='TLS-001'), 'quantity', 2, 'unit_price', 550),
      jsonb_build_object('product_id', (select id from public.products where sku='TLS-003'), 'quantity', 5, 'unit_price', 110),
      jsonb_build_object('product_id', (select id from public.products where sku='FST-002'), 'quantity', 3, 'unit_price', 175)
    ),
    p_discount => 0, p_paid => 2457.75, p_payment_method => 'cash'
  );

  update public.sales set created_at = now() - interval '1 day'
   where invoice_number = (r->>'invoice_number');
  update public.sale_items set created_at = now() - interval '1 day'
   where sale_id = (r->>'sale_id')::uuid;
  update public.stock_movements set created_at = now() - interval '1 day'
   where reference_type = 'sale' and reference_id = (r->>'sale_id')::uuid;
  update public.audit_logs set created_at = now() - interval '1 day'
   where entity = 'sale' and entity_id = (r->>'sale_id');

  -- (a sale with a return against it)
  r := public.create_sale(
    p_customer_id => (select id from public.customers where name = 'Bikash Electronics'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-005'), 'quantity', 6, 'unit_price', 150),
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-009'), 'quantity', 2, 'unit_price', 260)
    ),
    p_discount => 0, p_paid => 1420, p_payment_method => 'cash'
  );

  update public.sales set created_at = now() - interval '5 days'
   where invoice_number = (r->>'invoice_number');
  update public.sale_items set created_at = now() - interval '5 days'
   where sale_id = (r->>'sale_id')::uuid;
  update public.stock_movements set created_at = now() - interval '5 days'
   where reference_type = 'sale' and reference_id = (r->>'sale_id')::uuid;
  update public.audit_logs set created_at = now() - interval '5 days'
   where entity = 'sale' and entity_id = (r->>'sale_id');

  r := public.create_sales_return(
    p_sale_id => (select s.id from public.sales s
                  join public.customers c on c.id = s.customer_id
                  where c.name = 'Bikash Electronics'
                  order by s.created_at desc limit 1),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-005'), 'quantity', 2)
    ),
    p_reason => 'Two bulbs fused'
  );

  update public.sales_returns set created_at = now() - interval '4 days'
   where return_number = (r->>'return_number');
  update public.sales_return_items set created_at = now() - interval '4 days'
   where sales_return_id = (r->>'return_id')::uuid;
  update public.stock_movements set created_at = now() - interval '4 days'
   where reference_type = 'sales_return' and reference_id = (r->>'return_id')::uuid;
  update public.audit_logs set created_at = now() - interval '4 days'
   where entity = 'sales_return' and entity_id = (r->>'return_id');

  -- (today's sales — so the dashboard has something to show)
  r := public.create_sale(
    p_customer_id => null,
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='ELE-004'), 'quantity', 10, 'unit_price', 120),
      jsonb_build_object('product_id', (select id from public.products where sku='PLB-006'), 'quantity', 4,  'unit_price', 230)
    ),
    p_discount => 0, p_paid => 2395.60, p_payment_method => 'cash'
  );

  perform public.create_sale(
    p_customer_id => (select id from public.customers where name = 'Sita General Store'),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where sku='PNT-001'), 'quantity', 3, 'unit_price', 590),
      jsonb_build_object('product_id', (select id from public.products where sku='PNT-002'), 'quantity', 6, 'unit_price', 90),
      jsonb_build_object('product_id', (select id from public.products where sku='PNT-003'), 'quantity', 2, 'unit_price', 180)
    ),
    p_discount => 20, p_paid => 1500, p_payment_method => 'cash'
  );

  -- ---------- SUPPLIER PAYMENT ----------
  r := public.record_supplier_payment(
    p_supplier_id => (select id from public.suppliers where company = 'Shree Balaji Plumbing Store'),
    p_amount => 5000, p_method => 'cash', p_notes => 'Part payment'
  );

  update public.supplier_payments set created_at = now() - interval '12 days'
   where id = (r->>'payment_id')::uuid;
  update public.audit_logs set created_at = now() - interval '12 days'
   where entity = 'supplier_payment' and entity_id = (r->>'payment_id');

  -- ---------- STOCK ADJUSTMENT (damage demo) ----------
  r := public.adjust_stock(
    p_product_id => (select id from public.products where sku = 'PLB-008'),
    p_new_stock => (select stock - 5 from public.products where sku = 'PLB-008'),
    p_movement_type => 'damage',
    p_reason => '5 bottles damaged in the rack'
  );

  update public.stock_movements set created_at = now() - interval '7 days'
   where movement_type = 'damage'
     and product_id = (select id from public.products where sku = 'PLB-008');
  update public.stock_adjustments set created_at = now() - interval '7 days'
   where product_id = (select id from public.products where sku = 'PLB-008');
  update public.audit_logs set created_at = now() - interval '7 days'
   where entity = 'stock_adjusted';

  -- ---------- EXPENSES ----------
  insert into public.expenses (category_id, amount, spent_on, method, description, created_at)
  select c.id, v.amount::numeric, (current_date - v.ago::int)::date, v.method::public.payment_method,
         v.description, now() - (v.ago || ' days')::interval
  from (values
    ('Rent',             '15000', '6',  'cash',   'Shop rent for this month'),
    ('Electricity',      '2350',  '3',  'cash',   'NEA electricity bill'),
    ('Transportation',   '1800',  '2',  'cash',   'Delivery van fuel'),
    ('Salary',           '22000', '5',  'bank',   'Staff salary'),
    ('Internet',         '1200',  '7',  'wallet', 'Shop WiFi bill'),
    ('Maintenance',      '900',   '9',  'cash',   'Rack repair')
  ) as v(category, amount, ago, method, description)
  join public.expense_categories c on lower(c.name) = lower(v.category);
end
$seed$;

-- done — stock totals are consistent with the movement history
select count(*) as seeded_products from public.products;

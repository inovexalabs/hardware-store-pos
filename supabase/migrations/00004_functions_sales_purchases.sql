-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00004 : permissions, audit, sales & purchases logic
--  All money/stock operations are atomic (single DB transaction)
-- =============================================================

-- =============================================================
--  PERMISSION HELPERS
-- =============================================================
create or replace function public.app_role()
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.has_permission(p_code text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.role_permissions rp
    where rp.role = public.app_role()
      and rp.permission_code = p_code
  );
$$;

create or replace function public.require_permission(p_code text)
returns void
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
DECLARE
  v_claim text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
begin
  -- No JWT in context = a direct database session (migrations, seed scripts).
  -- The service key is the trusted server-side key. Everything else
  -- (anon / authenticated app users) must pass the permission check.
  if v_claim = '' or v_claim in ('postgres', 'service_role') then
    return;
  end if;
  if not public.has_permission(p_code) then
    raise exception 'You do not have permission to do this. Ask the shop owner to help.';
  end if;
end;
$$;

-- =============================================================
--  DOCUMENT NUMBER GENERATORS
-- =============================================================
create or replace function public.gen_invoice_number()
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
begin
  select invoice_prefix into v_prefix from public.shop_settings;
  return coalesce(nullif(trim(v_prefix), ''), 'INV')
         || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
end;
$$;

create or replace function public.gen_purchase_number()
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
begin
  select purchase_prefix into v_prefix from public.shop_settings;
  return coalesce(nullif(trim(v_prefix), ''), 'PUR')
         || '-' || lpad(nextval('public.purchase_number_seq')::text, 5, '0');
end;
$$;

create or replace function public.gen_return_number(p_kind text)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind = 'sales' then
    return 'SRET-' || lpad(nextval('public.sales_return_number_seq')::text, 5, '0');
  elsif p_kind = 'purchase' then
    return 'PRET-' || lpad(nextval('public.purchase_return_number_seq')::text, 5, '0');
  end if;
  raise exception 'Unknown return type.';
end;
$$;

-- =============================================================
--  GENERIC AUDIT TRIGGER
--  (records who created/updated/deleted a row and what changed)
-- =============================================================
create or replace function public.fn_audit()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_entity  text := tg_argv[0];
  v_action  text;
  v_meta    jsonb;
  v_id      text;
begin
  if tg_op = 'INSERT' then
    v_action := v_entity || '.created';
    v_meta   := jsonb_build_object('after', to_jsonb(new));
    v_id     := (to_jsonb(new) ->> 'id');
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    v_action := v_entity || '.updated';
    v_meta   := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    v_id     := (to_jsonb(new) ->> 'id');
  else
    v_action := v_entity || '.deleted';
    v_meta   := jsonb_build_object('before', to_jsonb(old));
    v_id     := (to_jsonb(old) ->> 'id');
  end if;

  insert into public.audit_logs (user_id, action, entity, entity_id, metadata)
  values (auth.uid(), v_action, v_entity, v_id, v_meta);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.attach_audit_triggers()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_products') then
    create trigger audit_products after insert or update or delete on public.products
      for each row execute function public.fn_audit('product');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_customers') then
    create trigger audit_customers after insert or update or delete on public.customers
      for each row execute function public.fn_audit('customer');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_suppliers') then
    create trigger audit_suppliers after insert or update or delete on public.suppliers
      for each row execute function public.fn_audit('supplier');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_sales') then
    create trigger audit_sales after insert or update or delete on public.sales
      for each row execute function public.fn_audit('sale');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_purchases') then
    create trigger audit_purchases after insert or update or delete on public.purchases
      for each row execute function public.fn_audit('purchase');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_expenses') then
    create trigger audit_expenses after insert or update or delete on public.expenses
      for each row execute function public.fn_audit('expense');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_profiles') then
    create trigger audit_profiles after insert or update or delete on public.profiles
      for each row execute function public.fn_audit('user');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_shop_settings') then
    create trigger audit_shop_settings after update on public.shop_settings
      for each row execute function public.fn_audit('settings');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_sales_returns') then
    create trigger audit_sales_returns after insert or update or delete on public.sales_returns
      for each row execute function public.fn_audit('sales_return');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_purchase_returns') then
    create trigger audit_purchase_returns after insert or update or delete on public.purchase_returns
      for each row execute function public.fn_audit('purchase_return');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_customer_payments') then
    create trigger audit_customer_payments after insert on public.customer_payments
      for each row execute function public.fn_audit('customer_payment');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_supplier_payments') then
    create trigger audit_supplier_payments after insert on public.supplier_payments
      for each row execute function public.fn_audit('supplier_payment');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_stock_adjustments') then
    create trigger audit_stock_adjustments after insert on public.stock_adjustments
      for each row execute function public.fn_audit('stock_adjusted');
  end if;
end;
$$;

select public.attach_audit_triggers();
drop function public.attach_audit_triggers();

-- =============================================================
--  CREATE SALE  (POS checkout — fully atomic)
--  p_items: [{"product_id": "...", "quantity": 2,
--             "unit_price": 120, "discount": 0}]
-- =============================================================
create or replace function public.create_sale(
  p_customer_id     uuid default null,
  p_items           jsonb default null,
  p_discount        numeric default 0,
  p_paid            numeric default 0,
  p_payment_method  text default 'cash',
  p_notes           text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_sale_id      uuid;
  v_invoice      text;
  v_subtotal     numeric(14,2) := 0;
  v_tax          numeric(14,2) := 0;
  v_total        numeric(14,2);
  v_paid         numeric(14,2);
  v_due          numeric(14,2);
  v_method       public.payment_method;
  v_tax_enabled  boolean;
  v_allow_neg    boolean;
  v_line_net     numeric(14,2);
  v_line_tax     numeric(14,2);
  v_rate         numeric(5,2);
  v_stock        numeric(14,3);
  v_rec          record;
  v_product      record;
begin
  perform public.require_permission('sales.create');

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty. Add at least one product before saving the sale.';
  end if;
  if p_discount is null or p_discount < 0 then
    raise exception 'Discount cannot be negative.';
  end if;
  if p_paid is null or p_paid < 0 then
    raise exception 'Paid amount cannot be negative.';
  end if;
  if p_payment_method not in ('cash','bank','wallet','credit') then
    raise exception 'Choose a valid payment method.';
  end if;

  select tax_enabled, allow_negative_stock
    into v_tax_enabled, v_allow_neg
  from public.shop_settings;

  if p_customer_id is not null then
    perform 1 from public.customers where id = p_customer_id and is_active for update;
    if not found then
      raise exception 'The selected customer was not found. Choose another customer.';
    end if;
  end if;

  -- validate + price every line (products are locked to avoid double-selling)
  for v_rec in
    select x.product_id,
           sum(x.quantity) as quantity,
           case when sum(x.quantity) > 0
                then sum(x.quantity * x.unit_price) / sum(x.quantity)
                else 0 end as unit_price,
           sum(x.discount) as discount
    from jsonb_to_recordset(p_items)
      as x(product_id uuid, quantity numeric, unit_price numeric, discount numeric)
    group by x.product_id
    order by x.product_id
  loop
    if v_rec.quantity is null or round(v_rec.quantity, 3) <= 0 then
      raise exception 'Quantity must be more than zero.';
    end if;
    if v_rec.unit_price is null or v_rec.unit_price < 0 then
      raise exception 'Price cannot be negative.';
    end if;
    if coalesce(v_rec.discount, 0) < 0 then
      raise exception 'Discount cannot be negative.';
    end if;
    if coalesce(v_rec.discount, 0) > round(v_rec.quantity * v_rec.unit_price, 2) then
      raise exception 'Line discount is more than the line total. Please check the cart.';
    end if;

    select p.id, p.name, p.stock, p.tax_rate, p.is_active, u.name as unit_name
      into v_product
    from public.products p
    join public.units u on u.id = p.unit_id
    where p.id = v_rec.product_id
    for update;

    if not found or not v_product.is_active then
      raise exception 'One of the products in the cart was not found or is no longer active. Remove it and try again.';
    end if;

    if not v_allow_neg and v_product.stock < round(v_rec.quantity, 3) then
      raise exception 'Only % % of "%" is in stock, but the sale needs %.',
        v_product.stock, v_product.unit_name, v_product.name, round(v_rec.quantity, 3);
    end if;

    v_line_net := round(v_rec.quantity * v_rec.unit_price - coalesce(v_rec.discount, 0), 2);
    v_rate     := case when v_tax_enabled then coalesce(v_product.tax_rate, 0) else 0 end;
    v_line_tax := round(v_line_net * v_rate / 100, 2);

    v_subtotal := v_subtotal + v_line_net;
    v_tax      := v_tax + v_line_tax;
  end loop;

  if p_discount > v_subtotal then
    raise exception 'Discount cannot be more than the bill total (Rs. %).', v_subtotal;
  end if;

  v_total := round(v_subtotal - p_discount + v_tax, 2);
  v_paid  := round(p_paid, 2);
  if v_paid > v_total then
    raise exception 'Paid amount (Rs. %) is more than the total (Rs. %).', v_paid, v_total;
  end if;
  v_due := round(v_total - v_paid, 2);

  if v_due > 0 and p_customer_id is null then
    raise exception 'Please choose a customer for a sale with due amount.';
  end if;

  if p_payment_method = 'credit' and v_paid > 0 and v_due = 0 then
    raise exception 'Credit sale cannot be fully paid. Enter the paid amount correctly.';
  end if;

  v_method := p_payment_method::public.payment_method;
  v_invoice := public.gen_invoice_number();

  insert into public.sales
    (invoice_number, customer_id, user_id, subtotal, discount_amount,
     tax_amount, total, paid_amount, due_amount, payment_method, notes)
  values
    (v_invoice, p_customer_id, v_uid, v_subtotal, coalesce(p_discount, 0),
     v_tax, v_total, v_paid, v_due, v_method, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_sale_id;

  -- second pass: write items, decrease stock, create movements
  for v_rec in
    select x.product_id,
           sum(x.quantity) as quantity,
           case when sum(x.quantity) > 0
                then sum(x.quantity * x.unit_price) / sum(x.quantity)
                else 0 end as unit_price,
           sum(x.discount) as discount
    from jsonb_to_recordset(p_items)
      as x(product_id uuid, quantity numeric, unit_price numeric, discount numeric)
    group by x.product_id
    order by x.product_id
  loop
    select p.id, p.name, p.stock, p.tax_rate, p.avg_cost, p.is_active, u.name as unit_name
      into v_product
    from public.products p
    join public.units u on u.id = p.unit_id
    where p.id = v_rec.product_id
    for update;

    v_line_net := round(v_rec.quantity * v_rec.unit_price - coalesce(v_rec.discount, 0), 2);
    v_rate     := case when v_tax_enabled then coalesce(v_product.tax_rate, 0) else 0 end;
    v_line_tax := round(v_line_net * v_rate / 100, 2);

    insert into public.sale_items
      (sale_id, product_id, quantity, unit_price, cost_price,
       discount_amount, tax_amount, line_total)
    values
      (v_sale_id, v_rec.product_id, round(v_rec.quantity, 3),
       round(v_rec.unit_price, 2), v_product.avg_cost,
       coalesce(v_rec.discount, 0), v_line_tax, v_line_net);

    v_stock := v_product.stock - round(v_rec.quantity, 3);

    update public.products set stock = v_stock where id = v_rec.product_id;

    insert into public.stock_movements
      (product_id, quantity_change, previous_stock, new_stock, movement_type,
       reason, user_id, reference_type, reference_id)
    values
      (v_rec.product_id, -round(v_rec.quantity, 3), v_product.stock, v_stock,
       'sale', 'Sale ' || v_invoice, v_uid, 'sale', v_sale_id);
  end loop;

  if v_due > 0 then
    update public.customers
       set balance_due = balance_due + v_due
     where id = p_customer_id;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_number', v_invoice,
    'total', v_total,
    'paid', v_paid,
    'due', v_due
  );
end;
$$;

-- =============================================================
--  CANCEL SALE (reverses stock, keeps history — never deletes)
-- =============================================================
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_sale     record;
  v_item     record;
  v_product  record;
  v_stock    numeric(14,3);
  v_reason   text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.require_permission('sales.cancel');

  if v_reason is null then
    raise exception 'Please write a reason for cancelling this sale.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'This sale was not found.';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'This sale is already cancelled.';
  end if;
  if exists (select 1 from public.sales_returns where sale_id = p_sale_id) then
    raise exception 'This sale has a return against it and cannot be cancelled. Handle it from the Returns page.';
  end if;

  for v_item in
    select si.product_id, si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    select p.id, p.stock into v_product
    from public.products p where p.id = v_item.product_id for update;

    v_stock := v_product.stock + v_item.quantity;
    update public.products set stock = v_stock where id = v_item.product_id;

    insert into public.stock_movements
      (product_id, quantity_change, previous_stock, new_stock, movement_type,
       reason, user_id, reference_type, reference_id)
    values
      (v_item.product_id, v_item.quantity, v_product.stock, v_stock, 'sale',
       'Sale ' || v_sale.invoice_number || ' cancelled', v_uid, 'sale', p_sale_id);
  end loop;

  if v_sale.customer_id is not null and v_sale.due_amount > 0 then
    update public.customers
       set balance_due = balance_due - v_sale.due_amount
     where id = v_sale.customer_id;
  end if;

  update public.sales
     set status = 'cancelled',
         cancel_reason = v_reason,
         cancelled_at = now(),
         cancelled_by = v_uid
   where id = p_sale_id;

  return jsonb_build_object('sale_id', p_sale_id, 'status', 'cancelled');
end;
$$;

-- =============================================================
--  CREATE PURCHASE  (stock increases atomically)
--  p_items: [{"product_id":"...","unit_id":"...","quantity":10,
--             "unit_price":100,"discount":0}]
-- =============================================================
create or replace function public.create_purchase(
  p_supplier_id          uuid,
  p_items                jsonb,
  p_supplier_invoice_no  text default null,
  p_discount             numeric default 0,
  p_tax                  numeric default 0,
  p_paid                 numeric default 0,
  p_payment_method       text default 'credit',
  p_notes                text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid           uuid := auth.uid();
  v_purchase_id   uuid;
  v_number        text;
  v_subtotal      numeric(14,2) := 0;
  v_total         numeric(14,2);
  v_paid          numeric(14,2);
  v_due           numeric(14,2);
  v_method        public.payment_method;
  v_discount      numeric(14,2) := coalesce(p_discount, 0);
  v_tax           numeric(14,2) := coalesce(p_tax, 0);
  v_discount_share numeric(14,4);
  v_line_cost     numeric(14,4);
  v_rec           record;
  v_product       record;
  v_factor        numeric(14,4);
  v_base_qty      numeric(14,3);
  v_new_stock     numeric(14,3);
  v_new_avg       numeric(14,4);
  v_line_total    numeric(14,2);

begin
  perform public.require_permission('purchases.write');

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'No products added. Add at least one product to this purchase.';
  end if;
  if p_supplier_id is null then
    raise exception 'Please choose a supplier for this purchase.';
  end if;
  perform 1 from public.suppliers where id = p_supplier_id and is_active for update;
  if not found then
    raise exception 'The selected supplier was not found. Choose another supplier.';
  end if;
  if v_discount < 0 or v_tax < 0 or coalesce(p_paid, 0) < 0 then
    raise exception 'Discount, tax and paid amounts cannot be negative.';
  end if;
  if p_payment_method not in ('cash','bank','wallet','credit') then
    raise exception 'Choose a valid payment method.';
  end if;

  for v_rec in
    select lines.*
    from (
      select x.product_id, x.unit_id, x.quantity, x.unit_price,
             coalesce(x.discount, 0) as discount
      from jsonb_to_recordset(p_items)
        as x(product_id uuid, unit_id uuid, quantity numeric,
             unit_price numeric, discount numeric)
    ) lines
    order by lines.product_id
  loop
    if v_rec.quantity is null or round(v_rec.quantity, 3) <= 0 then
      raise exception 'Quantity must be more than zero.';
    end if;
    if v_rec.unit_price is null or v_rec.unit_price < 0 then
      raise exception 'Purchase price cannot be negative.';
    end if;
    if coalesce(v_rec.discount, 0) < 0 then
      raise exception 'Discount cannot be negative.';
    end if;

    select p.id, p.name, p.stock, p.avg_cost, p.is_active, p.unit_id as base_unit_id
      into v_product
    from public.products p
    where p.id = v_rec.product_id
    for update;

    if not found or not v_product.is_active then
      raise exception 'One of the products in this purchase was not found or is inactive. Check the product list.';
    end if;

    -- unit conversion: 1 entered unit = v_factor base units
    if v_rec.unit_id is null or v_rec.unit_id = v_product.base_unit_id then
      v_factor := 1;
      v_base_qty := round(v_rec.quantity, 3);
    else
      select uc.factor into v_factor
      from public.unit_conversions uc
      where uc.product_id = v_product.id
        and uc.from_unit_id = v_rec.unit_id
        and uc.to_unit_id = v_product.base_unit_id;

      if not found then
        select round(1 / uc.factor, 6) into v_factor
        from public.unit_conversions uc
        where uc.product_id = v_product.id
          and uc.from_unit_id = v_product.base_unit_id
          and uc.to_unit_id = v_rec.unit_id;
      end if;

      if v_factor is null then
        raise exception 'Unit conversion is missing for "%". Open the product and tell the system how many pieces make 1 of the unit you chose.', v_product.name;
      end if;
      v_base_qty := round(v_rec.quantity * v_factor, 3);
    end if;

    v_line_total := round(v_rec.quantity * v_rec.unit_price
                          - coalesce(v_rec.discount, 0), 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Discount cannot be more than the purchase total (Rs. %).', v_subtotal;
  end if;

  v_total := round(v_subtotal - v_discount + v_tax, 2);
  v_paid  := round(coalesce(p_paid, 0), 2);
  if v_paid > v_total then
    raise exception 'Paid amount (Rs. %) is more than the total (Rs. %).', v_paid, v_total;
  end if;
  v_due := round(v_total - v_paid, 2);

  if v_subtotal > 0 then
    v_discount_share := v_discount / v_subtotal;
  else
    v_discount_share := 0;
  end if;

  v_method  := p_payment_method::public.payment_method;
  v_number  := public.gen_purchase_number();

  insert into public.purchases
    (purchase_number, supplier_invoice_no, supplier_id, user_id, subtotal,
     discount_amount, tax_amount, total, paid_amount, due_amount,
     payment_method, notes)
  values
    (v_number, nullif(trim(coalesce(p_supplier_invoice_no, '')), ''),
     p_supplier_id, v_uid, v_subtotal, v_discount, v_tax, v_total, v_paid, v_due,
     v_method, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_purchase_id;

  -- write items + increase stock + moving average cost + movements
  for v_rec in
    select lines.*
    from (
      select x.product_id, x.unit_id, x.quantity, x.unit_price,
             coalesce(x.discount, 0) as discount
      from jsonb_to_recordset(p_items)
        as x(product_id uuid, unit_id uuid, quantity numeric,
             unit_price numeric, discount numeric)
    ) lines
    order by lines.product_id
  loop
    select p.id, p.stock, p.avg_cost, p.unit_id as base_unit_id
      into v_product
    from public.products p
    where p.id = v_rec.product_id
    for update;

    if v_rec.unit_id is null or v_rec.unit_id = v_product.base_unit_id then
      v_base_qty := round(v_rec.quantity, 3);
    else
      select uc.factor into v_factor
      from public.unit_conversions uc
      where uc.product_id = v_product.id
        and uc.from_unit_id = v_rec.unit_id
        and uc.to_unit_id = v_product.base_unit_id;
      if not found then
        select round(1 / uc.factor, 6) into v_factor
        from public.unit_conversions uc
        where uc.product_id = v_product.id
          and uc.from_unit_id = v_product.base_unit_id
          and uc.to_unit_id = v_rec.unit_id;
      end if;
      v_base_qty := round(v_rec.quantity * v_factor, 3);
    end if;

    v_line_total := round(v_rec.quantity * v_rec.unit_price - v_rec.discount, 2);

    insert into public.purchase_items
      (purchase_id, product_id, quantity, unit_id, base_quantity,
       unit_price, discount_amount, line_total)
    values
      (v_purchase_id, v_rec.product_id, round(v_rec.quantity, 3), v_rec.unit_id,
       v_base_qty, round(v_rec.unit_price, 2), v_rec.discount, v_line_total);

    -- actual cost of these goods after the bill-level discount (tax excluded)
    v_line_cost := round(v_line_total * (1 - v_discount_share), 4);

    v_new_stock := v_product.stock + v_base_qty;
    if v_product.stock <= 0 then
      v_new_avg := round(v_line_cost / nullif(v_base_qty, 0), 4);
    else
      v_new_avg := round(
        (v_product.stock * v_product.avg_cost + v_line_cost)
        / nullif(v_new_stock, 0), 4);
    end if;
    if v_new_avg is null or v_new_avg < 0 then
      v_new_avg := 0;
    end if;

    update public.products
       set stock = v_new_stock,
           avg_cost = v_new_avg
     where id = v_rec.product_id;

    insert into public.stock_movements
      (product_id, quantity_change, previous_stock, new_stock, movement_type,
       reason, user_id, reference_type, reference_id)
    values
      (v_rec.product_id, v_base_qty, v_product.stock, v_new_stock, 'purchase',
       'Purchase ' || v_number, v_uid, 'purchase', v_purchase_id);
  end loop;

  update public.suppliers
     set balance_payable = balance_payable + v_due
   where id = p_supplier_id;

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'purchase_number', v_number,
    'total', v_total,
    'paid', v_paid,
    'due', v_due
  );
end;
$$;

-- =============================================================
--  CANCEL PURCHASE
-- =============================================================
create or replace function public.cancel_purchase(p_purchase_id uuid, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_purchase  record;
  v_item      record;
  v_product   record;
  v_stock     numeric(14,3);
  v_allow_neg boolean;
  v_reason    text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.require_permission('purchases.cancel');

  if v_reason is null then
    raise exception 'Please write a reason for cancelling this purchase.';
  end if;

  select allow_negative_stock into v_allow_neg from public.shop_settings;

  select * into v_purchase
  from public.purchases where id = p_purchase_id for update;

  if not found then
    raise exception 'This purchase was not found.';
  end if;
  if v_purchase.status = 'cancelled' then
    raise exception 'This purchase is already cancelled.';
  end if;
  if exists (select 1 from public.purchase_returns where purchase_id = p_purchase_id) then
    raise exception 'This purchase has a return against it and cannot be cancelled.';
  end if;

  for v_item in
    select pi.product_id, pi.base_quantity
    from public.purchase_items pi
    where pi.purchase_id = p_purchase_id
  loop
    select p.id, p.stock, p.name into v_product
    from public.products p where p.id = v_item.product_id for update;

    v_stock := v_product.stock - v_item.base_quantity;
    if not v_allow_neg and v_stock < 0 then
      raise exception 'Cannot cancel: only % of this product is left in stock (some items were already sold). Adjust the stock instead and explain in the reason.',
        v_product.stock;
    end if;

    update public.products set stock = v_stock where id = v_item.product_id;

    insert into public.stock_movements
      (product_id, quantity_change, previous_stock, new_stock, movement_type,
       reason, user_id, reference_type, reference_id)
    values
      (v_item.product_id, -v_item.base_quantity, v_product.stock, v_stock, 'purchase',
       'Purchase ' || v_purchase.purchase_number || ' cancelled',
       v_uid, 'purchase', p_purchase_id);
  end loop;

  update public.suppliers
     set balance_payable = balance_payable - v_purchase.due_amount
   where id = v_purchase.supplier_id;

  update public.purchases
     set status = 'cancelled',
         cancel_reason = v_reason,
         cancelled_at = now(),
         cancelled_by = v_uid
   where id = p_purchase_id;

  return jsonb_build_object('purchase_id', p_purchase_id, 'status', 'cancelled');
end;
$$;

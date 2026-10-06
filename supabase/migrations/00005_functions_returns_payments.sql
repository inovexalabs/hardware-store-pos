-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00005 : returns, payments, stock adjustments
-- =============================================================

-- =============================================================
--  SALES RETURN  (customer returns goods)
--  p_items: [{"product_id": "...", "quantity": 2}]
-- =============================================================
create or replace function public.create_sales_return(
  p_sale_id uuid,
  p_items   jsonb,
  p_reason  text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_sale       record;
  v_return_id  uuid;
  v_number     text;
  v_total      numeric(14,2) := 0;   -- returned goods value (no tax)
  v_tax        numeric(14,2) := 0;   -- tax portion of the refund
  v_refund     numeric(14,2);
  v_rec        record;
  v_line_qty   numeric(14,3);
  v_sold       numeric(14,3);
  v_returned   numeric(14,3);
  v_unit_price numeric(14,2);
  v_line_tax   numeric(14,2);
  v_product    record;
  v_stock      numeric(14,3);
begin
  perform public.require_permission('returns.process');

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one product to return.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'This invoice was not found.';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'This invoice was cancelled, so it cannot be returned.';
  end if;

  -- pass 1: validate quantities and compute the return total
  for v_rec in
    select lines.*
    from (
      select x.product_id, sum(x.quantity) as quantity
      from jsonb_to_recordset(p_items)
        as x(product_id uuid, quantity numeric)
      group by x.product_id
    ) lines
    order by lines.product_id
  loop
    v_line_qty := round(v_rec.quantity, 3);
    if v_line_qty is null or v_line_qty <= 0 then
      raise exception 'Return quantity must be more than zero.';
    end if;

    select si.quantity, si.unit_price, si.tax_amount
      into v_sold, v_unit_price, v_line_tax
    from public.sale_items si
    where si.sale_id = p_sale_id and si.product_id = v_rec.product_id;

    if not found then
      raise exception 'This product was not sold on invoice %.', v_sale.invoice_number;
    end if;

    select coalesce(sum(sri.quantity), 0) into v_returned
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where sr.sale_id = p_sale_id and sri.product_id = v_rec.product_id;

    if v_sold - v_returned < v_line_qty then
      raise exception 'You can only return up to % of this product from invoice %.',
        v_sold - v_returned, v_sale.invoice_number;
    end if;

    v_total := v_total + round(v_line_qty * v_unit_price, 2);
    -- refund the same tax proportion the customer actually paid
    v_tax   := v_tax + round(v_line_tax * (v_line_qty / v_sold), 2);
  end loop;

  v_refund := round(v_total + v_tax, 2);

  v_number := public.gen_return_number('sales');

  insert into public.sales_returns
    (return_number, sale_id, customer_id, user_id, reason, subtotal, tax_amount, total)
  values
    (v_number, p_sale_id, v_sale.customer_id, v_uid,
     nullif(trim(coalesce(p_reason, '')), ''), v_total, v_tax, v_refund)
  returning id into v_return_id;

  -- pass 2: put goods back in stock and record item rows
  for v_rec in
    select lines.*
    from (
      select x.product_id, sum(x.quantity) as quantity
      from jsonb_to_recordset(p_items)
        as x(product_id uuid, quantity numeric)
      group by x.product_id
    ) lines
    order by lines.product_id
  loop
    v_line_qty := round(v_rec.quantity, 3);

    select si.unit_price into v_unit_price
    from public.sale_items si
    where si.sale_id = p_sale_id and si.product_id = v_rec.product_id;

    select p.id, p.stock into v_product
    from public.products p
    where p.id = v_rec.product_id
    for update;

    v_stock := v_product.stock + v_line_qty;

    update public.products set stock = v_stock where id = v_rec.product_id;

    insert into public.stock_movements
      (product_id, quantity_change, previous_stock, new_stock, movement_type,
       reason, user_id, reference_type, reference_id)
    values
      (v_rec.product_id, v_line_qty, v_product.stock, v_stock, 'sales_return',
       'Sales return ' || v_number || ' (invoice ' || v_sale.invoice_number || ')',
       v_uid, 'sales_return', v_return_id);

    insert into public.sales_return_items
      (sales_return_id, product_id, quantity, unit_price, line_total)
    values
      (v_return_id, v_rec.product_id, v_line_qty, v_unit_price,
       round(v_line_qty * v_unit_price, 2));
  end loop;

  -- a return settles whatever was still due on that invoice
  if v_sale.due_amount > 0 then
    update public.sales
       set paid_amount = paid_amount + least(due_amount, v_refund),
           due_amount  = due_amount - least(due_amount, v_refund)
     where id = p_sale_id;
  end if;

  -- reduce what the customer owes (can become negative = customer has advance)
  if v_sale.customer_id is not null then
    update public.customers
       set balance_due = balance_due - v_refund
     where id = v_sale.customer_id;
  end if;

  return jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_number,
    'subtotal', v_total,
    'tax', v_tax,
    'total', v_refund
  );
end;
$$;

-- =============================================================
--  PURCHASE RETURN  (shop returns goods to supplier)
--  p_items: [{"product_id": "...", "quantity": 2}]  (base unit)
-- =============================================================
create or replace function public.create_purchase_return(
  p_purchase_id uuid,
  p_items       jsonb,
  p_reason      text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_purchase   record;
  v_return_id  uuid;
  v_number     text;
  v_total      numeric(14,2) := 0;
  v_rec        record;
  v_line_qty   numeric(14,3);
  v_bought     numeric(14,3);
  v_prev_ret   numeric(14,3);
  v_eff_price  numeric(14,4);
  v_product    record;
  v_stock      numeric(14,3);
  v_allow_neg  boolean;
begin
  perform public.require_permission('returns.process');

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one product to return to the supplier.';
  end if;

  select * into v_purchase
  from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'This purchase was not found.';
  end if;
  if v_purchase.status = 'cancelled' then
    raise exception 'This purchase was cancelled, so it cannot be returned.';
  end if;

  select allow_negative_stock into v_allow_neg from public.shop_settings;

  -- pass 1: validate and compute refund total
  for v_rec in
    select lines.*
    from (
      select x.product_id, sum(x.quantity) as quantity
      from jsonb_to_recordset(p_items)
        as x(product_id uuid, quantity numeric)
      group by x.product_id
    ) lines
    order by lines.product_id
  loop
    v_line_qty := round(v_rec.quantity, 3);
    if v_line_qty is null or v_line_qty <= 0 then
      raise exception 'Return quantity must be more than zero.';
    end if;

    -- effective purchase price per base unit for this purchase
    select sum(pi.base_quantity) as bought,
           case when sum(pi.base_quantity) > 0
                then sum(pi.line_total) / sum(pi.base_quantity)
                else 0 end as eff_price
      into v_bought, v_eff_price
    from public.purchase_items pi
    where pi.purchase_id = p_purchase_id and pi.product_id = v_rec.product_id;

    if v_bought is null or v_bought = 0 then
      raise exception 'This product was not part of this purchase.';
    end if;

    select coalesce(sum(pri.quantity), 0) into v_prev_ret
    from public.purchase_return_items pri
    join public.purchase_returns pr on pr.id = pri.purchase_return_id
    where pr.purchase_id = p_purchase_id and pri.product_id = v_rec.product_id;

    if v_bought - v_prev_ret < v_line_qty then
      raise exception 'You can only return up to % of this product from this purchase.',
        v_bought - v_prev_ret;
    end if;

    v_total := v_total + round(v_line_qty * round(v_eff_price, 4), 2);
  end loop;

  v_number := public.gen_return_number('purchase');

  insert into public.purchase_returns
    (return_number, purchase_id, supplier_id, user_id, reason, total)
  values
    (v_number, p_purchase_id, v_purchase.supplier_id, v_uid,
     nullif(trim(coalesce(p_reason, '')), ''), v_total)
  returning id into v_return_id;

  -- pass 2: take goods out of stock
  for v_rec in
    select lines.*
    from (
      select x.product_id, sum(x.quantity) as quantity
      from jsonb_to_recordset(p_items)
        as x(product_id uuid, quantity numeric)
      group by x.product_id
    ) lines
    order by lines.product_id
  loop
    v_line_qty := round(v_rec.quantity, 3);

    select case when sum(pi.base_quantity) > 0
                then sum(pi.line_total) / sum(pi.base_quantity)
                else 0 end
      into v_eff_price
    from public.purchase_items pi
    where pi.purchase_id = p_purchase_id and pi.product_id = v_rec.product_id;

    select p.id, p.stock, p.name into v_product
    from public.products p
    where p.id = v_rec.product_id
    for update;

    v_stock := v_product.stock - v_line_qty;
    if not v_allow_neg and v_stock < 0 then
      raise exception 'Cannot return: only % of this product is left in stock.',
        v_product.stock;
    end if;

    update public.products set stock = v_stock where id = v_rec.product_id;

    insert into public.stock_movements
      (product_id, quantity_change, previous_stock, new_stock, movement_type,
       reason, user_id, reference_type, reference_id)
    values
      (v_rec.product_id, -v_line_qty, v_product.stock, v_stock, 'purchase_return',
       'Purchase return ' || v_number, v_uid, 'purchase_return', v_return_id);

    insert into public.purchase_return_items
      (purchase_return_id, product_id, quantity, unit_price, line_total)
    values
      (v_return_id, v_rec.product_id, v_line_qty, round(v_eff_price, 4),
       round(v_line_qty * round(v_eff_price, 4), 2));
  end loop;

  -- we now owe the supplier less
  update public.suppliers
     set balance_payable = balance_payable - v_total
   where id = v_purchase.supplier_id;

  return jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_number,
    'total', v_total
  );
end;
$$;

-- =============================================================
--  CUSTOMER PAYMENT  (money received from a customer)
-- =============================================================
create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_amount      numeric,
  p_method      text default 'cash',
  p_notes       text default null,
  p_sale_id     uuid default null,
  p_reference   text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_amount    numeric(14,2);
  v_customer  record;
  v_sale      record;
  v_payment_id uuid;
begin
  perform public.require_permission('payments.record');

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;
  if p_method not in ('cash','bank','wallet') then
    raise exception 'Choose a valid payment method (Cash, Bank or Wallet).';
  end if;

  select * into v_customer
  from public.customers where id = p_customer_id for update;
  if not found or not v_customer.is_active then
    raise exception 'Customer not found.';
  end if;

  if p_sale_id is not null then
    select * into v_sale from public.sales where id = p_sale_id for update;
    if not found then
      raise exception 'Invoice not found.';
    end if;
    if v_sale.customer_id is distinct from p_customer_id then
      raise exception 'This invoice does not belong to the selected customer.';
    end if;
    if v_sale.status = 'cancelled' then
      raise exception 'This invoice was cancelled. Payments cannot be recorded on it.';
    end if;
    if v_sale.due_amount <= 0 then
      raise exception 'Invoice % is already fully paid.', v_sale.invoice_number;
    end if;
    if v_amount > v_sale.due_amount then
      raise exception 'Amount is more than the due amount (Rs. %) on invoice %.',
        v_sale.due_amount, v_sale.invoice_number;
    end if;

    update public.sales
       set paid_amount = paid_amount + v_amount,
           due_amount = due_amount - v_amount
     where id = p_sale_id;
  end if;

  insert into public.customer_payments
    (customer_id, sale_id, amount, method, reference, notes, user_id)
  values
    (p_customer_id, p_sale_id, v_amount, p_method::public.payment_method,
     nullif(trim(coalesce(p_reference, '')), ''),
     nullif(trim(coalesce(p_notes, '')), ''), v_uid)
  returning id into v_payment_id;

  update public.customers
     set balance_due = balance_due - v_amount
   where id = p_customer_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_amount,
    'balance_due', (select balance_due from public.customers where id = p_customer_id)
  );
end;
$$;

-- =============================================================
--  SUPPLIER PAYMENT  (money paid to a supplier)
-- =============================================================
create or replace function public.record_supplier_payment(
  p_supplier_id uuid,
  p_amount      numeric,
  p_method      text default 'cash',
  p_notes       text default null,
  p_purchase_id uuid default null,
  p_reference   text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_amount     numeric(14,2);
  v_supplier   record;
  v_purchase   record;
  v_payment_id uuid;
begin
  perform public.require_permission('payments.record');

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;
  if p_method not in ('cash','bank','wallet') then
    raise exception 'Choose a valid payment method (Cash, Bank or Wallet).';
  end if;

  select * into v_supplier
  from public.suppliers where id = p_supplier_id for update;
  if not found or not v_supplier.is_active then
    raise exception 'Supplier not found.';
  end if;

  if p_purchase_id is not null then
    select * into v_purchase
    from public.purchases where id = p_purchase_id for update;
    if not found then
      raise exception 'Purchase not found.';
    end if;
    if v_purchase.supplier_id is distinct from p_supplier_id then
      raise exception 'This purchase does not belong to the selected supplier.';
    end if;
    if v_purchase.status = 'cancelled' then
      raise exception 'This purchase was cancelled. Payments cannot be recorded on it.';
    end if;
    if v_purchase.due_amount <= 0 then
      raise exception 'Purchase % is already fully paid.', v_purchase.purchase_number;
    end if;
    if v_amount > v_purchase.due_amount then
      raise exception 'Amount is more than the due amount (Rs. %) on purchase %.',
        v_purchase.due_amount, v_purchase.purchase_number;
    end if;

    update public.purchases
       set paid_amount = paid_amount + v_amount,
           due_amount = due_amount - v_amount
     where id = p_purchase_id;
  end if;

  insert into public.supplier_payments
    (supplier_id, purchase_id, amount, method, reference, notes, user_id)
  values
    (p_supplier_id, p_purchase_id, v_amount, p_method::public.payment_method,
     nullif(trim(coalesce(p_reference, '')), ''),
     nullif(trim(coalesce(p_notes, '')), ''), v_uid)
  returning id into v_payment_id;

  update public.suppliers
     set balance_payable = balance_payable - v_amount
   where id = p_supplier_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_amount,
    'balance_payable', (select balance_payable from public.suppliers where id = p_supplier_id)
  );
end;
$$;

-- =============================================================
--  STOCK ADJUSTMENT  (damage / lost / manual / initial stock)
--  Stock is never changed without a recorded reason.
-- =============================================================
create or replace function public.adjust_stock(
  p_product_id     uuid,
  p_new_stock      numeric,
  p_movement_type  text,
  p_reason         text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_product    record;
  v_new        numeric(14,3);
  v_old        numeric(14,3);
  v_delta      numeric(14,3);
  v_reason     text := nullif(trim(coalesce(p_reason, '')), '');
  v_type       public.movement_type;
  v_movement_id uuid;
  v_adjust_id  uuid;
  v_allow_neg  boolean;
begin
  perform public.require_permission('stock.adjust');

  if p_movement_type not in ('adjustment','damage','lost','initial') then
    raise exception 'Choose a valid reason for the stock change.';
  end if;
  if p_movement_type <> 'initial' and v_reason is null then
    raise exception 'Please write a reason for this stock change.';
  end if;

  select allow_negative_stock into v_allow_neg from public.shop_settings;

  select p.id, p.stock, p.name, p.is_active into v_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;
  if not v_product.is_active then
    raise exception 'This product is inactive, so its stock cannot be changed.';
  end if;

  v_new := round(coalesce(p_new_stock, 0), 3);
  if v_new < 0 and not v_allow_neg then
    raise exception 'Stock cannot be less than zero. (Shop settings allow turning this off.)';
  end if;

  v_old := v_product.stock;
  v_delta := v_new - v_old;

  if v_delta = 0 then
    raise exception 'Stock is already %. Nothing to change.', v_old;
  end if;

  if p_movement_type = 'initial' and v_old <> 0 then
    raise exception 'Initial stock can only be set when the product has no stock. Use Adjust instead.';
  end if;

  v_type := p_movement_type::public.movement_type;

  -- first stock of a product is valued at its purchase price
  update public.products
     set stock = v_new,
         avg_cost = case
           when avg_cost = 0 and purchase_price > 0 and v_new > 0
             then purchase_price
           else avg_cost
         end
   where id = p_product_id;

  insert into public.stock_movements
    (product_id, quantity_change, previous_stock, new_stock, movement_type,
     reason, user_id, reference_type, reference_id)
  values
    (p_product_id, v_delta, v_old, v_new, v_type,
     coalesce(v_reason, 'Initial stock'), v_uid, 'adjustment', null)
  returning id into v_movement_id;

  if p_movement_type <> 'initial' then
    insert into public.stock_adjustments
      (product_id, movement_id, reason, user_id)
    values
      (p_product_id, v_movement_id, v_reason, v_uid)
    returning id into v_adjust_id;
  end if;

  return jsonb_build_object(
    'product_id', p_product_id,
    'previous_stock', v_old,
    'new_stock', v_new
  );
end;
$$;

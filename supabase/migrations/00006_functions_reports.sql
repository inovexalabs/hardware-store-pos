-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00006 : dashboard + report functions (read-only)
--  Dates are interpreted in Asia/Kathmandu.
-- =============================================================

-- -------------------------------------------------------------
--  DASHBOARD SUMMARY
-- -------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_result        jsonb := '{}'::jsonb;
  v_today         date := (now() at time zone 'Asia/Kathmandu')::date;
  v_today_sales   numeric := 0;
  v_net_sales     numeric := 0;
  v_today_count   integer := 0;
  v_today_purch   numeric := 0;
  v_today_profit  numeric := 0;
  v_cogs          numeric := 0;
  v_today_returns numeric := 0;
  v_today_return_cogs numeric := 0;
  v_customer_due  numeric := 0;
  v_supplier_due  numeric := 0;
  v_products      integer := 0;
  v_low           integer := 0;
  v_out           integer := 0;
  v_stock_value   numeric := 0;
  v_overdue       integer := 0;
begin
  perform public.require_permission('dashboard.view');

  select coalesce(sum(total), 0), coalesce(sum(total - tax_amount), 0), count(*)
    into v_today_sales, v_net_sales, v_today_count
  from public.sales
  where status = 'completed'
    and (created_at at time zone 'Asia/Kathmandu')::date = v_today;

  select coalesce(sum(total), 0)
    into v_today_purch
  from public.purchases
  where status = 'completed'
    and (created_at at time zone 'Asia/Kathmandu')::date = v_today;

  select coalesce(sum(si.quantity * si.cost_price), 0)
    into v_cogs
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.status = 'completed'
    and (s.created_at at time zone 'Asia/Kathmandu')::date = v_today;

  select coalesce(sum(sr.total - sr.tax_amount), 0)
    into v_today_returns
  from public.sales_returns sr
  where (sr.created_at at time zone 'Asia/Kathmandu')::date = v_today;

  select coalesce(sum(sri.quantity * coalesce(si.cost_price, 0)), 0)
    into v_today_return_cogs
  from public.sales_return_items sri
  join public.sales_returns sr on sr.id = sri.sales_return_id
  left join public.sale_items si
         on si.sale_id = sr.sale_id and si.product_id = sri.product_id
  where (sr.created_at at time zone 'Asia/Kathmandu')::date = v_today;

  select coalesce(sum(expenses.amount), 0)
    into v_today_profit  -- reuse variable for expenses of today
  from public.expenses
  where spent_on = v_today;

  v_today_profit := (v_net_sales - v_today_returns)
                    - (v_cogs - v_today_return_cogs)
                    - v_today_profit;

  if public.has_permission('reports.view') then
    select coalesce(sum(balance_due), 0) into v_customer_due
      from public.customers where balance_due > 0 and is_active;
    select coalesce(sum(balance_payable), 0) into v_supplier_due
      from public.suppliers where balance_payable > 0 and is_active;
    select count(*) into v_overdue
      from public.sales
      where status = 'completed' and due_amount > 0
        and created_at < now() - interval '14 days';
  else
    v_customer_due := null;
    v_supplier_due := null;
    v_overdue := null;
  end if;

  select count(*),
         count(*) filter (where stock > 0 and stock <= min_stock),
         count(*) filter (where stock <= 0),
         coalesce(sum(stock * avg_cost), 0)
    into v_products, v_low, v_out, v_stock_value
  from public.products
  where is_active;

  v_result := jsonb_build_object(
    'today', jsonb_build_object(
      'sales', v_today_sales,
      'sales_count', v_today_count,
      'purchases', v_today_purch,
      'profit', v_today_profit,
      'customer_due', v_customer_due,
      'supplier_payable', v_supplier_due
    ),
    'inventory', jsonb_build_object(
      'products', v_products,
      'low_stock', v_low,
      'out_of_stock', v_out,
      'stock_value', v_stock_value
    ),
    'overdue_payments', v_overdue
  );
  return v_result;
end;
$$;

-- -------------------------------------------------------------
--  SALES TOTALS  (revenue / COGS / gross / expenses / net)
--  Revenue is shown excluding VAT so profit is honest.
-- -------------------------------------------------------------
create or replace function public.report_sales_totals(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_revenue    numeric := 0;
  v_vat        numeric := 0;
  v_cogs       numeric := 0;
  v_count      integer := 0;
  v_returns    numeric := 0;
  v_return_cogs numeric := 0;
  v_expenses   numeric := 0;
begin
  perform public.require_permission('reports.view');

  select coalesce(sum(total - tax_amount), 0),
         coalesce(sum(tax_amount), 0),
         count(*)
    into v_revenue, v_vat, v_count
  from public.sales
  where status = 'completed'
    and (created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to;

  select coalesce(sum(si.quantity * si.cost_price), 0)
    into v_cogs
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.status = 'completed'
    and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to;

  select coalesce(sum(total - tax_amount), 0)
    into v_returns
  from public.sales_returns
  where (created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to;

  select coalesce(sum(sri.quantity * coalesce(si.cost_price, 0)), 0)
    into v_return_cogs
  from public.sales_return_items sri
  join public.sales_returns sr on sr.id = sri.sales_return_id
  left join public.sale_items si
         on si.sale_id = sr.sale_id and si.product_id = sri.product_id
  where (sr.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to;

  select coalesce(sum(amount), 0)
    into v_expenses
  from public.expenses
  where spent_on between p_from and p_to;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'revenue', greatest(v_revenue - v_returns, 0),
    'gross_revenue', v_revenue,
    'vat_collected', v_vat,
    'returns', v_returns,
    'cogs', greatest(v_cogs - v_return_cogs, 0),
    'gross_profit', (v_revenue - v_returns) - (v_cogs - v_return_cogs),
    'expenses', v_expenses,
    'net_profit', (v_revenue - v_returns) - (v_cogs - v_return_cogs) - v_expenses,
    'sales_count', v_count
  );
end;
$$;

-- -------------------------------------------------------------
--  SALES BY DAY
-- -------------------------------------------------------------
create or replace function public.report_sales_by_day(p_from date, p_to date)
returns table (
  day           date,
  sales_count   bigint,
  revenue       numeric,
  cogs          numeric,
  profit        numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  with sales_by_day as (
    select (s.created_at at time zone 'Asia/Kathmandu')::date as d,
           count(*) as cnt,
           coalesce(sum(s.total - s.tax_amount), 0) as rev
    from public.sales s
    where s.status = 'completed'
      and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    group by 1
  ),
  returns_by_day as (
    select (sr.created_at at time zone 'Asia/Kathmandu')::date as d,
           coalesce(sum(sr.total - sr.tax_amount), 0) as ret
    from public.sales_returns sr
    where (sr.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    group by 1
  ),
  cogs_by_day as (
    select (s.created_at at time zone 'Asia/Kathmandu')::date as d,
           coalesce(sum(si.quantity * si.cost_price), 0) as cost
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.status = 'completed'
      and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    group by 1
  )
  select d.day,
         coalesce(sb.cnt, 0),
         coalesce(sb.rev, 0) - coalesce(rb.ret, 0),
         coalesce(cb.cost, 0),
         coalesce(sb.rev, 0) - coalesce(rb.ret, 0) - coalesce(cb.cost, 0)
  from (
    select s.day_ts::date as day
    from generate_series(p_from, p_to, interval '1 day') as s(day_ts)
  ) as d
  left join sales_by_day sb on sb.d = d.day
  left join returns_by_day rb on rb.d = d.day
  left join cogs_by_day cb on cb.d = d.day
  order by d.day;
end;
$$;

-- -------------------------------------------------------------
--  SALES BY PRODUCT
-- -------------------------------------------------------------
create or replace function public.report_sales_by_product(p_from date, p_to date)
returns table (
  product_id    uuid,
  product_name  text,
  category_name text,
  quantity      numeric,
  revenue       numeric,
  cogs          numeric,
  profit        numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  with sold as (
    select si.product_id,
           sum(si.quantity) as qty,
           sum(round(si.line_total
             * case when s.subtotal > 0
                    then (s.subtotal - s.discount_amount) / s.subtotal
                    else 1 end, 2)) as rev,
           sum(si.quantity * si.cost_price) as cost
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.status = 'completed'
      and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    group by si.product_id
  ),
  returned as (
    select sri.product_id,
           sum(sri.quantity) as qty,
           sum(sri.line_total) as rev
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where (sr.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    group by sri.product_id
  )
  select p.id,
         p.name,
         coalesce(c.name, '-'),
         coalesce(sold.qty, 0) - coalesce(returned.qty, 0),
         coalesce(sold.rev, 0) - coalesce(returned.rev, 0),
         coalesce(sold.cost, 0),
         coalesce(sold.rev, 0) - coalesce(returned.rev, 0) - coalesce(sold.cost, 0)
  from public.products p
  left join public.categories c on c.id = p.category_id
  left join sold on sold.product_id = p.id
  left join returned on returned.product_id = p.id
  where sold.product_id is not null
  order by coalesce(sold.rev, 0) - coalesce(returned.rev, 0) desc;
end;
$$;

-- -------------------------------------------------------------
--  SALES BY CATEGORY / CUSTOMER / PAYMENT METHOD
-- -------------------------------------------------------------
create or replace function public.report_sales_by_category(p_from date, p_to date)
returns table (
  category_name text,
  sales_count   bigint,
  revenue       numeric,
  profit        numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select coalesce(c.name, 'Uncategorised'),
         count(distinct s.id),
         coalesce(sum(si.line_total
           * case when s.subtotal > 0
                  then (s.subtotal - s.discount_amount) / s.subtotal
                  else 1 end, 2), 0),
         coalesce(sum(si.line_total
           * case when s.subtotal > 0
                  then (s.subtotal - s.discount_amount) / s.subtotal
                  else 1 end, 2), 0)
           - coalesce(sum(si.quantity * si.cost_price), 0)
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  join public.products p on p.id = si.product_id
  left join public.categories c on c.id = p.category_id
  where s.status = 'completed'
    and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
  group by coalesce(c.name, 'Uncategorised')
  order by 3 desc;
end;
$$;

create or replace function public.report_sales_by_customer(p_from date, p_to date)
returns table (
  customer_id   uuid,
  customer_name text,
  sales_count   bigint,
  revenue       numeric,
  due_amount    numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select coalesce(c.id, null::uuid),
         coalesce(c.name, 'Walk-in customer'),
         count(*),
         coalesce(sum(s.total - s.tax_amount), 0),
         coalesce(sum(s.due_amount), 0)
  from public.sales s
  left join public.customers c on c.id = s.customer_id
  where s.status = 'completed'
    and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
  group by coalesce(c.id, null::uuid), coalesce(c.name, 'Walk-in customer')
  order by 4 desc;
end;
$$;

create or replace function public.report_sales_by_payment_method(p_from date, p_to date)
returns table (
  method        text,
  sales_count   bigint,
  total         numeric,
  paid          numeric,
  due           numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select s.payment_method::text,
         count(*),
         coalesce(sum(s.total), 0),
         coalesce(sum(s.paid_amount), 0),
         coalesce(sum(s.due_amount), 0)
  from public.sales s
  where s.status = 'completed'
    and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
  group by s.payment_method::text
  order by 3 desc;
end;
$$;

-- -------------------------------------------------------------
--  PURCHASE REPORTS
-- -------------------------------------------------------------
create or replace function public.report_purchases_totals(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_total   numeric := 0;
  v_paid    numeric := 0;
  v_due     numeric := 0;
  v_count   integer := 0;
begin
  perform public.require_permission('reports.view');

  select coalesce(sum(total), 0), coalesce(sum(paid_amount), 0),
         coalesce(sum(due_amount), 0), count(*)
    into v_total, v_paid, v_due, v_count
  from public.purchases
  where status = 'completed'
    and (created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', v_total, 'paid', v_paid, 'due', v_due, 'count', v_count
  );
end;
$$;

create or replace function public.report_purchases_by_day(p_from date, p_to date)
returns table (
  day           date,
  purchases_count bigint,
  total         numeric,
  paid          numeric,
  due           numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select d.day,
         coalesce(count(p.id), 0),
         coalesce(sum(p.total), 0),
         coalesce(sum(p.paid_amount), 0),
         coalesce(sum(p.due_amount), 0)
  from (
    select s.day_ts::date as day
    from generate_series(p_from, p_to, interval '1 day') as s(day_ts)
  ) as d
  left join public.purchases p
         on p.status = 'completed'
        and (p.created_at at time zone 'Asia/Kathmandu')::date = d.day
  group by d.day
  order by d.day;
end;
$$;

create or replace function public.report_purchases_by_supplier(p_from date, p_to date)
returns table (
  supplier_id   uuid,
  supplier_name text,
  purchases_count bigint,
  total         numeric,
  paid          numeric,
  due           numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select s.id,
         s.name,
         count(*),
         coalesce(sum(s2.total), 0),
         coalesce(sum(s2.paid_amount), 0),
         coalesce(sum(s2.due_amount), 0)
  from public.purchases s2
  join public.suppliers s on s.id = s2.supplier_id
  where s2.status = 'completed'
    and (s2.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
  group by s.id, s.name
  order by 4 desc;
end;
$$;

create or replace function public.report_product_purchases(p_product_id uuid, p_from date, p_to date)
returns table (
  purchase_number text,
  supplier_name   text,
  purchased_on    date,
  quantity        numeric,
  unit_price      numeric,
  total           numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select pu.purchase_number,
         s.name,
         (pu.created_at at time zone 'Asia/Kathmandu')::date,
         pi.quantity,
         pi.unit_price,
         pi.line_total
  from public.purchase_items pi
  join public.purchases pu on pu.id = pi.purchase_id
  join public.suppliers s on s.id = pu.supplier_id
  where pi.product_id = p_product_id
    and pu.status = 'completed'
    and (pu.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
  order by pu.created_at desc;
end;
$$;

-- -------------------------------------------------------------
--  INVENTORY REPORTS
-- -------------------------------------------------------------
create or replace function public.report_stock_valuation()
returns table (
  product_id    uuid,
  product_name  text,
  sku           text,
  category_name text,
  stock         numeric,
  unit_name     text,
  avg_cost      numeric,
  stock_value   numeric,
  min_stock     numeric,
  rack          text
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select p.id, p.name, p.sku, coalesce(c.name, '-'), p.stock,
         u.name, p.avg_cost, round(p.stock * p.avg_cost, 2), p.min_stock, coalesce(p.rack, '-')
  from public.products p
  join public.units u on u.id = p.unit_id
  left join public.categories c on c.id = p.category_id
  where p.is_active
  order by p.name;
end;
$$;

create or replace function public.report_low_stock()
returns table (
  product_id    uuid,
  product_name  text,
  sku           text,
  stock         numeric,
  min_stock     numeric,
  unit_name     text,
  status        text
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select p.id, p.name, p.sku, p.stock, p.min_stock, u.name,
         case when p.stock <= 0 then 'Out of Stock' else 'Low Stock' end
  from public.products p
  join public.units u on u.id = p.unit_id
  where p.is_active and p.stock <= p.min_stock
  order by p.stock asc, p.name;
end;
$$;

create or replace function public.report_stock_movements(p_from date, p_to date, p_product_id uuid default null)
returns table (
  created_at     timestamptz,
  product_name   text,
  movement_type  text,
  quantity_change numeric,
  previous_stock numeric,
  new_stock      numeric,
  reason         text,
  made_by        text,
  reference      text
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select sm.created_at,
         p.name,
         sm.movement_type::text,
         sm.quantity_change,
         sm.previous_stock,
         sm.new_stock,
         coalesce(sm.reason, '-'),
         coalesce(pr.full_name, 'System'),
         coalesce(sm.reference_type, '-')
  from public.stock_movements sm
  join public.products p on p.id = sm.product_id
  left join public.profiles pr on pr.id = sm.user_id
  where (sm.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    and (p_product_id is null or sm.product_id = p_product_id)
  order by sm.created_at desc
  limit 2000;
end;
$$;

create or replace function public.report_slow_moving(p_days integer default 90)
returns table (
  product_id    uuid,
  product_name  text,
  stock         numeric,
  stock_value   numeric,
  last_sold_on  date,
  days_no_sale  integer
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select p.id, p.name, p.stock, round(p.stock * p.avg_cost, 2),
         (max(s.created_at) at time zone 'Asia/Kathmandu')::date,
         case when max(s.created_at) is null
              then p_days + 1000
              else (now() at time zone 'Asia/Kathmandu')::date
                   - (max(s.created_at) at time zone 'Asia/Kathmandu')::date end
  from public.products p
  left join public.sale_items si on si.product_id = p.id
  left join public.sales s on s.id = si.sale_id and s.status = 'completed'
  where p.is_active and p.stock > 0
  group by p.id, p.name, p.stock, p.avg_cost
  having max(s.created_at) is null
      or max(s.created_at) < now() - make_interval(days => p_days)
  order by (p.stock * p.avg_cost) desc;
end;
$$;

-- -------------------------------------------------------------
--  EXPENSE REPORT
-- -------------------------------------------------------------
create or replace function public.report_expenses_by_category(p_from date, p_to date)
returns table (
  category_name text,
  entries       bigint,
  total         numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select ec.name, count(*), coalesce(sum(e.amount), 0)
  from public.expenses e
  join public.expense_categories ec on ec.id = e.category_id
  where e.spent_on between p_from and p_to
  group by ec.name
  order by 3 desc;
end;
$$;

-- -------------------------------------------------------------
--  WHO OWES WHOM
-- -------------------------------------------------------------
create or replace function public.report_customer_dues()
returns table (
  customer_id   uuid,
  customer_name text,
  phone         text,
  balance_due   numeric,
  credit_limit  numeric,
  oldest_due_on date
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select c.id, c.name, c.phone, c.balance_due, c.credit_limit,
         min((s.created_at at time zone 'Asia/Kathmandu')::date) filter
           (where s.due_amount > 0 and s.status = 'completed')
  from public.customers c
  left join public.sales s on s.customer_id = c.id
  where c.is_active and c.balance_due > 0
  group by c.id, c.name, c.phone, c.balance_due, c.credit_limit
  order by c.balance_due desc;
end;
$$;

create or replace function public.report_supplier_payables()
returns table (
  supplier_id   uuid,
  supplier_name text,
  phone         text,
  balance_payable numeric,
  oldest_due_on date
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('reports.view');
  return query
  select s.id, s.name, s.phone, s.balance_payable,
         min((p.created_at at time zone 'Asia/Kathmandu')::date) filter
           (where p.due_amount > 0 and p.status = 'completed')
  from public.suppliers s
  left join public.purchases p on p.supplier_id = s.id
  where s.is_active and s.balance_payable > 0
  group by s.id, s.name, s.phone, s.balance_payable
  order by s.balance_payable desc;
end;
$$;

-- -------------------------------------------------------------
--  CUSTOMER / SUPPLIER STATEMENTS (ledger)
-- -------------------------------------------------------------
create or replace function public.report_customer_statement(
  p_customer_id uuid, p_from date, p_to date
)
returns table (
  entry_date  date,
  description text,
  debit       numeric,
  credit      numeric,
  balance     numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_running numeric := 0;
  r record;
begin
  perform public.require_permission('customers.view');

  for r in
    select d.entry_date, d.description, d.debit, d.credit
    from (
      select (s.created_at at time zone 'Asia/Kathmandu')::date as entry_date,
             'Invoice ' || s.invoice_number as description,
             s.total as debit, 0::numeric as credit,
             s.created_at as sort_at, 1 as sort_kind
      from public.sales s
      where s.customer_id = p_customer_id and s.status = 'completed'
        and (s.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
      union all
      select (sr.created_at at time zone 'Asia/Kathmandu')::date,
             'Return ' || sr.return_number, 0, sr.total,
             sr.created_at, 2
      from public.sales_returns sr
      where sr.customer_id = p_customer_id
        and (sr.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
      union all
      select (cp.created_at at time zone 'Asia/Kathmandu')::date,
             'Payment received' || case when cp.reference is not null
                                        then ' (' || cp.reference || ')' else '' end,
             0, cp.amount, cp.created_at, 3
      from public.customer_payments cp
      where cp.customer_id = p_customer_id
        and (cp.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    ) d
    order by d.sort_at, d.sort_kind
  loop
    v_running := v_running + coalesce(r.debit, 0) - coalesce(r.credit, 0);
    entry_date := r.entry_date;
    description := r.description;
    debit := coalesce(r.debit, 0);
    credit := coalesce(r.credit, 0);
    balance := v_running;
    return next;
  end loop;
end;
$$;

create or replace function public.report_supplier_statement(
  p_supplier_id uuid, p_from date, p_to date
)
returns table (
  entry_date  date,
  description text,
  debit       numeric,
  credit      numeric,
  balance     numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_running numeric := 0;
  r record;
begin
  perform public.require_permission('suppliers.view');

  for r in
    select d.entry_date, d.description, d.debit, d.credit
    from (
      select (pu.created_at at time zone 'Asia/Kathmandu')::date,
             'Purchase ' || pu.purchase_number, pu.total, 0::numeric,
             pu.created_at, 1
      from public.purchases pu
      where pu.supplier_id = p_supplier_id and pu.status = 'completed'
        and (pu.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
      union all
      select (pr.created_at at time zone 'Asia/Kathmandu')::date,
             'Return ' || pr.return_number, 0, pr.total,
             pr.created_at, 2
      from public.purchase_returns pr
      where pr.supplier_id = p_supplier_id
        and (pr.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
      union all
      select (sp.created_at at time zone 'Asia/Kathmandu')::date,
             'Payment made' || case when sp.reference is not null
                                    then ' (' || sp.reference || ')' else '' end,
             0, sp.amount, sp.created_at, 3
      from public.supplier_payments sp
      where sp.supplier_id = p_supplier_id
        and (sp.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    ) d
    order by d.sort_at, d.sort_kind
  loop
    v_running := v_running + coalesce(r.debit, 0) - coalesce(r.credit, 0);
    entry_date := r.entry_date;
    description := r.description;
    debit := coalesce(r.debit, 0);
    credit := coalesce(r.credit, 0);
    balance := v_running;
    return next;
  end loop;
end;
$$;

-- =============================================================
--  SECURITY : these functions are only for signed-in users
-- =============================================================
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'app_role','has_permission','require_permission',
        'gen_invoice_number','gen_purchase_number','gen_return_number',
        'create_sale','cancel_sale','create_purchase','cancel_purchase',
        'create_sales_return','create_purchase_return',
        'record_customer_payment','record_supplier_payment','adjust_stock',
        'dashboard_summary','report_sales_totals','report_sales_by_day',
        'report_sales_by_product','report_sales_by_category',
        'report_sales_by_customer','report_sales_by_payment_method',
        'report_purchases_totals','report_purchases_by_day',
        'report_purchases_by_supplier','report_product_purchases',
        'report_stock_valuation','report_low_stock','report_stock_movements',
        'report_slow_moving','report_expenses_by_category',
        'report_customer_dues','report_supplier_payables',
        'report_customer_statement','report_supplier_statement'
      )
  loop
    execute format('revoke execute on function %s from anon, public', fn.sig);
    execute format('grant execute on function %s to authenticated', fn.sig);
  end loop;
end $$;

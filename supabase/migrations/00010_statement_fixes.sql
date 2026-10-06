-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00010 : correct customer / supplier statements
--
--  The statement must always end on the same number as
--  customers.balance_due / suppliers.balance_payable.  Before this
--  migration it listed the full invoice total as owed even when the
--  customer paid at the counter, ignored cancellations, and started
--  every period at zero.
--
--  Every change to a party balance is now one statement line:
--    invoice / purchase         debit  = total
--    paid at counter            credit = amount paid when the bill was made
--    payment                    credit = amount
--    return                     credit = refund / return value
--    cancellation               credit = what was still due when cancelled
--  plus an "Opening balance" row for everything before the period.
-- =============================================================

-- -------------------------------------------------------------
--  Remember what was paid when the bill was created.
--  paid_amount changes later (payments, returns), so it cannot
--  be used for this.
-- -------------------------------------------------------------
alter table public.sales
  add column if not exists initial_paid numeric(14,2) not null default 0;
alter table public.purchases
  add column if not exists initial_paid numeric(14,2) not null default 0;

create or replace function public.set_initial_paid()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.initial_paid := coalesce(new.paid_amount, 0);
  return new;
end;
$$;

drop trigger if exists sales_set_initial_paid on public.sales;
create trigger sales_set_initial_paid
  before insert on public.sales
  for each row execute function public.set_initial_paid();

drop trigger if exists purchases_set_initial_paid on public.purchases;
create trigger purchases_set_initial_paid
  before insert on public.purchases
  for each row execute function public.set_initial_paid();

-- Backfill bills created before this migration.  Payments linked to a
-- bill are subtracted; a return that settled part of a bill's due
-- cannot be told apart afterwards, so such old bills may show a
-- slightly larger "paid at counter" line.
update public.sales s
   set initial_paid = greatest(
         0,
         s.paid_amount - coalesce((select sum(cp.amount)
                                     from public.customer_payments cp
                                    where cp.sale_id = s.id), 0))
 where s.initial_paid = 0 and s.paid_amount > 0;

update public.purchases pu
   set initial_paid = greatest(
         0,
         pu.paid_amount - coalesce((select sum(sp.amount)
                                      from public.supplier_payments sp
                                     where sp.purchase_id = pu.id), 0))
 where pu.initial_paid = 0 and pu.paid_amount > 0;

-- -------------------------------------------------------------
--  CUSTOMER STATEMENT
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
begin
  perform public.require_permission('customers.view');

  return query
  with entries as (
    select s.created_at as at, 1 as kind,
           'Invoice ' || s.invoice_number as what,
           s.total as dr, 0::numeric as cr
    from public.sales s
    where s.customer_id = p_customer_id
    union all
    select s.created_at, 2,
           'Paid at counter — ' || s.invoice_number,
           0, s.initial_paid
    from public.sales s
    where s.customer_id = p_customer_id and s.initial_paid > 0
    union all
    select sr.created_at, 3,
           'Return ' || sr.return_number,
           0, sr.total
    from public.sales_returns sr
    where sr.customer_id = p_customer_id
    union all
    select cp.created_at, 4,
           'Payment received'
             || case when cp.reference is not null then ' (' || cp.reference || ')' else '' end,
           0, cp.amount
    from public.customer_payments cp
    where cp.customer_id = p_customer_id
    union all
    select coalesce(s.cancelled_at, s.created_at), 5,
           'Invoice ' || s.invoice_number || ' cancelled',
           0, s.due_amount
    from public.sales s
    where s.customer_id = p_customer_id
      and s.status = 'cancelled' and s.due_amount > 0
  ),
  dated as (
    select (e.at at time zone 'Asia/Kathmandu')::date as d, e.*
    from entries e
  ),
  opening as (
    select coalesce(sum(dated.dr - dated.cr), 0) as amount
    from dated
    where dated.d < p_from
  ),
  lines as (
    select p_from as d, 'Opening balance'::text as what,
           0::numeric as dr, 0::numeric as cr,
           '-infinity'::timestamptz as at, 0 as kind
    union all
    select dated.d, dated.what, dated.dr, dated.cr, dated.at, dated.kind
    from dated
    where dated.d between p_from and p_to
  )
  select l.d,
         l.what,
         l.dr,
         l.cr,
         (select o.amount from opening o)
           + sum(l.dr - l.cr) over (order by l.at, l.kind rows unbounded preceding)
  from lines l
  order by l.at, l.kind;
end;
$$;

-- -------------------------------------------------------------
--  SUPPLIER STATEMENT
-- -------------------------------------------------------------
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
begin
  perform public.require_permission('suppliers.view');

  return query
  with entries as (
    select pu.created_at as at, 1 as kind,
           'Purchase ' || pu.purchase_number as what,
           pu.total as dr, 0::numeric as cr
    from public.purchases pu
    where pu.supplier_id = p_supplier_id
    union all
    select pu.created_at, 2,
           'Paid on purchase — ' || pu.purchase_number,
           0, pu.initial_paid
    from public.purchases pu
    where pu.supplier_id = p_supplier_id and pu.initial_paid > 0
    union all
    select pr.created_at, 3,
           'Return ' || pr.return_number,
           0, pr.total
    from public.purchase_returns pr
    where pr.supplier_id = p_supplier_id
    union all
    select sp.created_at, 4,
           'Payment made'
             || case when sp.reference is not null then ' (' || sp.reference || ')' else '' end,
           0, sp.amount
    from public.supplier_payments sp
    where sp.supplier_id = p_supplier_id
    union all
    select coalesce(pu.cancelled_at, pu.created_at), 5,
           'Purchase ' || pu.purchase_number || ' cancelled',
           0, pu.due_amount
    from public.purchases pu
    where pu.supplier_id = p_supplier_id
      and pu.status = 'cancelled' and pu.due_amount > 0
  ),
  dated as (
    select (e.at at time zone 'Asia/Kathmandu')::date as d, e.*
    from entries e
  ),
  opening as (
    select coalesce(sum(dated.dr - dated.cr), 0) as amount
    from dated
    where dated.d < p_from
  ),
  lines as (
    select p_from as d, 'Opening balance'::text as what,
           0::numeric as dr, 0::numeric as cr,
           '-infinity'::timestamptz as at, 0 as kind
    union all
    select dated.d, dated.what, dated.dr, dated.cr, dated.at, dated.kind
    from dated
    where dated.d between p_from and p_to
  )
  select l.d,
         l.what,
         l.dr,
         l.cr,
         (select o.amount from opening o)
           + sum(l.dr - l.cr) over (order by l.at, l.kind rows unbounded preceding)
  from lines l
  order by l.at, l.kind;
end;
$$;

revoke execute on function public.report_customer_statement(uuid, date, date) from anon, public;
revoke execute on function public.report_supplier_statement(uuid, date, date) from anon, public;
grant execute on function public.report_customer_statement(uuid, date, date) to authenticated;
grant execute on function public.report_supplier_statement(uuid, date, date) to authenticated;

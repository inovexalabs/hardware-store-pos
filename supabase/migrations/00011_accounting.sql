-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00011 : accounting (double-entry books)
--
--  * Chart of accounts (assets, liabilities, equity, income, expenses)
--  * Journal entries + lines — every entry has equal debits and credits
--  * Every money event in the shop is posted automatically:
--      sale / cancellation, purchase / cancellation, sales return,
--      purchase return, customer payment, supplier payment, expense,
--      stock write-off / opening stock
--  * Manual journal entries (capital, drawings, bank deposits, …)
--    and reversals of manual entries
--  * Ledger, trial balance, income statement and balance sheet
--  * Existing history is posted once, so the books start complete.
--
--  The control accounts always agree with the rest of the app:
--    Customer Receivables (per customer)  = customers.balance_due
--    Supplier Payables    (per supplier)  = suppliers.balance_payable
-- =============================================================

-- ---------- Types ----------
do $$ begin
  create type public.account_type as enum ('asset','liability','equity','income','expense');
exception when duplicate_object then null; end $$;

-- =============================================================
--  CHART OF ACCOUNTS
-- =============================================================
create table if not exists public.accounts (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  name         text not null,
  type         public.account_type not null,
  description  text,
  -- set on the accounts the app posts to by itself (cash, sales, …)
  system_key   text unique,
  -- false = only the app may post here (receivables, payables, stock),
  -- because those balances must always match customers / suppliers / products
  allow_manual boolean not null default true,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists accounts_code_key on public.accounts (lower(code));
create unique index if not exists accounts_name_key on public.accounts (lower(name));
create index if not exists accounts_type_idx on public.accounts (type, code);

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

insert into public.accounts (code, name, type, system_key, allow_manual, description) values
  ('1000', 'Cash in Hand',              'asset',     'cash',           true,  'Cash in the drawer / safe.'),
  ('1010', 'Bank Account',              'asset',     'bank',           true,  'Bank and eSewa/Fonepay transfers.'),
  ('1020', 'Digital Wallet',            'asset',     'wallet',         true,  'Khalti, IME Pay and other wallets.'),
  ('1100', 'Customer Receivables',      'asset',     'receivable',     false, 'Money customers owe the shop. Kept by sales, returns and payments.'),
  ('1200', 'Stock (Inventory)',         'asset',     'inventory',      false, 'Value of goods in the shop at cost. Kept by purchases, sales and stock changes.'),
  ('1300', 'VAT Paid on Purchases',     'asset',     'vat_input',      true,  'Input VAT you can claim back from the tax office.'),
  ('2000', 'Supplier Payables',         'liability', 'payable',        false, 'Money the shop owes suppliers. Kept by purchases, returns and payments.'),
  ('2100', 'VAT Collected on Sales',    'liability', 'vat_output',     true,  'Output VAT owed to the tax office.'),
  ('2200', 'Loans',                     'liability', null,             true,  'Bank or personal loans taken by the shop.'),
  ('3000', 'Owner''s Capital',          'equity',    'capital',        true,  'Money the owner put into the shop.'),
  ('3100', 'Owner''s Drawings',         'equity',    'drawings',       true,  'Money or goods the owner took out for personal use.'),
  ('3200', 'Opening Balances',          'equity',    'opening_equity', true,  'Balances brought in when the books were started.'),
  ('4000', 'Sales',                     'income',    'sales',          false, 'Sales without VAT, after bill discounts.'),
  ('4100', 'Sales Returns',             'income',    'sales_returns',  false, 'Goods returned by customers (reduces sales).'),
  ('4200', 'Other Income',              'income',    'other_income',   true,  'Commission, scrap sales, interest and other income.'),
  ('4300', 'Stock Gain',                'income',    'stock_gain',     true,  'Extra stock found during a count.'),
  ('5000', 'Cost of Goods Sold',        'expense',   'cogs',           false, 'What the goods you sold cost you.'),
  ('5100', 'Stock Loss & Damage',       'expense',   'stock_loss',     true,  'Damaged, lost or missing stock written off.')
on conflict do nothing;

-- every expense category posts to its own expense account
alter table public.expense_categories
  add column if not exists account_id uuid references public.accounts (id);

create or replace function public.acc_next_code(p_type public.account_type)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_base integer := case p_type
    when 'asset' then 1000 when 'liability' then 2000 when 'equity' then 3000
    when 'income' then 4000 else 5200 end;
  v_code integer;
begin
  select coalesce(max(code::integer), v_base) + 1 into v_code
  from public.accounts
  where code ~ '^[0-9]+$'
    and code::integer between v_base and (v_base / 1000) * 1000 + 999;
  return v_code::text;
end;
$$;

-- new expense category → new expense account with the same name
create or replace function public.acc_expense_category_account()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if new.account_id is not null
     and exists (select 1 from public.accounts where id = new.account_id and type = 'expense') then
    return new;
  end if;

  select id into v_id
  from public.accounts
  where lower(name) = lower(trim(new.name)) and type = 'expense';

  if v_id is null then
    insert into public.accounts (code, name, type, description)
    values (public.acc_next_code('expense'),
            case when exists (select 1 from public.accounts where lower(name) = lower(trim(new.name)))
                 then trim(new.name) || ' (expense)' else trim(new.name) end,
            'expense',
            'Expenses entered under "' || trim(new.name) || '".')
    returning id into v_id;
  end if;

  new.account_id := v_id;
  return new;
end;
$$;

drop trigger if exists expense_categories_account on public.expense_categories;
create trigger expense_categories_account
  before insert or update of account_id on public.expense_categories
  for each row execute function public.acc_expense_category_account();

-- link the categories that already exist
update public.expense_categories set account_id = null where account_id is null;

-- =============================================================
--  JOURNAL
-- =============================================================
create sequence if not exists public.journal_number_seq start 1;

create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  entry_date   date not null,
  narration    text not null,
  reference    text,
  -- what created the entry. 'manual' = typed in by a person.
  source_type  text not null default 'manual'
    check (source_type in ('manual','reversal','opening','stock_revaluation',
                           'sale','sale_cancel','purchase','purchase_cancel',
                           'sales_return','purchase_return',
                           'customer_payment','supplier_payment',
                           'expense','stock_adjustment')),
  source_id    uuid,
  total        numeric(14,2) not null default 0 check (total >= 0),  -- sum of debits
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- one entry per document (also makes automatic posting safe to repeat)
create unique index if not exists journal_entries_source_key
  on public.journal_entries (source_type, source_id) where source_id is not null;
create index if not exists journal_entries_date_idx
  on public.journal_entries (entry_date desc, created_at desc);
create index if not exists journal_entries_source_idx
  on public.journal_entries (source_id) where source_id is not null;

create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries (id) on delete cascade,
  line_no     smallint not null,
  account_id  uuid not null references public.accounts (id),
  debit       numeric(14,2) not null default 0 check (debit >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  memo        text,
  customer_id uuid references public.customers (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  constraint ck_journal_line_one_side
    check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id, line_no);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);
create index if not exists journal_lines_customer_idx
  on public.journal_lines (customer_id) where customer_id is not null;
create index if not exists journal_lines_supplier_idx
  on public.journal_lines (supplier_id) where supplier_id is not null;

-- Debits must equal credits.  Checked when the transaction commits, so
-- an entry can be written line by line.
create or replace function public.acc_check_entry_balanced()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_entry  uuid := coalesce(new.entry_id, old.entry_id);
  v_dr     numeric;
  v_cr     numeric;
  v_lines  integer;
begin
  if not exists (select 1 from public.journal_entries where id = v_entry) then
    return null;  -- the whole entry was removed
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_dr, v_cr, v_lines
  from public.journal_lines where entry_id = v_entry;

  if v_lines < 2 or v_dr <> v_cr or v_dr <= 0 then
    raise exception 'The books are out of balance: debits Rs. % and credits Rs. % on one entry. Nothing was saved.',
      v_dr, v_cr;
  end if;
  return null;
end;
$$;

drop trigger if exists journal_lines_balanced on public.journal_lines;
create constraint trigger journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.acc_check_entry_balanced();

-- =============================================================
--  ROW LEVEL SECURITY — read-only for app users; every write goes
--  through the functions below.  Set up before any entry is written:
--  when this file runs as one transaction (Supabase SQL editor), the
--  tables cannot be altered once balance checks are waiting to run.
-- =============================================================
alter table public.accounts        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;

drop policy if exists "accounts_select" on public.accounts;
create policy "accounts_select" on public.accounts
  for select to authenticated using (public.has_permission('accounting.view'));

drop policy if exists "journal_entries_select" on public.journal_entries;
create policy "journal_entries_select" on public.journal_entries
  for select to authenticated using (public.has_permission('accounting.view'));

drop policy if exists "journal_lines_select" on public.journal_lines;
create policy "journal_lines_select" on public.journal_lines
  for select to authenticated using (public.has_permission('accounting.view'));

revoke insert, update, delete on table public.accounts from anon, authenticated;
revoke insert, update, delete on table public.journal_entries from anon, authenticated;
revoke insert, update, delete on table public.journal_lines from anon, authenticated;

-- an expense category's account is chosen by the database
revoke insert, update on table public.expense_categories from anon, authenticated;
grant insert (name) on table public.expense_categories to authenticated;

revoke all on sequence public.journal_number_seq from anon, authenticated;

-- =============================================================
--  POSTING HELPERS  (internal — not callable by app users)
-- =============================================================
create or replace function public.acc_account(p_key text)
returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.accounts where system_key = p_key;
  if v_id is null then
    raise exception 'The books are missing the "%" account. Ask Inovexa Labs for help.', p_key;
  end if;
  return v_id;
end;
$$;

-- the money account a payment method moves money in/out of
create or replace function public.acc_method_account(p_method public.payment_method)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.acc_account(case p_method
    when 'bank' then 'bank'
    when 'wallet' then 'wallet'
    else 'cash' end);  -- the paid part of a "credit" bill is cash
$$;

create or replace function public.acc_local_date(p_at timestamptz)
returns date
language sql stable
as $$
  select (coalesce(p_at, now()) at time zone 'Asia/Kathmandu')::date;
$$;

create or replace function public.gen_journal_number()
returns text
language sql security definer
set search_path = public, pg_temp
as $$
  select 'JV-' || lpad(nextval('public.journal_number_seq')::text, 5, '0');
$$;

-- Writes one balanced entry.
-- p_lines: [{"account_id": "...", "debit": 0, "credit": 0, "memo": "...",
--            "customer_id": null, "supplier_id": null}]
-- Zero lines are dropped; if nothing is left no entry is written (returns null).
create or replace function public.acc_post(
  p_source_type  text,
  p_source_id    uuid,
  p_entry_date   date,
  p_created_at   timestamptz,
  p_narration    text,
  p_lines        jsonb,
  p_reference    text default null,
  p_created_by   uuid default null,
  p_entry_number text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_entry_id uuid;
  v_lines    jsonb;
  v_count    integer;
  v_dr       numeric(14,2);
  v_cr       numeric(14,2);
begin
  -- clean the lines once: round, drop empty ones, number them
  select coalesce(jsonb_agg(jsonb_build_object(
           'line_no', l.line_no, 'account_id', l.account_id,
           'debit', l.debit, 'credit', l.credit, 'memo', l.memo,
           'customer_id', l.customer_id, 'supplier_id', l.supplier_id) order by l.line_no), '[]'::jsonb),
         count(*), coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0)
    into v_lines, v_count, v_dr, v_cr
  from (
    select row_number() over (order by e.ord) as line_no,
           (e.item ->> 'account_id')::uuid as account_id,
           round(greatest(coalesce((e.item ->> 'debit')::numeric, 0), 0), 2) as debit,
           round(greatest(coalesce((e.item ->> 'credit')::numeric, 0), 0), 2) as credit,
           nullif(trim(coalesce(e.item ->> 'memo', '')), '') as memo,
           (e.item ->> 'customer_id')::uuid as customer_id,
           (e.item ->> 'supplier_id')::uuid as supplier_id
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as e(item, ord)
    where round(coalesce((e.item ->> 'debit')::numeric, 0), 2) > 0
       or round(coalesce((e.item ->> 'credit')::numeric, 0), 2) > 0
  ) l;

  if v_count = 0 then
    return null;
  end if;

  if exists (select 1 from jsonb_array_elements(v_lines) x where x ->> 'account_id' is null) then
    raise exception 'The books are missing an account for this entry. Nothing was saved.';
  end if;

  -- a line can only be on one side
  if exists (select 1 from jsonb_array_elements(v_lines) x
              where (x ->> 'debit')::numeric > 0 and (x ->> 'credit')::numeric > 0) then
    raise exception 'Each line needs either a debit or a credit amount, not both.';
  end if;

  if v_dr <> v_cr then
    raise exception 'The books are out of balance: debits Rs. % and credits Rs. % on "%". Nothing was saved.',
      v_dr, v_cr, p_narration;
  end if;

  insert into public.journal_entries
    (entry_number, entry_date, narration, reference, source_type, source_id,
     total, created_by, created_at)
  values
    (coalesce(p_entry_number, public.gen_journal_number()),
     p_entry_date,
     left(coalesce(nullif(trim(p_narration), ''), 'Journal entry'), 300),
     nullif(trim(coalesce(p_reference, '')), ''),
     p_source_type, p_source_id, v_dr,
     coalesce(p_created_by, auth.uid()),
     coalesce(p_created_at, now()))
  returning id into v_entry_id;

  insert into public.journal_lines
    (entry_id, line_no, account_id, debit, credit, memo, customer_id, supplier_id)
  select v_entry_id, x.line_no, x.account_id, x.debit, x.credit, x.memo,
         x.customer_id, x.supplier_id
  from jsonb_to_recordset(v_lines)
    as x(line_no smallint, account_id uuid, debit numeric, credit numeric, memo text,
         customer_id uuid, supplier_id uuid)
  order by x.line_no;

  return v_entry_id;
end;
$$;

-- one JSON line, so the posting functions below read like a voucher
create or replace function public.acc_line(
  p_account_id uuid,
  p_debit      numeric,
  p_credit     numeric,
  p_memo       text default null,
  p_customer   uuid default null,
  p_supplier   uuid default null
)
returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'account_id', p_account_id,
    'debit', coalesce(p_debit, 0),
    'credit', coalesce(p_credit, 0),
    'memo', p_memo,
    'customer_id', p_customer,
    'supplier_id', p_supplier);
$$;

-- =============================================================
--  AUTOMATIC POSTING — one function per kind of document.
--  Each one is safe to call twice (the second call does nothing).
-- =============================================================

-- ---------- SALE ----------
--  Dr Cash/Bank/Wallet (paid at counter)   Dr Customer Receivables (due)
--      Cr Sales (without VAT)              Cr VAT Collected
--  Dr Cost of Goods Sold                   Cr Stock
create or replace function public.acc_post_sale(p_sale_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_sale     record;
  v_paid     numeric(14,2);
  v_cogs     numeric(14,2);
begin
  select s.*, c.name as customer_name into v_sale
  from public.sales s
  left join public.customers c on c.id = s.customer_id
  where s.id = p_sale_id;
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'sale' and source_id = p_sale_id) then
    return null;
  end if;

  -- what was paid when the bill was made (later payments post on their own)
  v_paid := least(greatest(coalesce(v_sale.initial_paid, 0), 0), v_sale.total);

  select coalesce(round(sum(si.quantity * si.cost_price), 2), 0) into v_cogs
  from public.sale_items si where si.sale_id = p_sale_id;

  return public.acc_post(
    'sale', p_sale_id,
    public.acc_local_date(v_sale.created_at), v_sale.created_at,
    'Sale ' || v_sale.invoice_number || ' — ' || coalesce(v_sale.customer_name, 'Walk-in customer'),
    jsonb_build_array(
      public.acc_line(public.acc_method_account(v_sale.payment_method), v_paid, 0, 'Received at counter'),
      public.acc_line(public.acc_account('receivable'), v_sale.total - v_paid, 0,
                      'Due from customer', v_sale.customer_id),
      public.acc_line(public.acc_account('sales'), 0, v_sale.total - v_sale.tax_amount, 'Sales without VAT'),
      public.acc_line(public.acc_account('vat_output'), 0, v_sale.tax_amount, 'VAT on the bill'),
      public.acc_line(public.acc_account('cogs'), v_cogs, 0, 'Cost of the goods sold'),
      public.acc_line(public.acc_account('inventory'), 0, v_cogs, 'Goods out of stock')
    ),
    v_sale.invoice_number, v_sale.user_id);
end;
$$;

-- ---------- SALE CANCELLED ----------
--  The sale is undone: sales, VAT and cost are reversed, what was
--  still due is taken off the customer, and money already received
--  is treated as handed back the same way it came in.
create or replace function public.acc_post_sale_cancel(p_sale_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_sale    record;
  v_cogs    numeric(14,2);
  v_linked  numeric(14,2);
  v_lines   jsonb;
begin
  perform public.acc_post_sale(p_sale_id);

  select s.*, c.name as customer_name into v_sale
  from public.sales s
  left join public.customers c on c.id = s.customer_id
  where s.id = p_sale_id;
  if not found or v_sale.status <> 'cancelled' then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'sale_cancel' and source_id = p_sale_id) then
    return null;
  end if;

  select coalesce(round(sum(si.quantity * si.cost_price), 2), 0) into v_cogs
  from public.sale_items si where si.sale_id = p_sale_id;

  select coalesce(sum(cp.amount), 0) into v_linked
  from public.customer_payments cp where cp.sale_id = p_sale_id;

  v_lines := jsonb_build_array(
    public.acc_line(public.acc_account('sales'), v_sale.total - v_sale.tax_amount, 0, 'Sale reversed'),
    public.acc_line(public.acc_account('vat_output'), v_sale.tax_amount, 0, 'VAT reversed'),
    public.acc_line(public.acc_account('receivable'), 0, v_sale.due_amount,
                    'Due amount cancelled', v_sale.customer_id),
    public.acc_line(public.acc_method_account(v_sale.payment_method), 0,
                    greatest(v_sale.paid_amount - v_linked, 0), 'Counter payment handed back'),
    public.acc_line(public.acc_account('inventory'), v_cogs, 0, 'Goods back in stock'),
    public.acc_line(public.acc_account('cogs'), 0, v_cogs, 'Cost reversed')
  );

  -- payments taken against this invoice go back the way they came
  select v_lines || coalesce(jsonb_agg(public.acc_line(
           public.acc_method_account(cp.method), 0, sum_amount, 'Invoice payment handed back')), '[]'::jsonb)
    into v_lines
  from (select cp.method, sum(cp.amount) as sum_amount
        from public.customer_payments cp
        where cp.sale_id = p_sale_id
        group by cp.method) cp;

  return public.acc_post(
    'sale_cancel', p_sale_id,
    public.acc_local_date(coalesce(v_sale.cancelled_at, v_sale.created_at)),
    coalesce(v_sale.cancelled_at, v_sale.created_at),
    'Sale ' || v_sale.invoice_number || ' cancelled — '
      || coalesce(v_sale.customer_name, 'Walk-in customer')
      || coalesce(': ' || v_sale.cancel_reason, ''),
    v_lines, v_sale.invoice_number, v_sale.cancelled_by);
end;
$$;

-- ---------- PURCHASE ----------
--  Dr Stock (goods after discount)   Dr VAT Paid on Purchases
--      Cr Cash/Bank/Wallet (paid)    Cr Supplier Payables (due)
create or replace function public.acc_post_purchase(p_purchase_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pur  record;
  v_paid numeric(14,2);
begin
  select p.*, coalesce(s.company, s.name) as supplier_name into v_pur
  from public.purchases p
  join public.suppliers s on s.id = p.supplier_id
  where p.id = p_purchase_id;
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'purchase' and source_id = p_purchase_id) then
    return null;
  end if;

  v_paid := least(greatest(coalesce(v_pur.initial_paid, 0), 0), v_pur.total);

  return public.acc_post(
    'purchase', p_purchase_id,
    public.acc_local_date(v_pur.created_at), v_pur.created_at,
    'Purchase ' || v_pur.purchase_number || ' — ' || v_pur.supplier_name
      || coalesce(' (bill ' || v_pur.supplier_invoice_no || ')', ''),
    jsonb_build_array(
      public.acc_line(public.acc_account('inventory'), v_pur.total - v_pur.tax_amount, 0, 'Goods into stock'),
      public.acc_line(public.acc_account('vat_input'), v_pur.tax_amount, 0, 'VAT on the bill'),
      public.acc_line(public.acc_method_account(v_pur.payment_method), 0, v_paid, 'Paid with the purchase'),
      public.acc_line(public.acc_account('payable'), 0, v_pur.total - v_paid,
                      'Owed to supplier', null, v_pur.supplier_id)
    ),
    v_pur.purchase_number, v_pur.user_id);
end;
$$;

-- ---------- PURCHASE CANCELLED ----------
create or replace function public.acc_post_purchase_cancel(p_purchase_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pur    record;
  v_linked numeric(14,2);
  v_lines  jsonb;
begin
  perform public.acc_post_purchase(p_purchase_id);

  select p.*, coalesce(s.company, s.name) as supplier_name into v_pur
  from public.purchases p
  join public.suppliers s on s.id = p.supplier_id
  where p.id = p_purchase_id;
  if not found or v_pur.status <> 'cancelled' then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'purchase_cancel' and source_id = p_purchase_id) then
    return null;
  end if;

  select coalesce(sum(sp.amount), 0) into v_linked
  from public.supplier_payments sp where sp.purchase_id = p_purchase_id;

  v_lines := jsonb_build_array(
    public.acc_line(public.acc_account('payable'), v_pur.due_amount, 0,
                    'Due amount cancelled', null, v_pur.supplier_id),
    public.acc_line(public.acc_method_account(v_pur.payment_method),
                    greatest(v_pur.paid_amount - v_linked, 0), 0, 'Payment refunded by supplier'),
    public.acc_line(public.acc_account('inventory'), 0, v_pur.total - v_pur.tax_amount, 'Goods out of stock'),
    public.acc_line(public.acc_account('vat_input'), 0, v_pur.tax_amount, 'VAT reversed')
  );

  select v_lines || coalesce(jsonb_agg(public.acc_line(
           public.acc_method_account(sp.method), sum_amount, 0, 'Purchase payment refunded')), '[]'::jsonb)
    into v_lines
  from (select sp.method, sum(sp.amount) as sum_amount
        from public.supplier_payments sp
        where sp.purchase_id = p_purchase_id
        group by sp.method) sp;

  return public.acc_post(
    'purchase_cancel', p_purchase_id,
    public.acc_local_date(coalesce(v_pur.cancelled_at, v_pur.created_at)),
    coalesce(v_pur.cancelled_at, v_pur.created_at),
    'Purchase ' || v_pur.purchase_number || ' cancelled — ' || v_pur.supplier_name
      || coalesce(': ' || v_pur.cancel_reason, ''),
    v_lines, v_pur.purchase_number, v_pur.cancelled_by);
end;
$$;

-- ---------- SALES RETURN ----------
--  Dr Sales Returns   Dr VAT Collected
--      Cr Customer Receivables (customer)  — or Cr Cash for a walk-in refund
--  Dr Stock   Cr Cost of Goods Sold
create or replace function public.acc_post_sales_return(p_return_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ret  record;
  v_cogs numeric(14,2);
begin
  select sr.*, s.invoice_number, s.payment_method, c.name as customer_name into v_ret
  from public.sales_returns sr
  join public.sales s on s.id = sr.sale_id
  left join public.customers c on c.id = sr.customer_id
  where sr.id = p_return_id;
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'sales_return' and source_id = p_return_id) then
    return null;
  end if;

  select coalesce(round(sum(sri.quantity * coalesce(si.cost_price, 0)), 2), 0) into v_cogs
  from public.sales_return_items sri
  left join public.sale_items si
         on si.sale_id = v_ret.sale_id and si.product_id = sri.product_id
  where sri.sales_return_id = p_return_id;

  return public.acc_post(
    'sales_return', p_return_id,
    public.acc_local_date(v_ret.created_at), v_ret.created_at,
    'Sales return ' || v_ret.return_number || ' (invoice ' || v_ret.invoice_number || ') — '
      || coalesce(v_ret.customer_name, 'Walk-in customer'),
    jsonb_build_array(
      public.acc_line(public.acc_account('sales_returns'), v_ret.subtotal, 0, 'Goods returned'),
      public.acc_line(public.acc_account('vat_output'), v_ret.tax_amount, 0, 'VAT on returned goods'),
      case when v_ret.customer_id is not null
           then public.acc_line(public.acc_account('receivable'), 0, v_ret.total,
                                'Taken off what the customer owes', v_ret.customer_id)
           else public.acc_line(public.acc_method_account(v_ret.payment_method), 0, v_ret.total,
                                'Refunded to customer') end,
      public.acc_line(public.acc_account('inventory'), v_cogs, 0, 'Goods back in stock'),
      public.acc_line(public.acc_account('cogs'), 0, v_cogs, 'Cost reversed')
    ),
    v_ret.return_number, v_ret.user_id);
end;
$$;

-- ---------- PURCHASE RETURN ----------
--  Dr Supplier Payables   Cr Stock
create or replace function public.acc_post_purchase_return(p_return_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ret record;
begin
  select pr.*, p.purchase_number, coalesce(s.company, s.name) as supplier_name into v_ret
  from public.purchase_returns pr
  join public.purchases p on p.id = pr.purchase_id
  join public.suppliers s on s.id = pr.supplier_id
  where pr.id = p_return_id;
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'purchase_return' and source_id = p_return_id) then
    return null;
  end if;

  return public.acc_post(
    'purchase_return', p_return_id,
    public.acc_local_date(v_ret.created_at), v_ret.created_at,
    'Purchase return ' || v_ret.return_number || ' (purchase ' || v_ret.purchase_number || ') — '
      || v_ret.supplier_name,
    jsonb_build_array(
      public.acc_line(public.acc_account('payable'), v_ret.total, 0,
                      'Taken off what we owe', null, v_ret.supplier_id),
      public.acc_line(public.acc_account('inventory'), 0, v_ret.total, 'Goods sent back')
    ),
    v_ret.return_number, v_ret.user_id);
end;
$$;

-- ---------- CUSTOMER PAYMENT ----------
create or replace function public.acc_post_customer_payment(p_payment_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pay record;
begin
  select cp.*, c.name as customer_name, s.invoice_number into v_pay
  from public.customer_payments cp
  join public.customers c on c.id = cp.customer_id
  left join public.sales s on s.id = cp.sale_id
  where cp.id = p_payment_id;
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'customer_payment' and source_id = p_payment_id) then
    return null;
  end if;

  return public.acc_post(
    'customer_payment', p_payment_id,
    public.acc_local_date(v_pay.created_at), v_pay.created_at,
    'Payment received — ' || v_pay.customer_name
      || coalesce(' (invoice ' || v_pay.invoice_number || ')', ''),
    jsonb_build_array(
      public.acc_line(public.acc_method_account(v_pay.method), v_pay.amount, 0, 'Money received'),
      public.acc_line(public.acc_account('receivable'), 0, v_pay.amount,
                      'Paid by customer', v_pay.customer_id)
    ),
    v_pay.reference, v_pay.user_id);
end;
$$;

-- ---------- SUPPLIER PAYMENT ----------
create or replace function public.acc_post_supplier_payment(p_payment_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pay record;
begin
  select sp.*, coalesce(s.company, s.name) as supplier_name, p.purchase_number into v_pay
  from public.supplier_payments sp
  join public.suppliers s on s.id = sp.supplier_id
  left join public.purchases p on p.id = sp.purchase_id
  where sp.id = p_payment_id;
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'supplier_payment' and source_id = p_payment_id) then
    return null;
  end if;

  return public.acc_post(
    'supplier_payment', p_payment_id,
    public.acc_local_date(v_pay.created_at), v_pay.created_at,
    'Payment made — ' || v_pay.supplier_name
      || coalesce(' (purchase ' || v_pay.purchase_number || ')', ''),
    jsonb_build_array(
      public.acc_line(public.acc_account('payable'), v_pay.amount, 0,
                      'Paid to supplier', null, v_pay.supplier_id),
      public.acc_line(public.acc_method_account(v_pay.method), 0, v_pay.amount, 'Money paid')
    ),
    v_pay.reference, v_pay.user_id);
end;
$$;

-- ---------- EXPENSE ----------
--  Expenses can be edited and deleted, so their entry follows them:
--  edited → the same entry (same number) is rewritten, deleted → removed.
create or replace function public.acc_sync_expense(p_expense_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_exp     record;
  v_number  text;
  v_account uuid;
begin
  select entry_number into v_number
  from public.journal_entries
  where source_type = 'expense' and source_id = p_expense_id;

  delete from public.journal_entries
  where source_type = 'expense' and source_id = p_expense_id;

  select e.*, ec.name as category_name, ec.account_id into v_exp
  from public.expenses e
  join public.expense_categories ec on ec.id = e.category_id
  where e.id = p_expense_id;
  if not found then return null; end if;

  v_account := v_exp.account_id;
  if v_account is null then
    update public.expense_categories set account_id = null where id = v_exp.category_id
    returning account_id into v_account;
  end if;

  return public.acc_post(
    'expense', p_expense_id,
    v_exp.spent_on, v_exp.created_at,
    'Expense — ' || v_exp.category_name || coalesce(': ' || v_exp.description, ''),
    jsonb_build_array(
      public.acc_line(v_account, v_exp.amount, 0, v_exp.category_name),
      public.acc_line(public.acc_method_account(v_exp.method), 0, v_exp.amount, 'Money paid')
    ),
    null, v_exp.user_id, v_number);
end;
$$;

-- ---------- STOCK WRITE-OFF / COUNT / OPENING STOCK ----------
--  Valued at the product's average cost (purchase price if it has none).
create or replace function public.acc_post_stock_movement(p_movement_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_mov   record;
  v_value numeric(14,2);
  v_label text;
  v_other uuid;
begin
  select sm.*, p.name as product_name,
         case when p.avg_cost > 0 then p.avg_cost else p.purchase_price end as unit_cost
    into v_mov
  from public.stock_movements sm
  join public.products p on p.id = sm.product_id
  where sm.id = p_movement_id
    and sm.movement_type in ('adjustment','damage','lost','initial');
  if not found then return null; end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'stock_adjustment' and source_id = p_movement_id) then
    return null;
  end if;

  v_value := round(abs(v_mov.quantity_change) * coalesce(v_mov.unit_cost, 0), 2);
  if v_value <= 0 then return null; end if;

  v_label := case v_mov.movement_type
    when 'initial' then 'Opening stock'
    when 'damage' then 'Damaged stock written off'
    when 'lost' then 'Lost stock written off'
    else 'Stock count adjustment' end;

  if v_mov.quantity_change > 0 then
    v_other := public.acc_account(case when v_mov.movement_type = 'initial'
                                       then 'opening_equity' else 'stock_gain' end);
  else
    v_other := public.acc_account('stock_loss');
  end if;

  return public.acc_post(
    'stock_adjustment', p_movement_id,
    public.acc_local_date(v_mov.created_at), v_mov.created_at,
    v_label || ' — ' || v_mov.product_name
      || case when v_mov.movement_type <> 'initial' and v_mov.reason is not null
              then ': ' || v_mov.reason else '' end,
    case when v_mov.quantity_change > 0 then jsonb_build_array(
      public.acc_line(public.acc_account('inventory'), v_value, 0, 'Goods into stock'),
      public.acc_line(v_other, 0, v_value, v_label))
    else jsonb_build_array(
      public.acc_line(v_other, v_value, 0, v_label),
      public.acc_line(public.acc_account('inventory'), 0, v_value, 'Goods out of stock')) end,
    null, v_mov.user_id);
end;
$$;

-- =============================================================
--  POST EXISTING HISTORY  (oldest first, so entry numbers follow time)
-- =============================================================
do $$
declare
  ev record;
begin
  for ev in
    select * from (
      select created_at as at, 1 as ord, 'sale' as kind, id from public.sales
      union all
      select coalesce(cancelled_at, created_at), 2, 'sale_cancel', id
        from public.sales where status = 'cancelled'
      union all
      select created_at, 1, 'purchase', id from public.purchases
      union all
      select coalesce(cancelled_at, created_at), 2, 'purchase_cancel', id
        from public.purchases where status = 'cancelled'
      union all
      select created_at, 3, 'sales_return', id from public.sales_returns
      union all
      select created_at, 3, 'purchase_return', id from public.purchase_returns
      union all
      select created_at, 4, 'customer_payment', id from public.customer_payments
      union all
      select created_at, 4, 'supplier_payment', id from public.supplier_payments
      union all
      select created_at, 5, 'expense', id from public.expenses
      union all
      select created_at, 0, 'stock_adjustment', id from public.stock_movements
        where movement_type in ('adjustment','damage','lost','initial')
    ) events
    order by at, ord
  loop
    case ev.kind
      when 'sale' then perform public.acc_post_sale(ev.id);
      when 'sale_cancel' then perform public.acc_post_sale_cancel(ev.id);
      when 'purchase' then perform public.acc_post_purchase(ev.id);
      when 'purchase_cancel' then perform public.acc_post_purchase_cancel(ev.id);
      when 'sales_return' then perform public.acc_post_sales_return(ev.id);
      when 'purchase_return' then perform public.acc_post_purchase_return(ev.id);
      when 'customer_payment' then perform public.acc_post_customer_payment(ev.id);
      when 'supplier_payment' then perform public.acc_post_supplier_payment(ev.id);
      when 'expense' then
        if not exists (select 1 from public.journal_entries
                        where source_type = 'expense' and source_id = ev.id) then
          perform public.acc_sync_expense(ev.id);
        end if;
      when 'stock_adjustment' then perform public.acc_post_stock_movement(ev.id);
    end case;
  end loop;
end $$;

-- Opening balances: whatever the history above cannot explain (stock
-- given to products before movements were recorded, balances edited
-- by hand, …) is brought in once, so the books start out matching the
-- products, customers and suppliers screens exactly.
do $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_diff  numeric(14,2);
  v_net   numeric(14,2) := 0;
  r       record;
begin
  if exists (select 1 from public.journal_entries where source_type = 'opening') then
    return;
  end if;

  -- stock value
  select round(coalesce((select sum(p.stock * p.avg_cost) from public.products p), 0), 2)
       - coalesce((select sum(jl.debit - jl.credit) from public.journal_lines jl
                    where jl.account_id = public.acc_account('inventory')), 0)
    into v_diff;
  if v_diff <> 0 then
    v_lines := v_lines || jsonb_build_array(public.acc_line(public.acc_account('inventory'),
                 greatest(v_diff, 0), greatest(-v_diff, 0), 'Stock value at start'));
    v_net := v_net + v_diff;
  end if;

  -- each customer's balance
  for r in
    select c.id, c.balance_due
           - coalesce((select sum(jl.debit - jl.credit) from public.journal_lines jl
                        where jl.customer_id = c.id
                          and jl.account_id = public.acc_account('receivable')), 0) as diff
    from public.customers c
  loop
    if r.diff <> 0 then
      v_lines := v_lines || jsonb_build_array(public.acc_line(public.acc_account('receivable'),
                   greatest(r.diff, 0), greatest(-r.diff, 0), 'Customer balance at start', r.id));
      v_net := v_net + r.diff;
    end if;
  end loop;

  -- each supplier's balance (a credit balance on the payable account)
  for r in
    select s.id, s.balance_payable
           - coalesce((select sum(jl.credit - jl.debit) from public.journal_lines jl
                        where jl.supplier_id = s.id
                          and jl.account_id = public.acc_account('payable')), 0) as diff
    from public.suppliers s
  loop
    if r.diff <> 0 then
      v_lines := v_lines || jsonb_build_array(public.acc_line(public.acc_account('payable'),
                   greatest(-r.diff, 0), greatest(r.diff, 0), 'Supplier balance at start', null, r.id));
      v_net := v_net - r.diff;
    end if;
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    return;
  end if;

  v_lines := v_lines || jsonb_build_array(public.acc_line(public.acc_account('opening_equity'),
               greatest(-v_net, 0), greatest(v_net, 0), 'Balancing figure'));

  perform public.acc_post(
    'opening', null,
    public.acc_local_date(now()), now(),
    'Opening balances brought into the books when accounting was switched on',
    v_lines);
end $$;

-- Check now that every entry written above balances, instead of at the
-- end of the file (matters when the whole file runs as one transaction).
set constraints all immediate;

-- =============================================================
--  TRIGGERS — post the moment a document is saved.
--  They run when the transaction commits, so a sale's items (written
--  after the sale row) are already there and back-dated demo data
--  gets the right date.
-- =============================================================
create or replace function public.acc_trg_post()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text := tg_argv[0];
begin
  case v_kind
    when 'sale' then perform public.acc_post_sale(new.id);
    when 'sale_cancel' then perform public.acc_post_sale_cancel(new.id);
    when 'purchase' then perform public.acc_post_purchase(new.id);
    when 'purchase_cancel' then perform public.acc_post_purchase_cancel(new.id);
    when 'sales_return' then perform public.acc_post_sales_return(new.id);
    when 'purchase_return' then perform public.acc_post_purchase_return(new.id);
    when 'customer_payment' then perform public.acc_post_customer_payment(new.id);
    when 'supplier_payment' then perform public.acc_post_supplier_payment(new.id);
    when 'stock_adjustment' then perform public.acc_post_stock_movement(new.id);
    when 'expense' then perform public.acc_sync_expense(coalesce(new.id, old.id));
  end case;
  return null;
end;
$$;

drop trigger if exists acc_post_sale on public.sales;
create constraint trigger acc_post_sale
  after insert on public.sales
  deferrable initially deferred
  for each row execute function public.acc_trg_post('sale');

drop trigger if exists acc_post_sale_cancel on public.sales;
create constraint trigger acc_post_sale_cancel
  after update of status on public.sales
  deferrable initially deferred
  for each row when (old.status = 'completed' and new.status = 'cancelled')
  execute function public.acc_trg_post('sale_cancel');

drop trigger if exists acc_post_purchase on public.purchases;
create constraint trigger acc_post_purchase
  after insert on public.purchases
  deferrable initially deferred
  for each row execute function public.acc_trg_post('purchase');

drop trigger if exists acc_post_purchase_cancel on public.purchases;
create constraint trigger acc_post_purchase_cancel
  after update of status on public.purchases
  deferrable initially deferred
  for each row when (old.status = 'completed' and new.status = 'cancelled')
  execute function public.acc_trg_post('purchase_cancel');

drop trigger if exists acc_post_sales_return on public.sales_returns;
create constraint trigger acc_post_sales_return
  after insert on public.sales_returns
  deferrable initially deferred
  for each row execute function public.acc_trg_post('sales_return');

drop trigger if exists acc_post_purchase_return on public.purchase_returns;
create constraint trigger acc_post_purchase_return
  after insert on public.purchase_returns
  deferrable initially deferred
  for each row execute function public.acc_trg_post('purchase_return');

drop trigger if exists acc_post_customer_payment on public.customer_payments;
create constraint trigger acc_post_customer_payment
  after insert on public.customer_payments
  deferrable initially deferred
  for each row execute function public.acc_trg_post('customer_payment');

drop trigger if exists acc_post_supplier_payment on public.supplier_payments;
create constraint trigger acc_post_supplier_payment
  after insert on public.supplier_payments
  deferrable initially deferred
  for each row execute function public.acc_trg_post('supplier_payment');

drop trigger if exists acc_post_stock_adjustment on public.stock_movements;
create constraint trigger acc_post_stock_adjustment
  after insert on public.stock_movements
  deferrable initially deferred
  for each row when (new.movement_type in ('adjustment','damage','lost','initial'))
  execute function public.acc_trg_post('stock_adjustment');

drop trigger if exists acc_sync_expense on public.expenses;
create constraint trigger acc_sync_expense
  after insert or update or delete on public.expenses
  deferrable initially deferred
  for each row execute function public.acc_trg_post('expense');

-- =============================================================
--  MANUAL ENTRIES  (owner: capital, drawings, loans, bank deposits …)
--  p_lines: [{"account_id": "...", "debit": 500, "credit": 0, "memo": "..."}]
-- =============================================================
create or replace function public.create_journal_entry(
  p_entry_date date,
  p_narration  text,
  p_lines      jsonb,
  p_reference  text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_narration text := nullif(trim(coalesce(p_narration, '')), '');
  v_today     date := public.acc_local_date(now());
  v_line      record;
  v_dr        numeric(14,2) := 0;
  v_cr        numeric(14,2) := 0;
  v_count     integer := 0;
  v_account   record;
  v_entry_id  uuid;
begin
  perform public.require_permission('accounting.write');

  if v_narration is null then
    raise exception 'Write what this entry is for (the narration).';
  end if;
  if p_entry_date is null then
    raise exception 'Choose the date of the entry.';
  end if;
  if p_entry_date > v_today then
    raise exception 'The entry date cannot be in the future.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'An entry needs at least two lines: one debit and one credit.';
  end if;

  for v_line in
    select x.account_id, round(coalesce(x.debit, 0), 2) as debit,
           round(coalesce(x.credit, 0), 2) as credit
    from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric)
  loop
    if v_line.debit < 0 or v_line.credit < 0 then
      raise exception 'Each line needs either a debit or a credit amount, not both, and never below zero.';
    end if;
    if v_line.debit = 0 and v_line.credit = 0 then
      continue;  -- empty rows in the form are ignored
    end if;
    if v_line.debit > 0 and v_line.credit > 0 then
      raise exception 'Each line needs either a debit or a credit amount, not both.';
    end if;

    select id, name, is_active, allow_manual into v_account
    from public.accounts where id = v_line.account_id;
    if not found then
      raise exception 'Account not found. Choose the account again.';
    end if;
    if not v_account.is_active then
      raise exception 'The account "%" is switched off. Switch it on in the chart of accounts or choose another one.',
        v_account.name;
    end if;
    if not v_account.allow_manual then
      raise exception 'The account "%" is kept up to date automatically by sales, purchases, payments and stock changes, so it cannot be used in a manual entry.',
        v_account.name;
    end if;

    v_dr := v_dr + v_line.debit;
    v_cr := v_cr + v_line.credit;
    v_count := v_count + 1;
  end loop;

  if v_count < 2 or v_dr = 0 or v_cr = 0 then
    raise exception 'An entry needs at least two lines: one debit and one credit.';
  end if;
  if v_dr <> v_cr then
    raise exception 'Debits (Rs. %) and credits (Rs. %) must be equal. The difference is Rs. %.',
      v_dr, v_cr, abs(v_dr - v_cr);
  end if;

  v_entry_id := public.acc_post(
    'manual', null, p_entry_date, now(), v_narration,
    (select jsonb_agg(public.acc_line(x.account_id, x.debit, x.credit, left(x.memo, 200)))
       from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric, memo text)),
    left(p_reference, 60));

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'entry_number', (select entry_number from public.journal_entries where id = v_entry_id),
    'total', v_dr);
end;
$$;

-- Undo a manual entry by posting the opposite entry (history is kept).
create or replace function public.reverse_journal_entry(p_entry_id uuid, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_entry  record;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_new_id uuid;
begin
  perform public.require_permission('accounting.write');

  if v_reason is null then
    raise exception 'Please write a reason for reversing this entry.';
  end if;

  select * into v_entry from public.journal_entries where id = p_entry_id for update;
  if not found then
    raise exception 'Journal entry not found.';
  end if;
  if v_entry.source_type <> 'manual' then
    raise exception 'Only manual entries can be reversed here. Entries made by sales, purchases, payments or expenses change when you cancel, return or edit that document.';
  end if;
  if exists (select 1 from public.journal_entries
              where source_type = 'reversal' and source_id = p_entry_id) then
    raise exception 'This entry was already reversed.';
  end if;

  v_new_id := public.acc_post(
    'reversal', p_entry_id, public.acc_local_date(now()), now(),
    'Reversal of ' || v_entry.entry_number || ': ' || v_reason,
    (select jsonb_agg(public.acc_line(jl.account_id, jl.credit, jl.debit, jl.memo,
                                      jl.customer_id, jl.supplier_id) order by jl.line_no)
       from public.journal_lines jl where jl.entry_id = p_entry_id),
    v_entry.entry_number);

  return jsonb_build_object(
    'entry_id', v_new_id,
    'entry_number', (select entry_number from public.journal_entries where id = v_new_id));
end;
$$;

-- Add or edit an account in the chart of accounts.
create or replace function public.save_account(
  p_id          uuid,
  p_code        text,
  p_name        text,
  p_type        text,
  p_description text default null,
  p_is_active   boolean default true
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code    text := nullif(trim(coalesce(p_code, '')), '');
  v_name    text := nullif(trim(coalesce(p_name, '')), '');
  v_current record;
  v_balance numeric(14,2);
  v_id      uuid;
begin
  perform public.require_permission('accounting.write');

  if v_code is null or v_code !~ '^[0-9A-Za-z.-]{1,12}$' then
    raise exception 'Enter an account code of up to 12 letters or numbers (for example 5210).';
  end if;
  if v_name is null or length(v_name) > 80 then
    raise exception 'Enter the account name (up to 80 characters).';
  end if;
  if p_type is null or p_type not in ('asset','liability','equity','income','expense') then
    raise exception 'Choose the account type.';
  end if;
  if exists (select 1 from public.accounts
              where lower(code) = lower(v_code) and id is distinct from p_id) then
    raise exception 'Another account already uses the code %. Choose a different code.', v_code;
  end if;
  if exists (select 1 from public.accounts
              where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Another account is already called "%". Choose a different name.', v_name;
  end if;

  if p_id is null then
    insert into public.accounts (code, name, type, description, is_active)
    values (v_code, v_name, p_type::public.account_type,
            nullif(trim(coalesce(p_description, '')), ''), coalesce(p_is_active, true))
    returning id into v_id;
    return jsonb_build_object('account_id', v_id);
  end if;

  select * into v_current from public.accounts where id = p_id for update;
  if not found then
    raise exception 'Account not found. Choose the account again.';
  end if;

  if v_current.type::text <> p_type then
    if v_current.system_key is not null then
      raise exception 'Built-in accounts cannot change type.';
    end if;
    if exists (select 1 from public.journal_lines where account_id = p_id) then
      raise exception 'This account already has entries, so its type cannot be changed. Make a new account instead.';
    end if;
  end if;

  if v_current.is_active and not coalesce(p_is_active, true) then
    if v_current.system_key is not null then
      raise exception 'Built-in accounts cannot be switched off — the app posts to them.';
    end if;
    if exists (select 1 from public.expense_categories where account_id = p_id and is_active) then
      raise exception 'This account belongs to an expense category that is still in use, so it cannot be switched off.';
    end if;
    select coalesce(sum(debit - credit), 0) into v_balance
    from public.journal_lines where account_id = p_id;
    if v_balance <> 0 then
      raise exception 'This account still has a balance of Rs. %. Move the balance to another account with a journal entry before switching it off.',
        abs(v_balance);
    end if;
  end if;

  update public.accounts
     set code = v_code,
         name = v_name,
         type = p_type::public.account_type,
         description = nullif(trim(coalesce(p_description, '')), ''),
         is_active = coalesce(p_is_active, true)
   where id = p_id;

  return jsonb_build_object('account_id', p_id);
end;
$$;

-- Bring the Stock account in line with the products' stock value
-- (average-cost rounding and cancelled purchases make them drift a little).
create or replace function public.post_stock_revaluation()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_stock numeric(14,2);
  v_books numeric(14,2);
  v_diff  numeric(14,2);
  v_id    uuid;
begin
  perform public.require_permission('accounting.write');

  -- one at a time, so two clicks cannot post the difference twice
  perform pg_advisory_xact_lock(987654322);

  select round(coalesce(sum(stock * avg_cost), 0), 2) into v_stock from public.products;
  select coalesce(sum(debit - credit), 0) into v_books
  from public.journal_lines where account_id = public.acc_account('inventory');
  v_diff := v_stock - v_books;

  if v_diff = 0 then
    raise exception 'Stock value already matches the books. Nothing to post.';
  end if;

  v_id := public.acc_post(
    'stock_revaluation', null, public.acc_local_date(now()), now(),
    'Stock value brought in line with product costs',
    case when v_diff > 0 then jsonb_build_array(
      public.acc_line(public.acc_account('inventory'), v_diff, 0, 'Stock value increased'),
      public.acc_line(public.acc_account('stock_gain'), 0, v_diff, 'Stock revaluation'))
    else jsonb_build_array(
      public.acc_line(public.acc_account('stock_loss'), -v_diff, 0, 'Stock revaluation'),
      public.acc_line(public.acc_account('inventory'), 0, -v_diff, 'Stock value reduced')) end);

  return jsonb_build_object(
    'entry_id', v_id,
    'entry_number', (select entry_number from public.journal_entries where id = v_id),
    'difference', v_diff);
end;
$$;

-- =============================================================
--  REPORTS
-- =============================================================

-- Balance on the account's normal side: assets/expenses = Dr − Cr,
-- liabilities/equity/income = Cr − Dr.
create or replace function public.acc_natural(p_type public.account_type, p_debit numeric, p_credit numeric)
returns numeric
language sql immutable
as $$
  select case when p_type in ('asset','expense')
              then coalesce(p_debit, 0) - coalesce(p_credit, 0)
              else coalesce(p_credit, 0) - coalesce(p_debit, 0) end;
$$;

-- every account with its totals up to a date (null = everything)
create or replace function public.report_account_balances(p_as_of date default null)
returns table (
  account_id   uuid,
  code         text,
  name         text,
  type         text,
  description  text,
  system_key   text,
  allow_manual boolean,
  is_active    boolean,
  debit        numeric,
  credit       numeric,
  balance      numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('accounting.view');
  return query
  select a.id, a.code, a.name, a.type::text, a.description, a.system_key,
         a.allow_manual, a.is_active,
         coalesce(t.dr, 0), coalesce(t.cr, 0),
         public.acc_natural(a.type, t.dr, t.cr)
  from public.accounts a
  left join (
    select jl.account_id, sum(jl.debit) as dr, sum(jl.credit) as cr
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where p_as_of is null or je.entry_date <= p_as_of
    group by jl.account_id
  ) t on t.account_id = a.id
  order by a.code;
end;
$$;

-- Trial balance for a period: movement in the period and the closing
-- balance on the debit or credit side.  Both pairs of totals must agree.
create or replace function public.report_trial_balance(p_from date, p_to date)
returns table (
  account_id     uuid,
  code           text,
  name           text,
  type           text,
  period_debit   numeric,
  period_credit  numeric,
  closing_debit  numeric,
  closing_credit numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('accounting.view');
  return query
  with t as (
    select jl.account_id,
           sum(jl.debit) filter (where je.entry_date between p_from and p_to) as pdr,
           sum(jl.credit) filter (where je.entry_date between p_from and p_to) as pcr,
           sum(jl.debit - jl.credit) as net
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where je.entry_date <= p_to
    group by jl.account_id
  )
  select a.id, a.code, a.name, a.type::text,
         coalesce(t.pdr, 0), coalesce(t.pcr, 0),
         greatest(t.net, 0), greatest(-t.net, 0)
  from t
  join public.accounts a on a.id = t.account_id
  where coalesce(t.pdr, 0) <> 0 or coalesce(t.pcr, 0) <> 0 or t.net <> 0
  order by a.code;
end;
$$;

-- Income and expense accounts for a period (amounts on their normal side).
create or replace function public.report_income_statement(p_from date, p_to date)
returns table (
  account_id uuid,
  code       text,
  name       text,
  type       text,
  amount     numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('accounting.view');
  return query
  select a.id, a.code, a.name, a.type::text,
         public.acc_natural(a.type, sum(jl.debit), sum(jl.credit))
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  join public.accounts a on a.id = jl.account_id
  where a.type in ('income','expense')
    and je.entry_date between p_from and p_to
  group by a.id, a.code, a.name, a.type
  having sum(jl.debit) <> sum(jl.credit)
  order by a.type desc, a.code;  -- income first
end;
$$;

-- Assets, liabilities and equity on a date.  The profit not yet moved
-- to capital is shown as its own equity line, so the two sides agree.
create or replace function public.report_balance_sheet(p_as_of date)
returns table (
  account_id uuid,
  code       text,
  name       text,
  type       text,
  amount     numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('accounting.view');
  return query
  with t as (
    select jl.account_id, sum(jl.debit) as dr, sum(jl.credit) as cr
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where je.entry_date <= p_as_of
    group by jl.account_id
  )
  select a.id, a.code, a.name, a.type::text, public.acc_natural(a.type, t.dr, t.cr)
  from t
  join public.accounts a on a.id = t.account_id
  where a.type in ('asset','liability','equity')
    and t.dr <> t.cr
  union all
  select null::uuid, ''::text, 'Profit to date (not yet moved to capital)'::text, 'equity'::text,
         coalesce(sum(t.cr - t.dr), 0)  -- income minus expenses
  from t
  join public.accounts a on a.id = t.account_id
  where a.type in ('income','expense')
  order by 4, 2;
end;
$$;

-- One account, line by line, with an opening balance and running balance
-- (balance is Dr − Cr: positive = debit balance).
create or replace function public.report_account_ledger(p_account_id uuid, p_from date, p_to date)
returns table (
  entry_id     uuid,
  entry_number text,
  entry_date   date,
  narration    text,
  memo         text,
  party        text,
  source_type  text,
  debit        numeric,
  credit       numeric,
  balance      numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_permission('accounting.view');
  return query
  with opening as (
    select coalesce(sum(jl.debit - jl.credit), 0) as amount
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where jl.account_id = p_account_id and je.entry_date < p_from
  ),
  lines as (
    select null::uuid as eid, null::text as num, p_from as d,
           'Opening balance'::text as what, null::text as note, null::text as who,
           null::text as src, 0::numeric as dr, 0::numeric as cr,
           '-infinity'::timestamptz as at, 0 as ln
    union all
    select je.id, je.entry_number, je.entry_date, je.narration, jl.memo,
           coalesce(c.name, coalesce(s.company, s.name)),
           je.source_type, jl.debit, jl.credit, je.created_at, jl.line_no
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    left join public.customers c on c.id = jl.customer_id
    left join public.suppliers s on s.id = jl.supplier_id
    where jl.account_id = p_account_id
      and je.entry_date between p_from and p_to
  )
  select l.eid, l.num, l.d, l.what, l.note, l.who, l.src, l.dr, l.cr,
         (select o.amount from opening o)
           + sum(l.dr - l.cr) over (order by l.d, l.at, l.num, l.ln rows unbounded preceding)
  from lines l
  order by l.d, l.at, l.num, l.ln;
end;
$$;

-- Numbers for the accounting home page, plus a check that the books
-- agree with the stock, customer and supplier screens.
create or replace function public.accounting_overview(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_bal        jsonb;
  v_income     numeric := 0;
  v_expense    numeric := 0;
  v_stock      numeric;
  v_books_stock numeric;
  v_dues       numeric;
  v_books_ar   numeric;
  v_payable    numeric;
  v_books_ap   numeric;
  v_unbalanced integer;
  v_entries    integer;
begin
  perform public.require_permission('accounting.view');

  select coalesce(jsonb_object_agg(a.system_key,
           public.acc_natural(a.type, t.dr, t.cr)), '{}'::jsonb)
    into v_bal
  from public.accounts a
  left join (select jl.account_id, sum(jl.debit) as dr, sum(jl.credit) as cr
             from public.journal_lines jl group by jl.account_id) t on t.account_id = a.id
  where a.system_key is not null;

  select coalesce(sum(jl.credit - jl.debit) filter (where a.type = 'income'), 0),
         coalesce(sum(jl.debit - jl.credit) filter (where a.type = 'expense'), 0)
    into v_income, v_expense
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  join public.accounts a on a.id = jl.account_id
  where je.entry_date between p_from and p_to;

  select round(coalesce(sum(stock * avg_cost), 0), 2) into v_stock from public.products;
  select coalesce(sum(balance_due), 0) into v_dues from public.customers;
  select coalesce(sum(balance_payable), 0) into v_payable from public.suppliers;

  v_books_stock := coalesce((v_bal ->> 'inventory')::numeric, 0);
  v_books_ar    := coalesce((v_bal ->> 'receivable')::numeric, 0);
  v_books_ap    := coalesce((v_bal ->> 'payable')::numeric, 0);

  select count(*) into v_unbalanced
  from (select je.id
        from public.journal_entries je
        left join public.journal_lines jl on jl.entry_id = je.id
        group by je.id
        having coalesce(sum(jl.debit), 0) <> coalesce(sum(jl.credit), 0)
            or count(jl.id) < 2) x;

  select count(*) into v_entries
  from public.journal_entries where entry_date between p_from and p_to;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'balances', v_bal,
    'income', v_income,
    'expenses', v_expense,
    'profit', v_income - v_expense,
    'entries', v_entries,
    'unbalanced_entries', v_unbalanced,
    'checks', jsonb_build_array(
      jsonb_build_object('key', 'stock', 'label', 'Stock value',
                         'app', v_stock, 'books', v_books_stock),
      jsonb_build_object('key', 'receivable', 'label', 'Customers owe',
                         'app', v_dues, 'books', v_books_ar),
      jsonb_build_object('key', 'payable', 'label', 'You owe suppliers',
                         'app', v_payable, 'books', v_books_ap)
    )
  );
end;
$$;

-- =============================================================
--  PERMISSIONS
-- =============================================================
insert into public.permissions (code, description) values
  ('accounting.view',  'See the accounting books (journal, ledger, balance sheet)'),
  ('accounting.write', 'Make journal entries and manage the chart of accounts')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code) values
  ('owner', 'accounting.view'),
  ('owner', 'accounting.write')
on conflict do nothing;

-- ---------- audit: chart of accounts + entries typed in by people ----------
drop trigger if exists audit_accounts on public.accounts;
create trigger audit_accounts after insert or update on public.accounts
  for each row execute function public.fn_audit('account');

drop trigger if exists audit_journal_entries on public.journal_entries;
create trigger audit_journal_entries after insert on public.journal_entries
  for each row
  when (new.source_type in ('manual','reversal','stock_revaluation'))
  execute function public.fn_audit('journal_entry');

-- ---------- function access ----------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'acc\_%' or p.proname in (
        'gen_journal_number','create_journal_entry','reverse_journal_entry',
        'save_account','post_stock_revaluation','report_account_balances',
        'report_trial_balance','report_income_statement','report_balance_sheet',
        'report_account_ledger','accounting_overview'))
  loop
    execute format('revoke execute on function %s from anon, authenticated, public', fn.sig);
    if fn.proname in ('create_journal_entry','reverse_journal_entry','save_account',
                      'post_stock_revaluation','report_account_balances',
                      'report_trial_balance','report_income_statement',
                      'report_balance_sheet','report_account_ledger','accounting_overview') then
      execute format('grant execute on function %s to authenticated', fn.sig);
    end if;
  end loop;
end $$;

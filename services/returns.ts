import { createClient } from '@/lib/supabase/server';
import type {
  Customer,
  Profile,
  Purchase,
  PurchaseReturn,
  Sale,
  SalesReturn,
  Supplier,
} from '@/types/database';

function sanitizeSearch(value: string): string {
  return value.replace(/[,%()\\]/g, ' ').trim().slice(0, 80);
}

export type ReturnKind = 'sales' | 'purchase';

export interface ReturnListParams {
  kind: ReturnKind;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export interface ReturnListRow {
  id: string;
  kind: ReturnKind;
  return_number: string;
  created_at: string;
  total: number;
  reason: string | null;
  /** invoice or purchase number it was returned against */
  source_number: string | null;
  source_id: string;
  party_name: string | null;
  made_by: string | null;
}

/** Customer returns (sales) or returns to suppliers (purchase), newest first. */
export async function listReturns(params: ReturnListParams) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const rangeFrom = (page - 1) * perPage;
  const search = params.search ? sanitizeSearch(params.search) : '';

  if (params.kind === 'sales') {
    let query = supabase
      .from('sales_returns')
      .select(
        '*, sale:sales(id, invoice_number), customer:customers(id, name), profile:profiles(id, full_name)',
        { count: 'exact' }
      );
    if (search) {
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .ilike('invoice_number', `%${search}%`)
        .limit(20);
      const clauses = [`return_number.ilike.%${search}%`, `reason.ilike.%${search}%`];
      if (sales && sales.length > 0) clauses.push(`sale_id.in.(${sales.map((s) => s.id).join(',')})`);
      query = query.or(clauses.join(','));
    }
    if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+05:45`);
    if (params.to) query = query.lte('created_at', `${params.to}T23:59:59+05:45`);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(rangeFrom, rangeFrom + perPage - 1);
    if (error) throw new Error(error.message);

    type Row = SalesReturn & {
      sale: Pick<Sale, 'id' | 'invoice_number'> | null;
      customer: Pick<Customer, 'id' | 'name'> | null;
      profile: Pick<Profile, 'id' | 'full_name'> | null;
    };
    const rows: ReturnListRow[] = ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      kind: 'sales',
      return_number: r.return_number,
      created_at: r.created_at,
      total: Number(r.total),
      reason: r.reason,
      source_number: r.sale?.invoice_number ?? null,
      source_id: r.sale_id,
      party_name: r.customer?.name ?? (r.customer_id ? null : 'Walk-in customer'),
      made_by: r.profile?.full_name ?? null,
    }));
    return paged(rows, count, page, perPage);
  }

  let query = supabase
    .from('purchase_returns')
    .select(
      '*, purchase:purchases(id, purchase_number), supplier:suppliers(id, name, company), profile:profiles(id, full_name)',
      { count: 'exact' }
    );
  if (search) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id')
      .ilike('purchase_number', `%${search}%`)
      .limit(20);
    const clauses = [`return_number.ilike.%${search}%`, `reason.ilike.%${search}%`];
    if (purchases && purchases.length > 0) {
      clauses.push(`purchase_id.in.(${purchases.map((p) => p.id).join(',')})`);
    }
    query = query.or(clauses.join(','));
  }
  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+05:45`);
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59+05:45`);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeFrom + perPage - 1);
  if (error) throw new Error(error.message);

  type Row = PurchaseReturn & {
    purchase: Pick<Purchase, 'id' | 'purchase_number'> | null;
    supplier: Pick<Supplier, 'id' | 'name' | 'company'> | null;
    profile: Pick<Profile, 'id' | 'full_name'> | null;
  };
  const rows: ReturnListRow[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    kind: 'purchase',
    return_number: r.return_number,
    created_at: r.created_at,
    total: Number(r.total),
    reason: r.reason,
    source_number: r.purchase?.purchase_number ?? null,
    source_id: r.purchase_id,
    party_name: r.supplier ? (r.supplier.company ?? r.supplier.name) : null,
    made_by: r.profile?.full_name ?? null,
  }));
  return paged(rows, count, page, perPage);
}

function paged<T>(rows: T[], count: number | null, page: number, perPage: number) {
  return {
    rows,
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

// -------------------------------------------------------------
//  One return (either kind), with its items
// -------------------------------------------------------------
export interface ReturnLine {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit_name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface ReturnDetail {
  kind: ReturnKind;
  id: string;
  return_number: string;
  created_at: string;
  reason: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  source: { id: string; number: string; created_at: string } | null;
  party: { id: string; name: string; phone: string | null; address: string | null } | null;
  made_by: string | null;
  items: ReturnLine[];
}

interface RawItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product: { name: string; sku: string; unit: { name: string } | null } | null;
}

function toLines(items: RawItem[] | null): ReturnLine[] {
  return (items ?? []).map((item) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name ?? 'Product',
    sku: item.product?.sku ?? '',
    unit_name: item.product?.unit?.name ?? null,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    line_total: Number(item.line_total),
  }));
}

const ITEM_PRODUCT = 'product:products(name, sku, unit:units(name))';

export async function getReturn(id: string): Promise<ReturnDetail | null> {
  const supabase = await createClient();

  const { data: salesReturn, error: salesError } = await supabase
    .from('sales_returns')
    .select(
      `*, sale:sales(id, invoice_number, created_at),
       customer:customers(id, name, phone, address),
       profile:profiles(full_name),
       items:sales_return_items(id, product_id, quantity, unit_price, line_total, ${ITEM_PRODUCT})`
    )
    .eq('id', id)
    .maybeSingle();
  if (salesError) throw new Error(salesError.message);

  if (salesReturn) {
    const r = salesReturn as unknown as SalesReturn & {
      sale: { id: string; invoice_number: string; created_at: string } | null;
      customer: Pick<Customer, 'id' | 'name' | 'phone' | 'address'> | null;
      profile: { full_name: string } | null;
      items: RawItem[];
    };
    return {
      kind: 'sales',
      id: r.id,
      return_number: r.return_number,
      created_at: r.created_at,
      reason: r.reason,
      subtotal: Number(r.subtotal),
      tax_amount: Number(r.tax_amount),
      total: Number(r.total),
      source: r.sale ? { id: r.sale.id, number: r.sale.invoice_number, created_at: r.sale.created_at } : null,
      party: r.customer,
      made_by: r.profile?.full_name ?? null,
      items: toLines(r.items),
    };
  }

  const { data: purchaseReturn, error: purchaseError } = await supabase
    .from('purchase_returns')
    .select(
      `*, purchase:purchases(id, purchase_number, created_at),
       supplier:suppliers(id, name, company, phone, address),
       profile:profiles(full_name),
       items:purchase_return_items(id, product_id, quantity, unit_price, line_total, ${ITEM_PRODUCT})`
    )
    .eq('id', id)
    .maybeSingle();
  if (purchaseError) throw new Error(purchaseError.message);
  if (!purchaseReturn) return null;

  const r = purchaseReturn as unknown as PurchaseReturn & {
    purchase: { id: string; purchase_number: string; created_at: string } | null;
    supplier: Pick<Supplier, 'id' | 'name' | 'company' | 'phone' | 'address'> | null;
    profile: { full_name: string } | null;
    items: RawItem[];
  };
  return {
    kind: 'purchase',
    id: r.id,
    return_number: r.return_number,
    created_at: r.created_at,
    reason: r.reason,
    subtotal: Number(r.total),
    tax_amount: 0,
    total: Number(r.total),
    source: r.purchase
      ? { id: r.purchase.id, number: r.purchase.purchase_number, created_at: r.purchase.created_at }
      : null,
    party: r.supplier
      ? {
          id: r.supplier.id,
          name: r.supplier.company ?? r.supplier.name,
          phone: r.supplier.phone,
          address: r.supplier.address,
        }
      : null,
    made_by: r.profile?.full_name ?? null,
    items: toLines(r.items),
  };
}

// -------------------------------------------------------------
//  What can still be returned from an invoice / purchase
// -------------------------------------------------------------
export interface ReturnableLine {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  allow_decimal: boolean;
  /** sold / bought (base unit for purchases) */
  quantity: number;
  already_returned: number;
  returnable: number;
  /** refund per unit (sales: selling price; purchases: effective cost) */
  unit_price: number;
  /** sales only: VAT charged on the whole line */
  line_tax: number;
  /** purchases only: what is left in stock now */
  stock: number;
}

export interface ReturnableSale {
  sale: Sale & { customer: Pick<Customer, 'id' | 'name'> | null };
  lines: ReturnableLine[];
}

export async function getReturnableSale(saleId: string): Promise<ReturnableSale | null> {
  const supabase = await createClient();
  const { data: sale, error } = await supabase
    .from('sales')
    .select('*, customer:customers(id, name)')
    .eq('id', saleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sale) return null;

  const [{ data: items, error: itemsError }, { data: returned, error: returnedError }] =
    await Promise.all([
      supabase
        .from('sale_items')
        .select('product_id, quantity, unit_price, tax_amount, product:products(name, sku, stock, unit:units(name, allow_decimal))')
        .eq('sale_id', saleId),
      supabase
        .from('sales_return_items')
        .select('product_id, quantity, sales_return:sales_returns!inner(sale_id)')
        .eq('sales_return.sale_id', saleId),
    ]);
  if (itemsError) throw new Error(itemsError.message);
  if (returnedError) throw new Error(returnedError.message);

  const returnedBy = sumBy((returned ?? []) as { product_id: string; quantity: number }[]);

  type Item = {
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_amount: number;
    product: { name: string; sku: string; stock: number; unit: { name: string; allow_decimal: boolean } | null } | null;
  };
  const lines = ((items ?? []) as unknown as Item[]).map((item) => {
    const already = returnedBy.get(item.product_id) ?? 0;
    return {
      product_id: item.product_id,
      name: item.product?.name ?? 'Product',
      sku: item.product?.sku ?? '',
      unit: item.product?.unit?.name ?? '',
      allow_decimal: item.product?.unit?.allow_decimal ?? false,
      quantity: Number(item.quantity),
      already_returned: already,
      returnable: Math.max(0, round3(Number(item.quantity) - already)),
      unit_price: Number(item.unit_price),
      line_tax: Number(item.tax_amount),
      stock: Number(item.product?.stock ?? 0),
    };
  });

  return { sale: sale as unknown as ReturnableSale['sale'], lines };
}

export interface ReturnablePurchase {
  purchase: Purchase & { supplier: Pick<Supplier, 'id' | 'name' | 'company'> | null };
  lines: ReturnableLine[];
}

export async function getReturnablePurchase(purchaseId: string): Promise<ReturnablePurchase | null> {
  const supabase = await createClient();
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('*, supplier:suppliers(id, name, company)')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!purchase) return null;

  const [{ data: items, error: itemsError }, { data: returned, error: returnedError }] =
    await Promise.all([
      supabase
        .from('purchase_items')
        .select('product_id, base_quantity, line_total, product:products(name, sku, stock, unit:units(name, allow_decimal))')
        .eq('purchase_id', purchaseId),
      supabase
        .from('purchase_return_items')
        .select('product_id, quantity, purchase_return:purchase_returns!inner(purchase_id)')
        .eq('purchase_return.purchase_id', purchaseId),
    ]);
  if (itemsError) throw new Error(itemsError.message);
  if (returnedError) throw new Error(returnedError.message);

  const returnedBy = sumBy((returned ?? []) as { product_id: string; quantity: number }[]);

  // The database returns goods per product in the base unit, at the
  // effective cost of this purchase (line totals / base quantity).
  type Item = {
    product_id: string;
    base_quantity: number;
    line_total: number;
    product: { name: string; sku: string; stock: number; unit: { name: string; allow_decimal: boolean } | null } | null;
  };
  const grouped = new Map<string, { qty: number; value: number; item: Item }>();
  for (const item of (items ?? []) as unknown as Item[]) {
    const current = grouped.get(item.product_id);
    grouped.set(item.product_id, {
      qty: (current?.qty ?? 0) + Number(item.base_quantity),
      value: (current?.value ?? 0) + Number(item.line_total),
      item,
    });
  }

  const lines: ReturnableLine[] = [...grouped.entries()].map(([productId, { qty, value, item }]) => {
    const already = returnedBy.get(productId) ?? 0;
    return {
      product_id: productId,
      name: item.product?.name ?? 'Product',
      sku: item.product?.sku ?? '',
      unit: item.product?.unit?.name ?? '',
      allow_decimal: item.product?.unit?.allow_decimal ?? false,
      quantity: round3(qty),
      already_returned: already,
      returnable: Math.max(0, round3(qty - already)),
      unit_price: qty > 0 ? Math.round((value / qty) * 10000) / 10000 : 0,
      line_tax: 0,
      stock: Number(item.product?.stock ?? 0),
    };
  });

  return { purchase: purchase as unknown as ReturnablePurchase['purchase'], lines };
}

function sumBy(rows: { product_id: string; quantity: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.product_id, round3((map.get(row.product_id) ?? 0) + Number(row.quantity)));
  }
  return map;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

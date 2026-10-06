import { createClient } from '@/lib/supabase/server';
import type {
  Customer,
  Profile,
  SalesReturn,
  Sale,
  SaleItemWithProduct,
} from '@/types/database';

function sanitizeSearch(value: string): string {
  return value.replace(/[,%()\\]/g, ' ').trim().slice(0, 80);
}

export interface SaleListParams {
  search?: string;
  from?: string;
  to?: string;
  status?: 'all' | 'completed' | 'cancelled';
  customer_id?: string;
  page?: number;
  perPage?: number;
}

export async function listSales(params: SaleListParams = {}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('sales')
    .select(
      `*,
       customer:customers(id, name, phone),
       profile:profiles!sales_user_id_fkey(id, full_name)`,
      { count: 'exact' }
    );

  const search = params.search ? sanitizeSearch(params.search) : '';
  if (search) {
    // search invoice/notes directly; customer names need a second lookup
    // because sales may have no customer (walk-in)
    const { data: matchedCustomers } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', `%${search}%`)
      .limit(10);

    const clauses = [
      `invoice_number.ilike.%${search}%`,
      `notes.ilike.%${search}%`,
    ];
    if (matchedCustomers && matchedCustomers.length > 0) {
      clauses.push(`customer_id.in.(${matchedCustomers.map((c) => c.id).join(',')})`);
    }
    query = query.or(clauses.join(','));
  }
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.customer_id) query = query.eq('customer_id', params.customer_id);
  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+05:45`);
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59+05:45`);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as (Sale & {
      customer: Pick<Customer, 'id' | 'name' | 'phone'> | null;
      profile: Pick<Profile, 'id' | 'full_name'> | null;
    })[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

export interface SaleDetail {
  sale: Sale & {
    customer: Customer | null;
    profile: Pick<Profile, 'id' | 'full_name'> | null;
  };
  items: SaleItemWithProduct[];
  returns: SalesReturn[];
}

export async function getSale(id: string): Promise<SaleDetail | null> {
  const supabase = await createClient();

  const { data: sale, error } = await supabase
    .from('sales')
    .select('*, customer:customers(*), profile:profiles!sales_user_id_fkey(id, full_name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sale) return null;

  const [{ data: items, error: itemsError }, { data: returns, error: returnsError }] =
    await Promise.all([
      supabase
        .from('sale_items')
        .select('*, product:products(id, name, sku, unit_id, unit:units(name))')
        .eq('sale_id', id)
        .order('created_at'),
      supabase
        .from('sales_returns')
        .select('*')
        .eq('sale_id', id)
        .order('created_at', { ascending: false }),
    ]);

  if (itemsError) throw new Error(itemsError.message);
  if (returnsError) throw new Error(returnsError.message);

  return {
    sale: sale as unknown as SaleDetail['sale'],
    items: (items ?? []) as unknown as SaleItemWithProduct[],
    returns: (returns ?? []) as SalesReturn[],
  };
}

/** Invoices that still have an outstanding amount (for payment screens). */
export async function listOpenInvoicesForCustomer(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .gt('due_amount', 0)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Sale[];
}

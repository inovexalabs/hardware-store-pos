import { createClient } from '@/lib/supabase/server';
import type {
  Customer,
  CustomerPayment,
  Profile,
  Purchase,
  Sale,
  StatementRow,
  Supplier,
  SupplierPayment,
} from '@/types/database';

function sanitizeSearch(value: string): string {
  return value.replace(/[,%()\\]/g, ' ').trim().slice(0, 80);
}

// =============================================================
//  CUSTOMERS
// =============================================================
export interface CustomerListParams {
  search?: string;
  dueOnly?: boolean;
  activeOnly?: boolean;
  page?: number;
  perPage?: number;
}

export async function listCustomers(params: CustomerListParams = {}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' });

  const search = params.search ? sanitizeSearch(params.search) : '';
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`);
  }
  if (params.dueOnly) query = query.gt('balance_due', 0);
  if (params.activeOnly) query = query.eq('is_active', true);

  const { data, count, error } = await query
    .order('name')
    .range(from, from + perPage - 1);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as Customer[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

export interface CustomerDetail {
  customer: Customer;
  purchases: Sale[];
  payments: (CustomerPayment & { profile: Pick<Profile, 'full_name'> | null })[];
  /** Completed invoices, all time */
  invoiceCount: number;
  /** Completed invoices total, all time */
  totalSales: number;
  /** All payments received after the sale, all time */
  totalPaid: number;
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return null;

  const [
    { data: sales, error: salesError },
    { data: payments, error: paymentsError },
    { data: allSales, count: invoiceCount },
    { data: allPayments },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('customer_payments')
      .select('*, profile:profiles(full_name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    // lifetime totals (only the amount columns, so this stays light)
    supabase
      .from('sales')
      .select('total', { count: 'exact' })
      .eq('customer_id', id)
      .eq('status', 'completed')
      .range(0, 9999),
    supabase.from('customer_payments').select('amount').eq('customer_id', id).range(0, 9999),
  ]);
  if (salesError) throw new Error(salesError.message);
  if (paymentsError) throw new Error(paymentsError.message);

  const totalSales = (allSales ?? []).reduce((sum, s) => sum + Number(s.total), 0);
  const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    customer: customer as Customer,
    purchases: (sales ?? []) as Sale[],
    payments: (payments ?? []) as CustomerDetail['payments'],
    invoiceCount: invoiceCount ?? 0,
    totalSales,
    totalPaid,
  };
}

export async function getCustomerStatement(
  customerId: string,
  from: string,
  to: string
): Promise<StatementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_customer_statement', {
    p_customer_id: customerId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatementRow[];
}

export async function listCustomerPayments(customerId: string): Promise<CustomerPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerPayment[];
}

// =============================================================
//  SUPPLIERS
// =============================================================
export interface SupplierListParams {
  search?: string;
  payableOnly?: boolean;
  activeOnly?: boolean;
  page?: number;
  perPage?: number;
}

export async function listSuppliers(params: SupplierListParams = {}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('suppliers')
    .select('*', { count: 'exact' });

  const search = params.search ? sanitizeSearch(params.search) : '';
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }
  if (params.payableOnly) query = query.gt('balance_payable', 0);
  if (params.activeOnly) query = query.eq('is_active', true);

  const { data, count, error } = await query
    .order('name')
    .range(from, from + perPage - 1);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as Supplier[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

export interface SupplierDetail {
  supplier: Supplier;
  purchases: Purchase[];
  payments: (SupplierPayment & { profile: Pick<Profile, 'full_name'> | null })[];
  /** Completed purchases, all time */
  purchaseCount: number;
  /** Completed purchases total, all time */
  totalPurchases: number;
  /** All payments made after the purchase, all time */
  totalPaid: number;
}

export async function getSupplier(id: string): Promise<SupplierDetail | null> {
  const supabase = await createClient();

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!supplier) return null;

  const [
    { data: purchases, error: purchasesError },
    { data: payments, error: paymentsError },
    { data: allPurchases, count: purchaseCount },
    { data: allPayments },
  ] = await Promise.all([
    supabase
      .from('purchases')
      .select('*')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('supplier_payments')
      .select('*, profile:profiles(full_name)')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('purchases')
      .select('total', { count: 'exact' })
      .eq('supplier_id', id)
      .eq('status', 'completed')
      .range(0, 9999),
    supabase.from('supplier_payments').select('amount').eq('supplier_id', id).range(0, 9999),
  ]);
  if (purchasesError) throw new Error(purchasesError.message);
  if (paymentsError) throw new Error(paymentsError.message);

  const totalPurchases = (allPurchases ?? []).reduce((sum, p) => sum + Number(p.total), 0);
  const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    supplier: supplier as Supplier,
    purchases: (purchases ?? []) as Purchase[],
    payments: (payments ?? []) as SupplierDetail['payments'],
    purchaseCount: purchaseCount ?? 0,
    totalPurchases,
    totalPaid,
  };
}

export async function getSupplierStatement(
  supplierId: string,
  from: string,
  to: string
): Promise<StatementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_supplier_statement', {
    p_supplier_id: supplierId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatementRow[];
}

export async function listOpenBillsForSupplier(supplierId: string): Promise<Purchase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('status', 'completed')
    .gt('due_amount', 0)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Purchase[];
}

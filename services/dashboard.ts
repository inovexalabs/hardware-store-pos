import { createClient } from '@/lib/supabase/server';
import type {
  DashboardSummary,
  ProductListItem,
  Purchase,
  Sale,
  StockMovementWithDetails,
} from '@/types/database';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_summary');
  if (error) throw new Error(error.message);
  return data as DashboardSummary;
}

export interface RecentActivity {
  sales: (Sale & {
    customer: { name: string } | null;
    profile: { full_name: string } | null;
  })[];
  purchases: (Purchase & {
    supplier: { name: string; company: string | null } | null;
    profile: { full_name: string } | null;
  })[];
  movements: StockMovementWithDetails[];
}

export async function getRecentActivity(limit = 6): Promise<RecentActivity> {
  const supabase = await createClient();

  const [sales, purchases, movements] = await Promise.all([
    supabase
      .from('sales')
      .select('*, customer:customers(name), profile:profiles!sales_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('purchases')
      .select('*, supplier:suppliers(name, company), profile:profiles!purchases_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('stock_movements')
      .select('*, product:products(name, sku), profile:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (sales.error) throw new Error(sales.error.message);
  if (purchases.error) throw new Error(purchases.error.message);
  if (movements.error) throw new Error(movements.error.message);

  return {
    sales: (sales.data ?? []) as unknown as RecentActivity['sales'],
    purchases: (purchases.data ?? []) as unknown as RecentActivity['purchases'],
    movements: (movements.data ?? []) as unknown as RecentActivity['movements'],
  };
}

export interface DashboardAlert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  text: string;
  href: string;
}

/** Alerts are derived from the same numbers shown on the dashboard. */
export function buildAlerts(summary: DashboardSummary): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const inv = summary.inventory;

  if (inv.out_of_stock > 0) {
    alerts.push({
      id: 'out-of-stock',
      type: 'danger',
      text:
        inv.out_of_stock === 1
          ? '1 product is out of stock.'
          : `${inv.out_of_stock} products are out of stock.`,
      href: '/products?stock=out',
    });
  }
  if (inv.low_stock > 0) {
    alerts.push({
      id: 'low-stock',
      type: 'warning',
      text:
        inv.low_stock === 1
          ? '1 product is low in stock.'
          : `${inv.low_stock} products are low in stock.`,
      href: '/products?stock=low',
    });
  }
  if (summary.overdue_payments && summary.overdue_payments > 0) {
    alerts.push({
      id: 'overdue',
      type: 'warning',
      text:
        summary.overdue_payments === 1
          ? '1 customer payment is overdue (more than 14 days).'
          : `${summary.overdue_payments} customer payments are overdue (more than 14 days).`,
      href: '/customers?due=1',
    });
  }
  if (summary.today.customer_due && summary.today.customer_due > 0) {
    alerts.push({
      id: 'customer-due',
      type: 'info',
      text: `Customers owe Rs. ${Number(summary.today.customer_due).toLocaleString('en-IN')}.`,
      href: '/reports?tab=balances',
    });
  }

  return alerts;
}

/** Low stock rows shown on the dashboard (worst first). */
export async function getLowStockProducts(limit = 5): Promise<ProductListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      '*, category:categories(id, name), brand:brands(id, name), unit:units(id, name, allow_decimal), supplier:suppliers(id, name, company)'
    )
    .eq('is_active', true)
    .order('stock', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ProductListItem[];
  return rows
    .filter((p) => Number(p.stock) <= Number(p.min_stock))
    .slice(0, limit);
}

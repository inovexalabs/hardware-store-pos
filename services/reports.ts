import { createClient } from '@/lib/supabase/server';
import type {
  CustomerDueRow,
  ExpensesByCategoryRow,
  LowStockRow,
  ProductPurchaseRow,
  PurchasesByDayRow,
  PurchasesBySupplierRow,
  PurchasesTotals,
  SalesByCategoryRow,
  SalesByCustomerRow,
  SalesByDayRow,
  SalesByPaymentRow,
  SalesByProductRow,
  SalesTotals,
  SlowMovingRow,
  StockMovementReportRow,
  StockValuationRow,
  SupplierPayableRow,
} from '@/types/database';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Sales ----------
export const getSalesTotals = (from: string, to: string) =>
  rpc<SalesTotals>('report_sales_totals', { p_from: from, p_to: to });

export const getSalesByDay = (from: string, to: string) =>
  rpc<SalesByDayRow[]>('report_sales_by_day', { p_from: from, p_to: to });

export const getSalesByProduct = (from: string, to: string) =>
  rpc<SalesByProductRow[]>('report_sales_by_product', { p_from: from, p_to: to });

export const getSalesByCategory = (from: string, to: string) =>
  rpc<SalesByCategoryRow[]>('report_sales_by_category', { p_from: from, p_to: to });

export const getSalesByCustomer = (from: string, to: string) =>
  rpc<SalesByCustomerRow[]>('report_sales_by_customer', { p_from: from, p_to: to });

export const getSalesByPaymentMethod = (from: string, to: string) =>
  rpc<SalesByPaymentRow[]>('report_sales_by_payment_method', { p_from: from, p_to: to });

// ---------- Purchases ----------
export const getPurchasesTotals = (from: string, to: string) =>
  rpc<PurchasesTotals>('report_purchases_totals', { p_from: from, p_to: to });

export const getPurchasesByDay = (from: string, to: string) =>
  rpc<PurchasesByDayRow[]>('report_purchases_by_day', { p_from: from, p_to: to });

export const getPurchasesBySupplier = (from: string, to: string) =>
  rpc<PurchasesBySupplierRow[]>('report_purchases_by_supplier', { p_from: from, p_to: to });

export const getProductPurchases = (productId: string, from: string, to: string) =>
  rpc<ProductPurchaseRow[]>('report_product_purchases', {
    p_product_id: productId,
    p_from: from,
    p_to: to,
  });

// ---------- Inventory ----------
export const getStockValuation = () => rpc<StockValuationRow[]>('report_stock_valuation', {});

export const getLowStockReport = () => rpc<LowStockRow[]>('report_low_stock', {});

export const getStockMovements = (from: string, to: string, productId?: string | null) =>
  rpc<StockMovementReportRow[]>('report_stock_movements', {
    p_from: from,
    p_to: to,
    p_product_id: productId ?? null,
  });

export const getSlowMoving = (days = 90) =>
  rpc<SlowMovingRow[]>('report_slow_moving', { p_days: days });

// ---------- Financial ----------
export const getExpensesByCategory = (from: string, to: string) =>
  rpc<ExpensesByCategoryRow[]>('report_expenses_by_category', { p_from: from, p_to: to });

export const getCustomerDues = () => rpc<CustomerDueRow[]>('report_customer_dues', {});

export const getSupplierPayables = () =>
  rpc<SupplierPayableRow[]>('report_supplier_payables', {});

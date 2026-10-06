// =============================================================
//  Inovexa Labs — Hardware Shop POS
//  Database row types (mirror the SQL schema 1:1)
// =============================================================

export type UserRole = 'owner' | 'manager' | 'cashier' | 'inventory';
export type PaymentMethod = 'cash' | 'bank' | 'wallet' | 'credit';
export type TxStatus = 'completed' | 'cancelled';
export type ReceiptSize = '58mm' | '80mm' | 'a4';
export type MovementType =
  | 'purchase'
  | 'sale'
  | 'sales_return'
  | 'purchase_return'
  | 'damage'
  | 'lost'
  | 'adjustment'
  | 'initial';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  name: string;
  allow_decimal: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitConversion {
  id: string;
  product_id: string;
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  pan_vat: string | null;
  notes: string | null;
  balance_payable: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  credit_limit: number;
  notes: string | null;
  balance_due: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  brand_id: string | null;
  unit_id: string;
  supplier_id: string | null;
  purchase_price: number;
  selling_price: number;
  wholesale_price: number;
  stock: number;
  min_stock: number;
  avg_cost: number;
  rack: string | null;
  tax_rate: number;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Product joined with the display fields the UI needs */
export type ProductListItem = Product & {
  category: Pick<Category, 'id' | 'name'> | null;
  brand: Pick<Brand, 'id' | 'name'> | null;
  unit: Pick<Unit, 'id' | 'name' | 'allow_decimal'>;
  supplier: Pick<Supplier, 'id' | 'name' | 'company'> | null;
};

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  user_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  /** Paid when the bill was created (paid_amount also grows with later payments). */
  initial_paid: number;
  payment_method: PaymentMethod;
  status: TxStatus;
  notes: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
}

export interface SaleItemWithProduct extends SaleItem {
  product: Pick<Product, 'id' | 'name' | 'sku' | 'unit_id'> & {
    unit: Pick<Unit, 'name'> | null;
  };
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_invoice_no: string | null;
  supplier_id: string;
  user_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  /** Paid when the bill was created (paid_amount also grows with later payments). */
  initial_paid: number;
  payment_method: PaymentMethod;
  status: TxStatus;
  notes: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_id: string;
  base_quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
}

export interface PurchaseItemWithProduct extends PurchaseItem {
  product: Pick<Product, 'id' | 'name' | 'sku'> & {
    unit: Pick<Unit, 'name'> | null;
  };
  unit: Pick<Unit, 'name' | 'allow_decimal'>;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  sale_id: string;
  customer_id: string | null;
  user_id: string | null;
  reason: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
}

export interface SalesReturnItem {
  id: string;
  sales_return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  purchase_id: string;
  supplier_id: string;
  user_id: string | null;
  reason: string | null;
  total: number;
  created_at: string;
}

export interface PurchaseReturnItem {
  id: string;
  purchase_return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  sale_id: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  purchase_id: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  category_id: string;
  amount: number;
  spent_on: string;
  method: PaymentMethod;
  description: string | null;
  receipt_url: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithCategory extends Expense {
  category: Pick<ExpenseCategory, 'id' | 'name'>;
}

export interface StockMovement {
  id: string;
  product_id: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  movement_type: MovementType;
  reason: string | null;
  user_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface StockMovementWithDetails extends StockMovement {
  product: Pick<Product, 'id' | 'name' | 'sku'> | null;
  profile: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface HeldSale {
  id: string;
  title: string;
  customer_id: string | null;
  items: HeldSaleItem[];
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Cart line stored inside a held sale */
export interface HeldSaleItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  stock: number;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogWithUser extends AuditLog {
  profile: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

export interface ShopSettings {
  id: boolean;
  shop_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  pan_vat: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  purchase_prefix: string;
  receipt_size: ReceiptSize;
  tax_enabled: boolean;
  tax_rate: number;
  invoice_footer: string;
  allow_negative_stock: boolean;
  onboarding_done: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface Permission {
  code: string;
  description: string;
}

export interface RolePermission {
  role: UserRole;
  permission_code: string;
}

// -------------------------------------------------------------
//  RPC result shapes
// -------------------------------------------------------------

export interface CreateSaleResult {
  sale_id: string;
  invoice_number: string;
  total: number;
  paid: number;
  due: number;
}

export interface CreatePurchaseResult {
  purchase_id: string;
  purchase_number: string;
  total: number;
  paid: number;
  due: number;
}

export interface CreateReturnResult {
  return_id: string;
  return_number: string;
  subtotal?: number;
  tax?: number;
  total: number;
}

export interface PaymentResult {
  payment_id: string;
  amount: number;
  balance_due?: number;
  balance_payable?: number;
}

export interface AdjustStockResult {
  product_id: string;
  previous_stock: number;
  new_stock: number;
}

export interface DashboardSummary {
  today: {
    sales: number;
    sales_count: number;
    purchases: number;
    profit: number;
    customer_due: number | null;
    supplier_payable: number | null;
  };
  inventory: {
    products: number;
    low_stock: number;
    out_of_stock: number;
    stock_value: number;
  };
  overdue_payments: number | null;
}

export interface SalesTotals {
  from: string;
  to: string;
  revenue: number;
  gross_revenue: number;
  vat_collected: number;
  returns: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  sales_count: number;
}

export interface PurchasesTotals {
  from: string;
  to: string;
  total: number;
  paid: number;
  due: number;
  count: number;
}

export interface SalesByDayRow {
  day: string;
  sales_count: number;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface SalesByProductRow {
  product_id: string;
  product_name: string;
  category_name: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface SalesByCategoryRow {
  category_name: string;
  sales_count: number;
  revenue: number;
  profit: number;
}

export interface SalesByCustomerRow {
  customer_id: string | null;
  customer_name: string;
  sales_count: number;
  revenue: number;
  due_amount: number;
}

export interface SalesByPaymentRow {
  method: string;
  sales_count: number;
  total: number;
  paid: number;
  due: number;
}

export interface PurchasesByDayRow {
  day: string;
  purchases_count: number;
  total: number;
  paid: number;
  due: number;
}

export interface PurchasesBySupplierRow {
  supplier_id: string;
  supplier_name: string;
  purchases_count: number;
  total: number;
  paid: number;
  due: number;
}

export interface ProductPurchaseRow {
  purchase_number: string;
  supplier_name: string;
  purchased_on: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface StockValuationRow {
  product_id: string;
  product_name: string;
  sku: string;
  category_name: string;
  stock: number;
  unit_name: string;
  avg_cost: number;
  stock_value: number;
  min_stock: number;
  rack: string;
}

export interface LowStockRow {
  product_id: string;
  product_name: string;
  sku: string;
  stock: number;
  min_stock: number;
  unit_name: string;
  status: 'Low Stock' | 'Out of Stock';
}

export interface StockMovementReportRow {
  created_at: string;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  made_by: string;
  reference: string;
}

export interface SlowMovingRow {
  product_id: string;
  product_name: string;
  stock: number;
  stock_value: number;
  last_sold_on: string | null;
  days_no_sale: number;
}

export interface ExpensesByCategoryRow {
  category_name: string;
  entries: number;
  total: number;
}

export interface CustomerDueRow {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  balance_due: number;
  credit_limit: number;
  oldest_due_on: string | null;
}

export interface SupplierPayableRow {
  supplier_id: string;
  supplier_name: string;
  phone: string | null;
  balance_payable: number;
  oldest_due_on: string | null;
}

export interface StatementRow {
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

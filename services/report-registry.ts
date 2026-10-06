// =============================================================
//  Every report the shop can open, print or download.
//  One definition drives the screen, the printout and the CSV,
//  so the three can never disagree.
// =============================================================
import {
  getCustomerDues,
  getExpensesByCategory,
  getLowStockReport,
  getPurchasesByDay,
  getPurchasesBySupplier,
  getSalesByCategory,
  getSalesByCustomer,
  getSalesByDay,
  getSalesByPaymentMethod,
  getSalesByProduct,
  getSalesTotals,
  getSlowMoving,
  getStockMovements,
  getStockValuation,
  getSupplierPayables,
} from '@/services/reports';
import { getBalanceSheet, getIncomeStatement, getTrialBalance } from '@/services/accounting';
import { ACCOUNT_TYPE_SINGULAR, ledgerHref } from '@/lib/accounting';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { AccountAmountRow, AccountType, UserRole } from '@/types/database';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatQty,
  formatRs,
  paymentMethodLabel,
} from '@/utils/format';

export type ReportGroup = 'sales' | 'purchases' | 'inventory' | 'financial' | 'accounting';

export const REPORT_GROUPS: { value: ReportGroup; label: string }[] = [
  { value: 'sales', label: 'Sales & Profit' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'inventory', label: 'Stock' },
  { value: 'financial', label: 'Money Owed & Expenses' },
  { value: 'accounting', label: 'Accounting' },
];

export type ColumnKind = 'text' | 'money' | 'number' | 'qty' | 'date' | 'datetime';

export type ReportRow = Record<string, unknown>;

export interface ReportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  /** add a total for this column under the table */
  total?: boolean;
  /** qty columns: row key holding the unit name */
  unitKey?: string;
  /** custom display text (screen and print) */
  display?: (row: ReportRow) => string;
  /** make the cell a link on screen */
  href?: (row: ReportRow) => string | null;
}

export type RowTone = 'heading' | 'total';

export interface ReportArgs {
  from: string;
  to: string;
  days: number;
}

export interface ReportDefinition {
  kind: string;
  title: string;
  description: string;
  group: ReportGroup;
  /** false = a snapshot of right now (no date range) */
  usesRange: boolean;
  /** slow-moving stock: "not sold in N days" */
  usesDays?: boolean;
  /** one "as of" date (the range's end), e.g. the balance sheet */
  asOf?: boolean;
  /** who may open it (default: reports.view) */
  permission?: Permission;
  /** headings and subtotals inside the table are shown in bold */
  rowTone?: (row: ReportRow) => RowTone | undefined;
  columns: ReportColumn[];
  load: (args: ReportArgs) => Promise<ReportRow[]>;
  emptyMessage: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  sales_return: 'Sales return',
  purchase_return: 'Purchase return',
  adjustment: 'Adjustment',
  damage: 'Damage',
  lost: 'Lost',
  initial: 'Opening stock',
};

const productLink = (row: ReportRow) => (row.product_id ? `/products/${row.product_id}` : null);
const asRows = <T,>(rows: T[] | null | undefined) => (rows ?? []) as unknown as ReportRow[];

// ---------- accounting statements: headings, account lines, subtotals ----------
const toneOf = (row: ReportRow) => row._tone as RowTone | undefined;
const linkOf = (row: ReportRow) => (row._href as string | null | undefined) ?? null;
const roundRs = (n: number) => Math.round(n * 100) / 100;
const moneyOrBlank = (key: string) => (row: ReportRow) =>
  Number(row[key]) ? formatRs(Number(row[key])) : '';

const headingRow = (name: string): ReportRow => ({ code: '', name, amount: null, _tone: 'heading' });
const totalRow = (name: string, amount: number): ReportRow => ({
  code: '',
  name,
  amount: roundRs(amount),
  _tone: 'total',
});

function accountSection(
  title: string,
  totalLabel: string,
  rows: AccountAmountRow[],
  link: (accountId: string) => string
): { rows: ReportRow[]; total: number } {
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  return {
    total,
    rows: [
      headingRow(title),
      ...rows.map((row) => ({
        code: row.code,
        name: row.name,
        amount: Number(row.amount),
        _href: row.account_id ? link(row.account_id) : null,
      })),
      totalRow(totalLabel, total),
    ],
  };
}

const ofType = (rows: AccountAmountRow[], type: AccountType) => rows.filter((row) => row.type === type);

const STATEMENT_COLUMNS: ReportColumn[] = [
  { key: 'code', label: 'Code', kind: 'text', display: (row) => String(row.code ?? '') },
  { key: 'name', label: 'Account', kind: 'text', href: linkOf },
  {
    key: 'amount',
    label: 'Amount',
    kind: 'money',
    display: (row) => (toneOf(row) === 'heading' ? '' : formatRs(Number(row.amount))),
  },
];

export const REPORTS: ReportDefinition[] = [
  // ------------------------------ SALES ------------------------------
  {
    kind: 'profit-loss',
    title: 'Profit & Loss',
    description: 'What you sold, what it cost you, your expenses and what is left as profit. VAT is not counted as income.',
    group: 'sales',
    usesRange: true,
    columns: [
      { key: 'item', label: 'Item', kind: 'text' },
      { key: 'amount', label: 'Amount', kind: 'money' },
    ],
    load: async ({ from, to }) => {
      const t = await getSalesTotals(from, to);
      return [
        { item: `Sales (${formatNumber(t.sales_count)} invoices, without VAT)`, amount: t.gross_revenue },
        { item: 'Less: goods returned by customers', amount: -Number(t.returns) },
        { item: 'Net sales', amount: t.revenue },
        { item: 'Less: cost of the goods sold', amount: -Number(t.cogs) },
        { item: 'Gross profit', amount: t.gross_profit },
        { item: 'Less: shop expenses', amount: -Number(t.expenses) },
        { item: 'Net profit', amount: t.net_profit },
        { item: 'VAT collected (owed to the government, not income)', amount: t.vat_collected },
      ];
    },
    emptyMessage: 'No sales or expenses in this period.',
  },
  {
    kind: 'sales-by-day',
    title: 'Daily Sales',
    description: 'Sales, cost and profit for each day (returns already taken off).',
    group: 'sales',
    usesRange: true,
    columns: [
      { key: 'day', label: 'Date', kind: 'date' },
      { key: 'sales_count', label: 'Invoices', kind: 'number', total: true },
      { key: 'revenue', label: 'Sales', kind: 'money', total: true },
      { key: 'cogs', label: 'Cost', kind: 'money', total: true },
      { key: 'profit', label: 'Profit', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getSalesByDay(from, to)),
    emptyMessage: 'No sales in this period.',
  },
  {
    kind: 'sales-by-product',
    title: 'Sales by Product',
    description: 'Which items sell the most, and how much each one earns you.',
    group: 'sales',
    usesRange: true,
    columns: [
      { key: 'product_name', label: 'Product', kind: 'text', href: productLink },
      { key: 'category_name', label: 'Category', kind: 'text' },
      { key: 'quantity', label: 'Qty sold', kind: 'qty' },
      { key: 'revenue', label: 'Sales', kind: 'money', total: true },
      { key: 'cogs', label: 'Cost', kind: 'money', total: true },
      { key: 'profit', label: 'Profit', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getSalesByProduct(from, to)),
    emptyMessage: 'No products were sold in this period.',
  },
  {
    kind: 'sales-by-category',
    title: 'Sales by Category',
    description: 'Sales and profit for each product category.',
    group: 'sales',
    usesRange: true,
    columns: [
      { key: 'category_name', label: 'Category', kind: 'text' },
      { key: 'sales_count', label: 'Invoices', kind: 'number' },
      { key: 'revenue', label: 'Sales', kind: 'money', total: true },
      { key: 'profit', label: 'Profit', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getSalesByCategory(from, to)),
    emptyMessage: 'No sales in this period.',
  },
  {
    kind: 'sales-by-customer',
    title: 'Sales by Customer',
    description: 'Your best customers, and what each still owes from this period.',
    group: 'sales',
    usesRange: true,
    columns: [
      {
        key: 'customer_name',
        label: 'Customer',
        kind: 'text',
        href: (row) => (row.customer_id ? `/customers/${row.customer_id}` : null),
      },
      { key: 'sales_count', label: 'Invoices', kind: 'number', total: true },
      { key: 'revenue', label: 'Sales', kind: 'money', total: true },
      { key: 'due_amount', label: 'Still due', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getSalesByCustomer(from, to)),
    emptyMessage: 'No sales in this period.',
  },
  {
    kind: 'sales-by-payment',
    title: 'Sales by Payment Method',
    description: 'How customers paid: cash, bank, wallet or credit. Use it to match your cash drawer.',
    group: 'sales',
    usesRange: true,
    columns: [
      { key: 'method', label: 'Paid by', kind: 'text', display: (row) => paymentMethodLabel(String(row.method)) },
      { key: 'sales_count', label: 'Invoices', kind: 'number', total: true },
      { key: 'total', label: 'Bill total', kind: 'money', total: true },
      { key: 'paid', label: 'Paid at counter', kind: 'money', total: true },
      { key: 'due', label: 'Still due', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getSalesByPaymentMethod(from, to)),
    emptyMessage: 'No sales in this period.',
  },

  // ---------------------------- PURCHASES ----------------------------
  {
    kind: 'purchases-by-day',
    title: 'Daily Purchases',
    description: 'Stock bought each day, and how much of it is still unpaid.',
    group: 'purchases',
    usesRange: true,
    columns: [
      { key: 'day', label: 'Date', kind: 'date' },
      { key: 'purchases_count', label: 'Purchases', kind: 'number', total: true },
      { key: 'total', label: 'Total', kind: 'money', total: true },
      { key: 'paid', label: 'Paid', kind: 'money', total: true },
      { key: 'due', label: 'Due', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getPurchasesByDay(from, to)),
    emptyMessage: 'No purchases in this period.',
  },
  {
    kind: 'purchases-by-supplier',
    title: 'Purchases by Supplier',
    description: 'How much you bought from each supplier.',
    group: 'purchases',
    usesRange: true,
    columns: [
      {
        key: 'supplier_name',
        label: 'Supplier',
        kind: 'text',
        href: (row) => (row.supplier_id ? `/suppliers/${row.supplier_id}` : null),
      },
      { key: 'purchases_count', label: 'Purchases', kind: 'number', total: true },
      { key: 'total', label: 'Total', kind: 'money', total: true },
      { key: 'paid', label: 'Paid', kind: 'money', total: true },
      { key: 'due', label: 'Due', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getPurchasesBySupplier(from, to)),
    emptyMessage: 'No purchases in this period.',
  },

  // ---------------------------- INVENTORY ----------------------------
  {
    kind: 'stock-valuation',
    title: 'Stock Value',
    description: 'Everything in the shop right now and what it cost you (average cost).',
    group: 'inventory',
    usesRange: false,
    columns: [
      { key: 'product_name', label: 'Product', kind: 'text', href: productLink },
      { key: 'sku', label: 'Item code', kind: 'text' },
      { key: 'category_name', label: 'Category', kind: 'text' },
      { key: 'stock', label: 'In stock', kind: 'qty', unitKey: 'unit_name' },
      { key: 'avg_cost', label: 'Avg. cost', kind: 'money' },
      { key: 'stock_value', label: 'Stock value', kind: 'money', total: true },
      { key: 'rack', label: 'Rack', kind: 'text' },
    ],
    load: async () => asRows(await getStockValuation()),
    emptyMessage: 'No products in stock.',
  },
  {
    kind: 'low-stock',
    title: 'Low & Out of Stock',
    description: 'Items at or below their minimum level — your re-order list.',
    group: 'inventory',
    usesRange: false,
    columns: [
      { key: 'product_name', label: 'Product', kind: 'text', href: productLink },
      { key: 'sku', label: 'Item code', kind: 'text' },
      { key: 'stock', label: 'In stock', kind: 'qty', unitKey: 'unit_name' },
      { key: 'min_stock', label: 'Minimum', kind: 'qty', unitKey: 'unit_name' },
      { key: 'status', label: 'Status', kind: 'text' },
    ],
    load: async () => asRows(await getLowStockReport()),
    emptyMessage: 'Nothing is low on stock. Well done!',
  },
  {
    kind: 'stock-movements',
    title: 'Stock Movements',
    description: 'Every stock change: sales, purchases, returns and adjustments (latest 2,000).',
    group: 'inventory',
    usesRange: true,
    columns: [
      { key: 'created_at', label: 'When', kind: 'datetime' },
      { key: 'product_name', label: 'Product', kind: 'text' },
      {
        key: 'movement_type',
        label: 'Type',
        kind: 'text',
        display: (row) => MOVEMENT_LABELS[String(row.movement_type)] ?? String(row.movement_type),
      },
      {
        key: 'quantity_change',
        label: 'Change',
        kind: 'number',
        display: (row) => {
          const n = Number(row.quantity_change);
          return `${n > 0 ? '+' : ''}${formatNumber(n)}`;
        },
      },
      { key: 'previous_stock', label: 'Before', kind: 'number' },
      { key: 'new_stock', label: 'After', kind: 'number' },
      { key: 'reason', label: 'Reason', kind: 'text' },
      { key: 'made_by', label: 'By', kind: 'text' },
    ],
    load: async ({ from, to }) => asRows(await getStockMovements(from, to)),
    emptyMessage: 'No stock changes in this period.',
  },
  {
    kind: 'slow-moving',
    title: 'Slow-Moving Stock',
    description: 'Items you have in stock that have not sold for a while — money sitting on the shelf.',
    group: 'inventory',
    usesRange: false,
    usesDays: true,
    columns: [
      { key: 'product_name', label: 'Product', kind: 'text', href: productLink },
      { key: 'stock', label: 'In stock', kind: 'qty' },
      { key: 'stock_value', label: 'Stock value', kind: 'money', total: true },
      {
        key: 'last_sold_on',
        label: 'Last sold',
        kind: 'date',
        display: (row) => (row.last_sold_on ? formatDate(String(row.last_sold_on)) : 'Never sold'),
      },
      {
        key: 'days_no_sale',
        label: 'Days without a sale',
        kind: 'number',
        display: (row) => (row.last_sold_on ? formatNumber(Number(row.days_no_sale)) : '—'),
      },
    ],
    load: async ({ days }) => asRows(await getSlowMoving(days)),
    emptyMessage: 'Everything in stock has sold recently.',
  },

  // ---------------------------- FINANCIAL ----------------------------
  {
    kind: 'expenses-by-category',
    title: 'Expenses by Category',
    description: 'Where the shop’s money went, apart from stock.',
    group: 'financial',
    usesRange: true,
    columns: [
      { key: 'category_name', label: 'Category', kind: 'text' },
      { key: 'entries', label: 'Entries', kind: 'number', total: true },
      { key: 'total', label: 'Amount', kind: 'money', total: true },
    ],
    load: async ({ from, to }) => asRows(await getExpensesByCategory(from, to)),
    emptyMessage: 'No expenses in this period.',
  },
  {
    kind: 'customer-dues',
    title: 'Customer Dues',
    description: 'Everyone who owes the shop money right now, biggest first.',
    group: 'financial',
    usesRange: false,
    columns: [
      {
        key: 'customer_name',
        label: 'Customer',
        kind: 'text',
        href: (row) => `/customers/${row.customer_id}`,
      },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'balance_due', label: 'Owes', kind: 'money', total: true },
      { key: 'credit_limit', label: 'Credit limit', kind: 'money' },
      { key: 'oldest_due_on', label: 'Oldest unpaid bill', kind: 'date' },
    ],
    load: async () => asRows(await getCustomerDues()),
    emptyMessage: 'No customer owes you anything.',
  },
  {
    kind: 'supplier-payables',
    title: 'Supplier Payables',
    description: 'What the shop owes each supplier right now.',
    group: 'financial',
    usesRange: false,
    columns: [
      {
        key: 'supplier_name',
        label: 'Supplier',
        kind: 'text',
        href: (row) => `/suppliers/${row.supplier_id}`,
      },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'balance_payable', label: 'We owe', kind: 'money', total: true },
      { key: 'oldest_due_on', label: 'Oldest unpaid bill', kind: 'date' },
    ],
    load: async () => asRows(await getSupplierPayables()),
    emptyMessage: 'You owe no supplier anything.',
  },

  // ---------------------------- ACCOUNTING ----------------------------
  {
    kind: 'trial-balance',
    title: 'Trial Balance',
    description: 'Every account with what moved in the period and its closing balance. Both pairs of totals must be equal.',
    group: 'accounting',
    usesRange: true,
    permission: 'accounting.view',
    columns: [
      { key: 'code', label: 'Code', kind: 'text' },
      { key: 'name', label: 'Account', kind: 'text', href: linkOf },
      {
        key: 'type',
        label: 'Type',
        kind: 'text',
        display: (row) => ACCOUNT_TYPE_SINGULAR[row.type as AccountType] ?? String(row.type),
      },
      { key: 'period_debit', label: 'Debits in period', kind: 'money', total: true, display: moneyOrBlank('period_debit') },
      { key: 'period_credit', label: 'Credits in period', kind: 'money', total: true, display: moneyOrBlank('period_credit') },
      { key: 'closing_debit', label: 'Balance (Dr)', kind: 'money', total: true, display: moneyOrBlank('closing_debit') },
      { key: 'closing_credit', label: 'Balance (Cr)', kind: 'money', total: true, display: moneyOrBlank('closing_credit') },
    ],
    load: async ({ from, to }) =>
      (await getTrialBalance(from, to)).map((row) => ({
        ...row,
        _href: ledgerHref(row.account_id, from, to),
      })),
    emptyMessage: 'Nothing has been posted to the books up to this date.',
  },
  {
    kind: 'income-statement',
    title: 'Income Statement',
    description: 'Profit and loss from the accounting books — includes manual entries and stock written off.',
    group: 'accounting',
    usesRange: true,
    permission: 'accounting.view',
    columns: STATEMENT_COLUMNS,
    rowTone: toneOf,
    load: async ({ from, to }) => {
      const rows = await getIncomeStatement(from, to);
      if (rows.length === 0) return [];
      const link = (id: string) => ledgerHref(id, from, to);
      const income = accountSection('Income', 'Total income', ofType(rows, 'income'), link);
      const expenses = accountSection('Expenses', 'Total expenses', ofType(rows, 'expense'), link);
      const profit = income.total - expenses.total;
      return [
        ...income.rows,
        ...expenses.rows,
        totalRow(profit >= 0 ? 'Net profit' : 'Net loss', profit),
      ];
    },
    emptyMessage: 'No income or expenses in this period.',
  },
  {
    kind: 'balance-sheet',
    title: 'Balance Sheet',
    description: 'What the shop owns, what it owes, and the owner’s share, on one date.',
    group: 'accounting',
    usesRange: true,
    asOf: true,
    permission: 'accounting.view',
    columns: STATEMENT_COLUMNS,
    rowTone: toneOf,
    load: async ({ from, to }) => {
      const rows = await getBalanceSheet(to);
      if (rows.every((row) => Number(row.amount) === 0)) return [];
      const link = (id: string) => ledgerHref(id, from, to);
      const assets = accountSection('Assets', 'Total assets', ofType(rows, 'asset'), link);
      const liabilities = accountSection('Liabilities', 'Total liabilities', ofType(rows, 'liability'), link);
      const equity = accountSection(
        'Owner’s equity',
        'Total owner’s equity',
        ofType(rows, 'equity').filter((row) => row.account_id || Number(row.amount) !== 0),
        link
      );
      return [
        ...assets.rows,
        ...liabilities.rows,
        ...equity.rows,
        totalRow('Total liabilities + owner’s equity', liabilities.total + equity.total),
      ];
    },
    emptyMessage: 'Nothing has been posted to the books up to this date.',
  },
];

/** The permission needed to open, print or download a report. */
export function reportPermission(report: ReportDefinition): Permission {
  return report.permission ?? 'reports.view';
}

export function canOpenReport(role: UserRole | null | undefined, report: ReportDefinition): boolean {
  return hasPermission(role, reportPermission(report));
}

export function getReportDefinition(kind: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.kind === kind);
}

export const SLOW_MOVING_DAYS = [30, 60, 90, 180] as const;

export function resolveDays(value: string | undefined): number {
  const n = Number(value);
  return (SLOW_MOVING_DAYS as readonly number[]).includes(n) ? n : 90;
}

// -------------------------------------------------------------
//  Cell formatting
// -------------------------------------------------------------
function isEmpty(value: unknown) {
  return value === null || value === undefined || value === '';
}

/** Text shown on screen and on paper. */
export function displayCell(column: ReportColumn, row: ReportRow): string {
  if (column.display) return column.display(row);
  const value = row[column.key];
  if (isEmpty(value)) return '—';
  switch (column.kind) {
    case 'money':
      return formatRs(Number(value));
    case 'number':
      return formatNumber(Number(value));
    case 'qty':
      return formatQty(Number(value), column.unitKey ? String(row[column.unitKey] ?? '') || undefined : undefined);
    case 'date':
      return formatDate(String(value));
    case 'datetime':
      return formatDateTime(String(value));
    default:
      return String(value);
  }
}

/** Plain value for spreadsheets: numbers stay numbers, dates stay sortable. */
export function csvCell(column: ReportColumn, row: ReportRow): string | number {
  const value = row[column.key];
  if (isEmpty(value)) return '';
  switch (column.kind) {
    case 'money':
      return Number(value).toFixed(2);
    case 'number':
    case 'qty':
      return Number(value);
    case 'date':
      return String(value).slice(0, 10);
    case 'datetime':
      return formatDateTime(String(value));
    default:
      return column.display ? column.display(row) : String(value);
  }
}

/** Totals row (only for columns marked `total`). */
export function columnTotals(columns: ReportColumn[], rows: ReportRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const column of columns) {
    if (!column.total) continue;
    totals[column.key] = rows.reduce((sum, row) => sum + (Number(row[column.key]) || 0), 0);
  }
  return totals;
}

export function displayTotal(column: ReportColumn, value: number): string {
  return column.kind === 'money' ? formatRs(value) : formatNumber(value);
}

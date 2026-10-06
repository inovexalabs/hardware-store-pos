// =============================================================
//  Accounting labels and helpers shared by the server pages and
//  the client forms.  Plain words first: most shop owners are not
//  accountants, so every term comes with a short explanation.
// =============================================================
import { formatRs } from '@/utils/format';
import type { AccountType, JournalSourceType } from '@/types/database';

export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: "Owner's equity",
  income: 'Income',
  expense: 'Expenses',
};

export const ACCOUNT_TYPE_SINGULAR: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
};

export const ACCOUNT_TYPE_HINTS: Record<AccountType, string> = {
  asset: 'What the shop owns — cash, bank, stock, money customers owe you.',
  liability: 'What the shop owes — suppliers, VAT to pay, loans.',
  equity: "The owner's own money in the shop.",
  income: 'Money the shop earns.',
  expense: 'Money spent to run the shop.',
};

/** Assets and expenses grow on the debit side; the rest on the credit side. */
export function isDebitNormal(type: AccountType): boolean {
  return type === 'asset' || type === 'expense';
}

export const SOURCE_LABELS: Record<JournalSourceType, string> = {
  manual: 'Manual entry',
  reversal: 'Reversal',
  opening: 'Opening balances',
  stock_revaluation: 'Stock revaluation',
  sale: 'Sale',
  sale_cancel: 'Sale cancelled',
  purchase: 'Purchase',
  purchase_cancel: 'Purchase cancelled',
  sales_return: 'Customer return',
  purchase_return: 'Return to supplier',
  customer_payment: 'Payment received',
  supplier_payment: 'Payment made',
  expense: 'Expense',
  stock_adjustment: 'Stock change',
};

/** Filters on the journal page → the source types they include. */
export const SOURCE_FILTERS: { value: string; label: string; types: JournalSourceType[] }[] = [
  { value: 'manual', label: 'Manual entries', types: ['manual', 'reversal'] },
  { value: 'sales', label: 'Sales & customer returns', types: ['sale', 'sale_cancel', 'sales_return'] },
  { value: 'purchases', label: 'Purchases & supplier returns', types: ['purchase', 'purchase_cancel', 'purchase_return'] },
  { value: 'payments', label: 'Payments', types: ['customer_payment', 'supplier_payment'] },
  { value: 'expenses', label: 'Expenses', types: ['expense'] },
  { value: 'stock', label: 'Stock & opening balances', types: ['stock_adjustment', 'stock_revaluation', 'opening'] },
];

export function sourceFilterTypes(value: string | undefined): JournalSourceType[] | null {
  return SOURCE_FILTERS.find((filter) => filter.value === value)?.types ?? null;
}

/** "Rs. 1,200.00 Dr" for a Dr − Cr balance. */
export function formatDrCr(balance: number | null | undefined): string {
  const value = Math.round(Number(balance ?? 0) * 100) / 100;
  if (value === 0) return formatRs(0);
  return `${formatRs(Math.abs(value))} ${value > 0 ? 'Dr' : 'Cr'}`;
}

/** Where the document behind an automatic entry can be opened. */
export function sourceHref(
  sourceType: JournalSourceType,
  sourceId: string | null,
  extra: { customerId?: string | null; supplierId?: string | null; productId?: string | null } = {}
): string | null {
  switch (sourceType) {
    case 'sale':
    case 'sale_cancel':
      return sourceId ? `/sales/${sourceId}` : null;
    case 'purchase':
    case 'purchase_cancel':
      return sourceId ? `/purchases/${sourceId}` : null;
    case 'sales_return':
    case 'purchase_return':
      return sourceId ? `/returns/${sourceId}` : null;
    case 'expense':
      return sourceId ? `/expenses/${sourceId}` : null;
    case 'customer_payment':
      return extra.customerId ? `/customers/${extra.customerId}` : null;
    case 'supplier_payment':
      return extra.supplierId ? `/suppliers/${extra.supplierId}` : null;
    case 'stock_adjustment':
      return extra.productId ? `/products/${extra.productId}` : null;
    case 'reversal':
      return sourceId ? `/accounting/journal/${sourceId}` : null;
    default:
      return null;
  }
}

export function ledgerHref(accountId: string, from: string, to: string): string {
  return `/accounting/ledger?account=${accountId}&from=${from}&to=${to}`;
}

/**
 * Ready-made entries for the most common manual jobs.  Accounts are
 * found by their built-in key, so renaming an account is fine.
 */
export const ENTRY_TEMPLATES: {
  key: string;
  label: string;
  narration: string;
  debit: string;
  credit: string;
}[] = [
  { key: 'capital', label: 'Owner put money into the shop', narration: 'Owner invested money in the shop', debit: 'cash', credit: 'capital' },
  { key: 'drawings', label: 'Owner took money for personal use', narration: 'Owner took money for personal use', debit: 'drawings', credit: 'cash' },
  { key: 'deposit', label: 'Cash deposited in the bank', narration: 'Cash deposited in the bank', debit: 'bank', credit: 'cash' },
  { key: 'withdraw', label: 'Cash withdrawn from the bank', narration: 'Cash withdrawn from the bank', debit: 'cash', credit: 'bank' },
  { key: 'wallet', label: 'Wallet money moved to the bank', narration: 'Wallet balance transferred to the bank', debit: 'bank', credit: 'wallet' },
  { key: 'vat_setoff', label: 'Set off VAT paid on purchases', narration: 'VAT paid on purchases set off against VAT collected', debit: 'vat_output', credit: 'vat_input' },
  { key: 'vat', label: 'VAT paid to the tax office', narration: 'VAT paid to the Inland Revenue Office', debit: 'vat_output', credit: 'bank' },
  { key: 'other_income', label: 'Other income received', narration: 'Other income received', debit: 'cash', credit: 'other_income' },
];

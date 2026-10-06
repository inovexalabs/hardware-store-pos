import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/utils/format';
import type { AuditLogWithUser } from '@/types/database';

export const AUDIT_ENTITIES: { value: string; label: string }[] = [
  { value: 'sale', label: 'Sales' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'sales_return', label: 'Customer returns' },
  { value: 'purchase_return', label: 'Supplier returns' },
  { value: 'product', label: 'Products' },
  { value: 'stock_adjusted', label: 'Stock adjustments' },
  { value: 'customer', label: 'Customers' },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'customer_payment', label: 'Customer payments' },
  { value: 'supplier_payment', label: 'Supplier payments' },
  { value: 'expense', label: 'Expenses' },
  { value: 'user', label: 'Staff' },
  { value: 'settings', label: 'Settings' },
  { value: 'session', label: 'Sign-ins' },
];

const ENTITY_NAMES: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  sales_return: 'Customer return',
  purchase_return: 'Supplier return',
  product: 'Product',
  stock_adjusted: 'Stock adjustment',
  customer: 'Customer',
  supplier: 'Supplier',
  customer_payment: 'Customer payment',
  supplier_payment: 'Supplier payment',
  expense: 'Expense',
  user: 'Staff member',
  settings: 'Settings',
  session: 'Sign-in',
};

const VERBS: Record<string, string> = {
  created: 'added',
  updated: 'changed',
  deleted: 'deleted',
  login: 'signed in',
};

/** Columns that change on every save and mean nothing to the owner. */
const NOISE = new Set(['updated_at', 'created_at', 'id', 'avg_cost', 'updated_by']);

/** Friendly labels for the fields owners care about. */
const FIELD_LABELS: Record<string, string> = {
  selling_price: 'selling price',
  purchase_price: 'purchase price',
  wholesale_price: 'wholesale price',
  min_stock: 'minimum stock',
  is_active: 'active',
  balance_due: 'balance due',
  balance_payable: 'balance payable',
  credit_limit: 'credit limit',
  paid_amount: 'paid',
  due_amount: 'due',
  tax_rate: 'VAT rate',
  tax_enabled: 'VAT on',
  full_name: 'name',
  invoice_prefix: 'invoice prefix',
  receipt_size: 'receipt size',
  shop_name: 'shop name',
  allow_negative_stock: 'allow negative stock',
  cancel_reason: 'cancel reason',
};

type Json = Record<string, unknown>;

function label(record: Json | undefined): string | null {
  if (!record) return null;
  for (const key of ['invoice_number', 'purchase_number', 'return_number', 'name', 'full_name', 'shop_name']) {
    if (record[key]) return String(record[key]);
  }
  if (record.amount) return `Rs. ${record.amount}`;
  return null;
}

function short(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
}

/** One readable sentence for an audit entry. */
export function describeAudit(log: AuditLogWithUser): { title: string; details: string | null } {
  const [, verbKey = ''] = log.action.split('.');
  const entity = ENTITY_NAMES[log.entity] ?? log.entity;
  const verb = VERBS[verbKey] ?? verbKey;
  const meta = (log.metadata ?? {}) as Json;
  const before = meta.before as Json | undefined;
  const after = meta.after as Json | undefined;
  const name = label(after) ?? label(before);

  if (log.entity === 'session') {
    return { title: 'Signed in', details: meta.email ? String(meta.email) : null };
  }

  const title = `${entity} ${verb}${name ? `: ${name}` : ''}`;

  if (verbKey === 'updated' && before && after) {
    const changes = Object.keys(after)
      .filter((key) => !NOISE.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => `${FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}: ${short(before[key])} → ${short(after[key])}`);
    if (log.entity === 'sale' || log.entity === 'purchase') {
      if (after.status === 'cancelled' && before.status !== 'cancelled') {
        return { title: `${entity} cancelled${name ? `: ${name}` : ''}`, details: after.cancel_reason ? String(after.cancel_reason) : null };
      }
    }
    return { title, details: changes.length ? changes.slice(0, 5).join(' · ') + (changes.length > 5 ? ` · +${changes.length - 5} more` : '') : null };
  }

  if (verbKey === 'created' && after) {
    const bits: string[] = [];
    if (after.total !== undefined) bits.push(`total Rs. ${after.total}`);
    if (after.amount !== undefined && !name?.startsWith('Rs.')) bits.push(`Rs. ${after.amount}`);
    if (after.reason) bits.push(String(after.reason));
    return { title, details: bits.length ? bits.join(' · ') : null };
  }

  return { title, details: null };
}

export function AuditTable({ rows }: { rows: AuditLogWithUser[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>What happened</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((log) => {
            const { title, details } = describeAudit(log);
            return (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap align-top text-sm text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </TableCell>
                <TableCell className="align-top">
                  {log.profile?.full_name ?? <span className="text-muted-foreground">System</span>}
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  <p className="font-medium">{title}</p>
                  {details && <p className="mt-0.5 text-sm break-words text-muted-foreground">{details}</p>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

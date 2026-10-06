import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database';

/** GREEN in stock · AMBER low · RED out of stock */
export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const qty = Number(stock);
  const min = Number(minStock);

  if (qty <= 0) {
    return <Badge className="border-transparent bg-danger-subtle">Out of Stock</Badge>;
  }
  if (qty <= min) {
    return <Badge className="border-transparent bg-warning-subtle">Low Stock</Badge>;
  }
  return <Badge className="border-transparent bg-success-subtle">In Stock</Badge>;
}

export function PaymentBadge({
  due,
  total,
}: {
  due: number;
  total: number;
}) {
  if (Number(due) <= 0) {
    return <Badge className="border-transparent bg-success-subtle">Paid</Badge>;
  }
  if (Number(due) >= Number(total)) {
    return <Badge className="border-transparent bg-danger-subtle">Unpaid</Badge>;
  }
  return <Badge className="border-transparent bg-warning-subtle">Partly Paid</Badge>;
}

export function TxStatusBadge({ status }: { status: 'completed' | 'cancelled' }) {
  if (status === 'cancelled') {
    return <Badge className="border-transparent bg-danger-subtle">Cancelled</Badge>;
  }
  return <Badge className="border-transparent bg-success-subtle">Completed</Badge>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory: 'Inventory staff',
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className={cn('font-medium')}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  if (active) {
    return <Badge className="border-transparent bg-success-subtle">Active</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">
    Inactive
  </Badge>;
}

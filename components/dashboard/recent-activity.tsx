import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDateTime, formatQty, formatRs } from '@/utils/format';
import { ArrowDown, ArrowUp, ShoppingCart, Truck, History } from 'lucide-react';
import type { RecentActivity } from '@/services/dashboard';

interface Props {
  activity: RecentActivity;
}

export function RecentActivityPanels({ activity }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ---------- Recent sales ---------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">Recent Sales</CardTitle>
          <Link href="/sales" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {activity.sales.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No sales yet"
              description="Sales you record will appear here."
            />
          ) : (
            <ul className="divide-y">
              {activity.sales.map((sale) => (
                <li key={sale.id}>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {sale.invoice_number}
                        {sale.status === 'cancelled' && (
                          <Badge className="ml-2 border-transparent bg-danger-subtle">
                            Cancelled
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {sale.customer?.name ?? 'Walk-in customer'} ·{' '}
                        {formatDateTime(sale.created_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatRs(sale.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ---------- Recent purchases ---------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">Recent Purchases</CardTitle>
          <Link href="/purchases" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {activity.purchases.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No purchases yet"
              description="Purchases you record will appear here."
            />
          ) : (
            <ul className="divide-y">
              {activity.purchases.map((purchase) => (
                <li key={purchase.id}>
                  <Link
                    href={`/purchases/${purchase.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {purchase.purchase_number}
                        {purchase.status === 'cancelled' && (
                          <Badge className="ml-2 border-transparent bg-danger-subtle">
                            Cancelled
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {purchase.supplier?.company || purchase.supplier?.name || 'Supplier'} ·{' '}
                        {formatDateTime(purchase.created_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatRs(purchase.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ---------- Recent stock changes ---------- */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">Recent Stock Changes</CardTitle>
          <Link href="/products" className="text-sm text-primary hover:underline">
            All products
          </Link>
        </CardHeader>
        <CardContent>
          {activity.movements.length === 0 ? (
            <EmptyState
              icon={History}
              title="No stock changes yet"
              description="Every purchase, sale and adjustment is recorded here automatically."
            />
          ) : (
            <ul className="divide-y">
              {activity.movements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={
                        movement.quantity_change >= 0
                          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-subtle'
                          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-subtle'
                      }
                    >
                      {movement.quantity_change >= 0 ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {movement.product?.name ?? 'Product'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {movement.reason ?? movement.movement_type} ·{' '}
                        {formatDateTime(movement.created_at)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">
                      {movement.quantity_change >= 0 ? '+' : ''}
                      {formatQty(movement.quantity_change)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      now {formatQty(movement.new_stock)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

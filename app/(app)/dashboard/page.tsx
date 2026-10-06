import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import {
  buildAlerts,
  getDashboardSummary,
  getLowStockProducts,
  getRecentActivity,
} from '@/services/dashboard';
import { listCustomers, listSuppliers } from '@/services/parties';
import { hasPermission } from '@/lib/permissions';
import { formatDate, formatNumber, formatQty, formatRs } from '@/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentActivityPanels } from '@/components/dashboard/recent-activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  XCircle,
} from 'lucide-react';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { profile } = await requirePermission('dashboard.view');

  const [summary, activity, lowStock, customers, suppliers] = await Promise.all([
    getDashboardSummary(),
    getRecentActivity(6),
    getLowStockProducts(5),
    hasPermission(profile.role, 'sales.create')
      ? listCustomers({ perPage: 50 })
      : Promise.resolve({ rows: [] }),
    hasPermission(profile.role, 'purchases.write')
      ? listSuppliers({ perPage: 50 })
      : Promise.resolve({ rows: [] }),
  ]);

  const alerts = buildAlerts(summary);
  const can = {
    sale: hasPermission(profile.role, 'sales.create'),
    product: hasPermission(profile.role, 'products.write'),
    purchase: hasPermission(profile.role, 'purchases.write'),
    customer: hasPermission(profile.role, 'customers.write'),
    supplier: hasPermission(profile.role, 'suppliers.write'),
    payment: hasPermission(profile.role, 'payments.record'),
  };

  const showMoney = summary.today.customer_due !== null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Today is ${formatDate(new Date().toISOString())} · Here is how your shop is doing.`}
        actions={
          can.sale ? (
            <Link
              href="/sales/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ShoppingCart className="h-5 w-5" />
              New Sale
            </Link>
          ) : undefined
        }
      />

      {/* ---------- Alerts ---------- */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className={
                'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted ' +
                (alert.type === 'danger'
                  ? 'border-destructive/40 bg-danger-subtle'
                  : alert.type === 'warning'
                    ? 'border-warning/40 bg-warning-subtle'
                    : 'border-primary/30 bg-primary-subtle')
              }
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {alert.text}
              <span className="ml-auto shrink-0 text-xs font-semibold underline underline-offset-2">
                Open
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ---------- Today's summary ---------- */}
      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-3 text-lg font-semibold">
          Today&apos;s Summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Today's Sales"
            value={formatRs(summary.today.sales)}
            icon={ShoppingCart}
            tone="primary"
            hint={`${summary.today.sales_count} invoice${summary.today.sales_count === 1 ? '' : 's'}`}
            href="/sales"
          />
          <StatCard
            label="Today's Purchases"
            value={formatRs(summary.today.purchases)}
            icon={Truck}
            href="/purchases"
          />
          <StatCard
            label="Today's Profit"
            value={formatRs(summary.today.profit)}
            icon={summary.today.profit >= 0 ? TrendingUp : TrendingDown}
            tone={summary.today.profit >= 0 ? 'success' : 'danger'}
            hint="Sales − cost − expenses"
            href="/reports"
          />
          {showMoney && (
            <StatCard
              label="Customer Due"
              value={formatRs(summary.today.customer_due ?? 0)}
              icon={Users}
              tone="warning"
              href="/customers?due=1"
            />
          )}
          {showMoney && (
            <StatCard
              label="Supplier Payable"
              value={formatRs(summary.today.supplier_payable ?? 0)}
              icon={Truck}
              tone="warning"
              href="/suppliers?payable=1"
            />
          )}
        </div>
      </section>

      {/* ---------- Inventory summary ---------- */}
      <section aria-labelledby="inventory-heading">
        <h2 id="inventory-heading" className="mb-3 text-lg font-semibold">
          Inventory Summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Products"
            value={formatNumber(summary.inventory.products)}
            icon={Package}
            href="/products"
          />
          <StatCard
            label="Low Stock"
            value={formatNumber(summary.inventory.low_stock)}
            icon={AlertTriangle}
            tone="warning"
            hint="At or below minimum"
            href="/products?stock=low"
          />
          <StatCard
            label="Out of Stock"
            value={formatNumber(summary.inventory.out_of_stock)}
            icon={XCircle}
            tone="danger"
            href="/products?stock=out"
          />
          <StatCard
            label="Total Stock Value"
            value={formatRs(summary.inventory.stock_value)}
            icon={Warehouse}
            hint="At average cost"
            href="/reports?tab=inventory"
          />
        </div>
      </section>

      {/* ---------- Quick actions ---------- */}
      <section aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="mb-3 text-lg font-semibold">
          Quick Actions
        </h2>
        <QuickActions
          customers={customers.rows.slice(0, 50).map((c) => ({ id: c.id, name: c.name }))}
          suppliers={suppliers.rows.slice(0, 50).map((s) => ({ id: s.id, name: s.company || s.name }))}
          can={can}
        />
      </section>

      {/* ---------- What is running out ---------- */}
      {lowStock.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Running Low</CardTitle>
            <Link href="/products?stock=low" className="text-sm text-primary hover:underline">
              View all low stock
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {lowStock.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Item {product.sku}
                      </span>
                    </span>
                    <Badge
                      className={
                        Number(product.stock) <= 0
                          ? 'border-transparent bg-danger-subtle'
                          : 'border-transparent bg-warning-subtle'
                      }
                    >
                      {formatQty(product.stock, product.unit.name)} left
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ---------- Recent activity ---------- */}
      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-3 text-lg font-semibold">
          Recent Activity
        </h2>
        <RecentActivityPanels activity={activity} />
      </section>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import {
  getProduct,
  getProductConversions,
  getProductMovements,
  listUnits,
} from '@/services/products';
import { PageHeader } from '@/components/shared/page-header';
import { StockBadge, ActiveBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { StockAdjustDialog } from '@/components/products/stock-adjust-dialog';
import { UnitConversions } from '@/components/products/unit-conversions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRs, formatQty, formatDateTime, formatNumber, isUuid } from '@/utils/format';
import {
  Pencil,
  Package,
  History,
  ArrowLeft,
  Barcode,
  MapPin,
  Truck,
} from 'lucide-react';
import type { MovementType } from '@/types/database';

export const metadata = { title: 'Product Details' };

const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  sales_return: 'Sales Return',
  purchase_return: 'Purchase Return',
  adjustment: 'Adjustment',
  damage: 'Damage',
  lost: 'Lost',
  initial: 'Opening Stock',
};

function movementBadge(type: MovementType) {
  const positive = ['purchase', 'sales_return', 'initial'].includes(type);
  if (positive) return <Badge className="border-transparent bg-success-subtle">IN</Badge>;
  return <Badge className="border-transparent bg-danger-subtle">OUT</Badge>;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('products.view');

  const [product, units] = await Promise.all([getProduct(id), listUnits()]);
  if (!product) notFound();

  const canWrite = hasPermission(ctx.profile.role, 'products.write');
  const canAdjust = hasPermission(ctx.profile.role, 'stock.adjust');

  const [conversions, movements] = await Promise.all([
    getProductConversions(product.id),
    getProductMovements(product.id, 50),
  ]);
  const baseUnit = units.find((u) => u.id === product.unit_id) ?? {
    id: product.unit_id,
    name: product.unit.name,
    allow_decimal: product.unit.allow_decimal,
    is_active: true,
    created_at: '',
    updated_at: '',
  };

  const stockValue = Number(product.stock) * Number(product.avg_cost);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{product.sku}</code>
            {product.barcode && (
              <span className="inline-flex items-center gap-1">
                <Barcode className="h-3.5 w-3.5" />
                {product.barcode}
              </span>
            )}
            <StockBadge stock={product.stock} minStock={product.min_stock} />
            <ActiveBadge active={product.is_active} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/products">
                <ArrowLeft data-icon="inline-start" />
                All Products
              </Link>
            </Button>
            {canWrite && (
              <>
                <StockAdjustDialog product={product} canAdjust={canAdjust} />
                <Button asChild>
                  <Link href={`/products/${product.id}/edit`}>
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      {/* ---------- Key numbers ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">In Stock</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatQty(product.stock, product.unit.name)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum: {formatQty(product.min_stock, product.unit.name)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Selling Price</p>
            <p className="mt-1 text-2xl font-semibold">{formatRs(product.selling_price)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Wholesale: {formatRs(product.wholesale_price)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average Cost</p>
            <p className="mt-1 text-2xl font-semibold">{formatRs(product.avg_cost)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Buy price: {formatRs(product.purchase_price)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Stock Value</p>
            <p className="mt-1 text-2xl font-semibold">{formatRs(stockValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">At average cost</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Info ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{product.category?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Brand</span>
              <span className="font-medium">{product.brand?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Unit</span>
              <span className="font-medium">{product.unit.name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">VAT</span>
              <span className="font-medium">{formatNumber(product.tax_rate)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Rack
              </span>
              <span className="font-medium">{product.rack ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Truck className="h-3.5 w-3.5" /> Supplier
              </span>
              <span className="font-medium">
                {product.supplier ? (
                  <Link href={`/suppliers/${product.supplier.id}`} className="underline">
                    {product.supplier.company || product.supplier.name}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>
            {product.description && (
              <p className="rounded-lg bg-muted p-3 text-sm">{product.description}</p>
            )}
          </CardContent>
        </Card>

        {/* ---------- Conversions ---------- */}
        <div className="space-y-6">
          <UnitConversions
            productId={product.id}
            baseUnit={baseUnit}
            units={units}
            conversions={conversions}
            canEdit={canWrite}
          />
        </div>

        {/* ---------- History ---------- */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Stock History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No stock movements yet."
                description="Sales, purchases and corrections will appear here."
              />
            ) : (
              <ul className="divide-y">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {movementBadge(m.movement_type)}
                        <span className="font-medium">
                          {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                        </span>
                      </div>
                      {m.reason && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.reason}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(m.created_at)}
                        {m.profile?.full_name ? ` · ${m.profile.full_name}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={
                          Number(m.quantity_change) >= 0
                            ? 'font-semibold text-success'
                            : 'font-semibold text-destructive'
                        }
                      >
                        {Number(m.quantity_change) >= 0 ? '+' : ''}
                        {formatNumber(m.quantity_change)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(m.previous_stock)} → {formatNumber(m.new_stock)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

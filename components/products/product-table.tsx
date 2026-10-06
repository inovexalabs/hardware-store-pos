import Link from 'next/link';
import { StockBadge } from '@/components/shared/status-badge';
import { formatNumber, formatRs } from '@/utils/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import type { ProductListItem } from '@/types/database';

export function ProductTable({ rows }: { rows: ProductListItem[] }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Purchase Price</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((product) => (
              <TableRow key={product.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/products/${product.id}`} className="block">
                    {product.name}
                    {!product.is_active && (
                      <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                <TableCell className="text-muted-foreground">
                  {product.category?.name ?? '—'}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(product.stock)}
                </TableCell>
                <TableCell className="text-muted-foreground">{product.unit.name}</TableCell>
                <TableCell className="text-right">{formatRs(product.purchase_price)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatRs(product.selling_price)}
                </TableCell>
                <TableCell>
                  {product.is_active ? (
                    <StockBadge stock={Number(product.stock)} minStock={Number(product.min_stock)} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Inactive</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/products/${product.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {rows.map((product) => (
          <Link key={product.id} href={`/products/${product.id}`}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {product.sku} · {product.category?.name ?? 'No category'}
                    </p>
                  </div>
                  <StockBadge
                    stock={Number(product.stock)}
                    minStock={Number(product.min_stock)}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>
                    Stock:{' '}
                    <strong>
                      {formatNumber(product.stock)} {product.unit.name}
                    </strong>
                  </span>
                  <span className="font-semibold">{formatRs(product.selling_price)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

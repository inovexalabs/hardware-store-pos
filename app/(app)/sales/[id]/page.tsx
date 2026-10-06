import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getSale } from '@/services/sales';
import { PageHeader } from '@/components/shared/page-header';
import { PaymentBadge, TxStatusBadge } from '@/components/shared/status-badge';
import { SaleActions } from '@/components/sales/sale-actions';
import { SourceEntries } from '@/components/accounting/source-entries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRs, formatQty, formatDateTime, paymentMethodLabel, isUuid } from '@/utils/format';
import { ArrowLeft, Undo2 } from 'lucide-react';

export const metadata = { title: 'Sale Details' };


export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('sales.view');

  const detail = await getSale(id);
  if (!detail) notFound();

  const { sale, items, returns } = detail;
  const canCancel = hasPermission(ctx.profile.role, 'sales.cancel');
  const canTakePayment =
    hasPermission(ctx.profile.role, 'payments.record') && Boolean(sale.customer_id);
  const canReturn =
    hasPermission(ctx.profile.role, 'returns.process') && sale.status === 'completed';
  const returnedTotal = returns.reduce((sum, r) => sum + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={sale.invoice_number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{formatDateTime(sale.created_at)}</span>
            <TxStatusBadge status={sale.status} />
            {sale.status === 'completed' && (
              <PaymentBadge due={sale.due_amount} total={sale.total} />
            )}
            {sale.profile?.full_name && (
              <span className="text-muted-foreground">by {sale.profile.full_name}</span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/sales">
                <ArrowLeft data-icon="inline-start" />
                All Sales
              </Link>
            </Button>
            {canReturn && (
              <Button variant="outline" asChild>
                <Link href={`/returns/new?sale=${sale.id}`}>
                  <Undo2 data-icon="inline-start" />
                  Return Items
                </Link>
              </Button>
            )}
            <SaleActions
              sale={sale}
              canCancel={canCancel}
              canTakePayment={canTakePayment}
            />
          </>
        }
      />

      {sale.status === 'cancelled' && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">This sale was cancelled.</p>
          <p className="mt-1 text-muted-foreground">
            {sale.cancel_reason}
            {sale.cancelled_at ? ` · ${formatDateTime(sale.cancelled_at)}` : ''}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{item.product.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.product.sku}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQty(item.quantity, item.product.unit?.name)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatRs(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.discount_amount) > 0
                          ? `− ${formatRs(item.discount_amount)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.tax_amount) > 0 ? formatRs(item.tax_amount) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatRs(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* mobile */}
            <ul className="space-y-3 md:hidden">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2 font-medium">
                    <span>{item.product.name}</span>
                    <span>{formatRs(item.line_total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatQty(item.quantity, item.product.unit?.name)} ×{' '}
                    {formatRs(item.unit_price)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRs(sale.subtotal)}</span>
              </div>
              {Number(sale.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">
                    − {formatRs(sale.discount_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span>{formatRs(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatRs(sale.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-success">{formatRs(sale.paid_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due</span>
                <span
                  className={
                    Number(sale.due_amount) > 0
                      ? 'font-medium text-destructive'
                      : 'text-muted-foreground'
                  }
                >
                  {formatRs(sale.due_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment method</span>
                <span>{paymentMethodLabel(sale.payment_method)}</span>
              </div>
              {sale.notes && (
                <p className="rounded-lg bg-muted p-3 text-sm">{sale.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Customer</span>
                {sale.customer ? (
                  <Link href={`/customers/${sale.customer.id}`} className="font-medium underline">
                    {sale.customer.name}
                  </Link>
                ) : (
                  <span className="font-medium">Walk-in customer</span>
                )}
              </div>
              {sale.customer?.phone && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{sale.customer.phone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {returns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Undo2 className="h-4 w-4" />
                  Returns on this invoice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {returns.map((ret) => (
                  <Link
                    key={ret.id}
                    href={`/returns/${ret.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{ret.return_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(ret.created_at)}
                      </p>
                    </div>
                    <Badge variant="outline">{formatRs(ret.total)}</Badge>
                  </Link>
                ))}
                <p className="text-sm text-muted-foreground">
                  Total returned: <strong>{formatRs(returnedTotal)}</strong>
                </p>
              </CardContent>
            </Card>
          )}

          <SourceEntries sourceId={sale.id} role={ctx.profile.role} />
        </div>
      </div>
    </div>
  );
}

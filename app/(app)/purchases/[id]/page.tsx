import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getPurchase } from '@/services/purchases';
import { PageHeader } from '@/components/shared/page-header';
import { SourceEntries } from '@/components/accounting/source-entries';
import { PaymentBadge, TxStatusBadge } from '@/components/shared/status-badge';
import { PaymentDialog } from '@/components/shared/payment-dialog';
import { CancelPurchaseButton } from '@/components/purchases/purchase-actions';
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
import {
  formatDateTime,
  formatQty,
  formatRs,
  isUuid,
  paymentMethodLabel,
} from '@/utils/format';
import { ArrowLeft, HandCoins, Printer, Undo2 } from 'lucide-react';

export const metadata = { title: 'Purchase Details' };

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('purchases.view');
  const role = ctx.profile.role;

  const detail = await getPurchase(id);
  if (!detail) notFound();

  const { purchase, items, returns, payments } = detail;
  const isCancelled = purchase.status === 'cancelled';
  const hasDue = Number(purchase.due_amount) > 0;
  const canCancel = hasPermission(role, 'purchases.cancel') && !isCancelled && returns.length === 0;
  const canPay = hasPermission(role, 'payments.record') && !isCancelled && hasDue;
  const canReturn = hasPermission(role, 'returns.process') && !isCancelled;
  const canSeeSupplier = hasPermission(role, 'suppliers.view');
  const returnedTotal = returns.reduce((sum, r) => sum + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={purchase.purchase_number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{formatDateTime(purchase.created_at)}</span>
            <TxStatusBadge status={purchase.status} />
            {!isCancelled && <PaymentBadge due={purchase.due_amount} total={purchase.total} />}
            {purchase.profile?.full_name && (
              <span className="text-muted-foreground">by {purchase.profile.full_name}</span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/purchases">
                <ArrowLeft data-icon="inline-start" />
                All Purchases
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/purchases/${purchase.id}/print`} target="_blank" rel="noreferrer">
                <Printer data-icon="inline-start" />
                Print
              </a>
            </Button>
            {canReturn && (
              <Button variant="outline" asChild>
                <Link href={`/returns/new?purchase=${purchase.id}`}>
                  <Undo2 data-icon="inline-start" />
                  Return to Supplier
                </Link>
              </Button>
            )}
            {canPay && purchase.supplier && (
              <PaymentDialog
                kind="supplier"
                partyId={purchase.supplier.id}
                partyName={purchase.supplier.name}
                balance={purchase.supplier.balance_payable}
                openBills={[
                  {
                    id: purchase.id,
                    number: purchase.purchase_number,
                    due_amount: purchase.due_amount,
                    created_at: purchase.created_at,
                  },
                ]}
                defaultBillId={purchase.id}
                triggerLabel="Pay This Bill"
              />
            )}
            {canCancel && (
              <CancelPurchaseButton
                purchaseId={purchase.id}
                purchaseNumber={purchase.purchase_number}
              />
            )}
          </>
        }
      />

      {isCancelled && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">This purchase was cancelled.</p>
          <p className="mt-1 text-muted-foreground">
            {purchase.cancel_reason}
            {purchase.cancelled_at ? ` · ${formatDateTime(purchase.cancelled_at)}` : ''}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
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
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const converted = Number(item.base_quantity) !== Number(item.quantity);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Link
                            href={`/products/${item.product.id}`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">
                            {item.product.sku}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(item.quantity, item.unit?.name)}
                          {converted && (
                            <span className="block text-xs text-muted-foreground">
                              = {formatQty(item.base_quantity, item.product.unit?.name)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatRs(item.unit_price)}</TableCell>
                        <TableCell className="text-right">
                          {Number(item.discount_amount) > 0
                            ? `− ${formatRs(item.discount_amount)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatRs(item.line_total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2 font-medium">
                    <span>{item.product.name}</span>
                    <span>{formatRs(item.line_total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatQty(item.quantity, item.unit?.name)} × {formatRs(item.unit_price)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRs(purchase.subtotal)}</span>
              </div>
              {Number(purchase.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">− {formatRs(purchase.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT / tax</span>
                <span>{formatRs(purchase.tax_amount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatRs(purchase.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-success">{formatRs(purchase.paid_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due</span>
                <span className={hasDue ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                  {formatRs(purchase.due_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid by</span>
                <span>{paymentMethodLabel(purchase.payment_method)}</span>
              </div>
              {purchase.notes && <p className="rounded-lg bg-muted p-3 text-sm">{purchase.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Supplier</span>
                {purchase.supplier && canSeeSupplier ? (
                  <Link href={`/suppliers/${purchase.supplier.id}`} className="font-medium underline">
                    {purchase.supplier.name}
                  </Link>
                ) : (
                  <span className="font-medium">{purchase.supplier?.name ?? '—'}</span>
                )}
              </div>
              {purchase.supplier?.company && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Company</span>
                  <span>{purchase.supplier.company}</span>
                </div>
              )}
              {purchase.supplier_invoice_no && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Supplier bill no.</span>
                  <span>{purchase.supplier_invoice_no}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HandCoins className="h-4 w-4" />
                  Payments on this bill
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{paymentMethodLabel(payment.method)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(payment.created_at)}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{formatRs(payment.amount)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {returns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Undo2 className="h-4 w-4" />
                  Returned to supplier
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
                      <p className="text-xs text-muted-foreground">{formatDateTime(ret.created_at)}</p>
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

          <SourceEntries sourceId={purchase.id} role={role} />
        </div>
      </div>
    </div>
  );
}

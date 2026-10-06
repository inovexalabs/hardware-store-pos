import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getCustomer } from '@/services/parties';
import { listOpenInvoicesForCustomer } from '@/services/sales';
import { PageHeader } from '@/components/shared/page-header';
import { ActiveBadge, PaymentBadge, TxStatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PaymentDialog } from '@/components/shared/payment-dialog';
import { PartyActiveButton } from '@/components/shared/party-active-button';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatRs, paymentMethodLabel, isUuid } from '@/utils/format';
import {
  ArrowLeft,
  FileText,
  HandCoins,
  Phone,
  Mail,
  MapPin,
  Receipt,
  ShoppingCart,
  Wallet,
  Gauge,
} from 'lucide-react';

export const metadata = { title: 'Customer Details' };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('customers.view');
  const role = ctx.profile.role;

  const detail = await getCustomer(id);
  if (!detail) notFound();

  const { customer, purchases: invoices, payments } = detail;
  const canWrite = hasPermission(role, 'customers.write');
  const canPay = hasPermission(role, 'payments.record');
  const canSeeSales = hasPermission(role, 'sales.view');
  const openInvoices = canPay && canSeeSales ? await listOpenInvoicesForCustomer(customer.id) : [];

  const balance = Number(customer.balance_due);
  const limit = Number(customer.credit_limit);
  const overLimit = limit > 0 && balance > limit;

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {customer.phone && <span>{customer.phone}</span>}
            <ActiveBadge active={customer.is_active} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/customers">
                <ArrowLeft data-icon="inline-start" />
                All Customers
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/customers/${customer.id}/statement`}>
                <FileText data-icon="inline-start" />
                Statement
              </Link>
            </Button>
            {canWrite && <CustomerFormDialog customer={customer} />}
            {canPay && (
              <PaymentDialog
                kind="customer"
                partyId={customer.id}
                partyName={customer.name}
                balance={balance}
                openBills={openInvoices.map((sale) => ({
                  id: sale.id,
                  number: sale.invoice_number,
                  due_amount: sale.due_amount,
                  created_at: sale.created_at,
                }))}
              />
            )}
          </>
        }
      />

      {overLimit && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Over the credit limit.</p>
          <p className="mt-1 text-muted-foreground">
            This customer owes {formatRs(balance)}, which is more than their limit of{' '}
            {formatRs(limit)}. Collect a payment before giving more credit.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={balance < 0 ? 'Advance (we owe them)' : 'Balance due'}
          value={formatRs(Math.abs(balance))}
          icon={Wallet}
          tone={balance > 0 ? 'danger' : balance < 0 ? 'success' : 'neutral'}
        />
        <StatCard
          label="Credit limit"
          value={limit > 0 ? formatRs(limit) : 'No limit'}
          icon={Gauge}
          hint={limit > 0 ? `${formatRs(Math.max(0, limit - balance))} left` : undefined}
        />
        <StatCard
          label="Total bought"
          value={formatRs(detail.totalSales)}
          icon={ShoppingCart}
          hint={`${detail.invoiceCount} invoice${detail.invoiceCount === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Payments received later"
          value={formatRs(detail.totalPaid)}
          icon={HandCoins}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No invoices yet."
                  description="Sales to this customer will show up here."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">
                            {canSeeSales ? (
                              <Link href={`/sales/${sale.id}`} className="underline-offset-2 hover:underline">
                                {sale.invoice_number}
                              </Link>
                            ) : (
                              sale.invoice_number
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateTime(sale.created_at)}
                          </TableCell>
                          <TableCell className="text-right">{formatRs(sale.total)}</TableCell>
                          <TableCell
                            className={
                              Number(sale.due_amount) > 0 && sale.status === 'completed'
                                ? 'text-right font-medium text-destructive'
                                : 'text-right text-muted-foreground'
                            }
                          >
                            {Number(sale.due_amount) > 0 && sale.status === 'completed'
                              ? formatRs(sale.due_amount)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {sale.status === 'cancelled' ? (
                                <TxStatusBadge status="cancelled" />
                              ) : (
                                <PaymentBadge due={sale.due_amount} total={sale.total} />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments received</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No payments recorded yet."
                  description="Money collected later for credit sales appears here."
                />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {formatRs(payment.amount)}{' '}
                          <span className="font-normal text-muted-foreground">
                            · {paymentMethodLabel(payment.method)}
                            {payment.reference ? ` · ${payment.reference}` : ''}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(payment.created_at)}
                          {payment.profile?.full_name ? ` · by ${payment.profile.full_name}` : ''}
                          {payment.notes ? ` · ${payment.notes}` : ''}
                        </p>
                      </div>
                      {payment.sale_id && canSeeSales && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sales/${payment.sale_id}`}>View invoice</Link>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {customer.phone ?? <span className="text-muted-foreground">No phone</span>}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {customer.email ?? <span className="text-muted-foreground">No email</span>}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                {customer.address ?? <span className="text-muted-foreground">No address</span>}
              </p>
              {customer.notes && <p className="rounded-lg bg-muted p-3">{customer.notes}</p>}
              <p className="text-xs text-muted-foreground">
                Customer since {formatDateTime(customer.created_at)}
              </p>
            </CardContent>
          </Card>

          {canWrite && (
            <Card>
              <CardContent className="space-y-3 pt-6 text-sm">
                <p className="text-muted-foreground">
                  {customer.is_active
                    ? 'No longer buying from you? Deactivate to hide them from the sale screen.'
                    : 'This customer is hidden from the sale screen.'}
                </p>
                <PartyActiveButton
                  kind="customer"
                  id={customer.id}
                  name={customer.name}
                  active={customer.is_active}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

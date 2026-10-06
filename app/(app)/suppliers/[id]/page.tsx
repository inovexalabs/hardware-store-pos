import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getSupplier, listOpenBillsForSupplier } from '@/services/parties';
import { PageHeader } from '@/components/shared/page-header';
import { ActiveBadge, PaymentBadge, TxStatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PaymentDialog } from '@/components/shared/payment-dialog';
import { PartyActiveButton } from '@/components/shared/party-active-button';
import { SupplierFormDialog } from '@/components/suppliers/supplier-form-dialog';
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
  Plus,
  Truck,
  Wallet,
  IdCard,
} from 'lucide-react';

export const metadata = { title: 'Supplier Details' };

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('suppliers.view');
  const role = ctx.profile.role;

  const detail = await getSupplier(id);
  if (!detail) notFound();

  const { supplier, purchases, payments } = detail;
  const canWrite = hasPermission(role, 'suppliers.write');
  const canPay = hasPermission(role, 'payments.record');
  const canSeePurchases = hasPermission(role, 'purchases.view');
  const canBuy = hasPermission(role, 'purchases.write') && supplier.is_active;
  const openBills = canPay && canSeePurchases ? await listOpenBillsForSupplier(supplier.id) : [];
  const balance = Number(supplier.balance_payable);

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.company ? `${supplier.name} — ${supplier.company}` : supplier.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {supplier.phone && <span>{supplier.phone}</span>}
            <ActiveBadge active={supplier.is_active} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/suppliers">
                <ArrowLeft data-icon="inline-start" />
                All Suppliers
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/suppliers/${supplier.id}/statement`}>
                <FileText data-icon="inline-start" />
                Statement
              </Link>
            </Button>
            {canWrite && <SupplierFormDialog supplier={supplier} />}
            {canBuy && (
              <Button variant="outline" asChild>
                <Link href={`/purchases/new?supplier=${supplier.id}`}>
                  <Plus data-icon="inline-start" />
                  New Purchase
                </Link>
              </Button>
            )}
            {canPay && (
              <PaymentDialog
                kind="supplier"
                partyId={supplier.id}
                partyName={supplier.name}
                balance={balance}
                openBills={openBills.map((bill) => ({
                  id: bill.id,
                  number: bill.purchase_number,
                  due_amount: bill.due_amount,
                  created_at: bill.created_at,
                }))}
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={balance < 0 ? 'Advance (they owe us)' : 'We owe'}
          value={formatRs(Math.abs(balance))}
          icon={Wallet}
          tone={balance > 0 ? 'danger' : balance < 0 ? 'success' : 'neutral'}
        />
        <StatCard
          label="Total purchased"
          value={formatRs(detail.totalPurchases)}
          icon={Truck}
          hint={`${detail.purchaseCount} purchase${detail.purchaseCount === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Payments made later"
          value={formatRs(detail.totalPaid)}
          icon={HandCoins}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent purchases</CardTitle>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No purchases yet."
                  description="Stock you buy from this supplier will show up here."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Purchase</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">
                            {canSeePurchases ? (
                              <Link
                                href={`/purchases/${purchase.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {purchase.purchase_number}
                              </Link>
                            ) : (
                              purchase.purchase_number
                            )}
                            {purchase.supplier_invoice_no && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                Bill {purchase.supplier_invoice_no}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateTime(purchase.created_at)}
                          </TableCell>
                          <TableCell className="text-right">{formatRs(purchase.total)}</TableCell>
                          <TableCell
                            className={
                              Number(purchase.due_amount) > 0 && purchase.status === 'completed'
                                ? 'text-right font-medium text-destructive'
                                : 'text-right text-muted-foreground'
                            }
                          >
                            {Number(purchase.due_amount) > 0 && purchase.status === 'completed'
                              ? formatRs(purchase.due_amount)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {purchase.status === 'cancelled' ? (
                              <TxStatusBadge status="cancelled" />
                            ) : (
                              <PaymentBadge due={purchase.due_amount} total={purchase.total} />
                            )}
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
              <CardTitle className="text-base">Payments made</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No payments recorded yet."
                  description="Money you pay this supplier after a purchase appears here."
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
                      {payment.purchase_id && canSeePurchases && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/purchases/${payment.purchase_id}`}>View purchase</Link>
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
                {supplier.phone ?? <span className="text-muted-foreground">No phone</span>}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {supplier.email ?? <span className="text-muted-foreground">No email</span>}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                {supplier.address ?? <span className="text-muted-foreground">No address</span>}
              </p>
              <p className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                {supplier.pan_vat ? (
                  `PAN/VAT ${supplier.pan_vat}`
                ) : (
                  <span className="text-muted-foreground">No PAN/VAT number</span>
                )}
              </p>
              {supplier.notes && <p className="rounded-lg bg-muted p-3">{supplier.notes}</p>}
            </CardContent>
          </Card>

          {canWrite && (
            <Card>
              <CardContent className="space-y-3 pt-6 text-sm">
                <p className="text-muted-foreground">
                  {supplier.is_active
                    ? 'Stopped buying from them? Deactivate to hide them from new purchases.'
                    : 'This supplier is hidden from new purchases.'}
                </p>
                <PartyActiveButton
                  kind="supplier"
                  id={supplier.id}
                  name={supplier.name}
                  active={supplier.is_active}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

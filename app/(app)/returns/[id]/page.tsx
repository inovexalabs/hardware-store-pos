import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getReturn } from '@/services/returns';
import { PageHeader } from '@/components/shared/page-header';
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
import { formatDateTime, formatQty, formatRs, isUuid } from '@/utils/format';
import { ArrowLeft, Printer } from 'lucide-react';

export const metadata = { title: 'Return Details' };

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('returns.process');
  const role = ctx.profile.role;

  const detail = await getReturn(id);
  if (!detail) notFound();

  const isSales = detail.kind === 'sales';
  const sourceHref = detail.source
    ? isSales
      ? hasPermission(role, 'sales.view') && `/sales/${detail.source.id}`
      : hasPermission(role, 'purchases.view') && `/purchases/${detail.source.id}`
    : null;
  const partyHref = detail.party
    ? isSales
      ? hasPermission(role, 'customers.view') && `/customers/${detail.party.id}`
      : hasPermission(role, 'suppliers.view') && `/suppliers/${detail.party.id}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.return_number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{isSales ? 'Customer return' : 'Returned to supplier'}</Badge>
            <span>{formatDateTime(detail.created_at)}</span>
            {detail.made_by && <span>by {detail.made_by}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/returns?type=${detail.kind}`}>
                <ArrowLeft data-icon="inline-start" />
                All Returns
              </Link>
            </Button>
            <Button asChild>
              <a href={`/returns/${detail.id}/print`} target="_blank" rel="noreferrer">
                <Printer data-icon="inline-start" />
                Print {isSales ? 'Credit Note' : 'Debit Note'}
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items returned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{item.product_name}</span>
                        <span className="block text-xs text-muted-foreground">{item.sku}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQty(item.quantity, item.unit_name ?? undefined)}
                      </TableCell>
                      <TableCell className="text-right">{formatRs(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatRs(item.line_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isSales && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Goods value</span>
                    <span>{formatRs(detail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT refunded</span>
                    <span>{formatRs(detail.tax_amount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>{isSales ? 'Total refund' : 'Return value'}</span>
                <span>{formatRs(detail.total)}</span>
              </div>
              {detail.reason && <p className="rounded-lg bg-muted p-3">{detail.reason}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{isSales ? 'Invoice' : 'Purchase'}</span>
                {detail.source && sourceHref ? (
                  <Link href={sourceHref} className="font-medium underline">
                    {detail.source.number}
                  </Link>
                ) : (
                  <span className="font-medium">{detail.source?.number ?? '—'}</span>
                )}
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{isSales ? 'Customer' : 'Supplier'}</span>
                {detail.party && partyHref ? (
                  <Link href={partyHref} className="font-medium underline">
                    {detail.party.name}
                  </Link>
                ) : (
                  <span className="font-medium">
                    {detail.party?.name ?? (isSales ? 'Walk-in customer' : '—')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listPurchases } from '@/services/purchases';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { DateRangeFilter } from '@/components/shared/date-range-filter';
import { Pagination } from '@/components/shared/pagination';
import { PaymentBadge, TxStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatRs, isIsoDate, isUuid } from '@/utils/format';
import { Eye, Plus, Truck } from 'lucide-react';

export const metadata = { title: 'Purchases' };

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    supplier?: string;
    page?: string;
  }>;
}) {
  const ctx = await requirePermission('purchases.view');
  const params = await searchParams;
  const canCreate = hasPermission(ctx.profile.role, 'purchases.write');

  const status = (['completed', 'cancelled'] as const).includes(params.status as 'completed')
    ? (params.status as 'completed' | 'cancelled')
    : 'all';

  const result = await listPurchases({
    search: params.q,
    status,
    from: isIsoDate(params.from) ? params.from : undefined,
    to: isIsoDate(params.to) ? params.to : undefined,
    supplier_id: isUuid(params.supplier) ? params.supplier : undefined,
    page: Number(params.page) || 1,
    perPage: 20,
  });

  const query = {
    q: params.q,
    status: params.status,
    from: params.from,
    to: params.to,
    supplier: params.supplier,
  };
  const hasFilters = Boolean(
    params.q || params.from || params.to || params.supplier || status !== 'all'
  );

  return (
    <div>
      <PageHeader
        title="Purchases"
        description={
          result.count > 0
            ? `${result.count} purchase${result.count === 1 ? '' : 's'}`
            : 'Stock you bought from suppliers'
        }
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/purchases/new">
                <Plus data-icon="inline-start" />
                New Purchase
              </Link>
            </Button>
          )
        }
      />

      <FilterBar
        searchPlaceholder="Purchase no., supplier bill no. or supplier…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: status === 'all' ? '' : status,
            options: [
              { value: '', label: 'All' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
      >
        <DateRangeFilter />
      </FilterBar>

      {params.supplier && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing one supplier only.{' '}
          <Link href="/purchases" className="underline">
            Show all suppliers
          </Link>
        </p>
      )}

      {result.count === 0 ? (
        <EmptyState
          icon={Truck}
          title={hasFilters ? 'No purchases found.' : 'No purchases yet.'}
          description={
            hasFilters
              ? 'Try a different search or date range.'
              : 'When new stock arrives, enter the supplier bill here so stock and costs stay correct.'
          }
          action={
            !hasFilters && canCreate ? (
              <Button asChild>
                <Link href="/purchases/new">
                  <Plus data-icon="inline-start" />
                  Enter a purchase
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/purchases/${purchase.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {purchase.purchase_number}
                      </Link>
                      {purchase.supplier_invoice_no && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Bill {purchase.supplier_invoice_no}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(purchase.created_at)}
                    </TableCell>
                    <TableCell>
                      {purchase.supplier?.name ?? '—'}
                      {purchase.supplier?.company && (
                        <span className="block text-xs text-muted-foreground">
                          {purchase.supplier.company}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatRs(purchase.total)}</TableCell>
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
                      <div className="flex flex-wrap gap-1">
                        <TxStatusBadge status={purchase.status} />
                        {purchase.status === 'completed' && (
                          <PaymentBadge due={purchase.due_amount} total={purchase.total} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/purchases/${purchase.id}`}>
                          <Eye data-icon="inline-start" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {result.rows.map((purchase) => (
              <li key={purchase.id}>
                <Link href={`/purchases/${purchase.id}`} className="block rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{purchase.purchase_number}</span>
                    <span className="font-semibold">{formatRs(purchase.total)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {purchase.supplier?.name ?? '—'} · {formatDateTime(purchase.created_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <TxStatusBadge status={purchase.status} />
                    {purchase.status === 'completed' && (
                      <PaymentBadge due={purchase.due_amount} total={purchase.total} />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/purchases"
            query={query}
          />
        </>
      )}
    </div>
  );
}

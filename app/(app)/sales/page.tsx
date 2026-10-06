import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listSales } from '@/services/sales';
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
import { formatRs, formatDateTime } from '@/utils/format';
import { ShoppingCart, Plus, Eye } from 'lucide-react';

export const metadata = { title: 'Sales' };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const ctx = await requirePermission('sales.view');
  const params = await searchParams;
  const canCreate = hasPermission(ctx.profile.role, 'sales.create');

  const status = (['all', 'completed', 'cancelled'] as const).includes(
    params.status as 'all'
  )
    ? (params.status as 'all' | 'completed' | 'cancelled')
    : 'all';

  const result = await listSales({
    search: params.q,
    status,
    from: params.from,
    to: params.to,
    page: Number(params.page) || 1,
    perPage: 20,
  });

  const query = { q: params.q, status: params.status, from: params.from, to: params.to };
  const hasFilters = Boolean(params.q || params.from || params.to || status !== 'all');

  return (
    <div>
      <PageHeader
        title="Sales"
        description={
          result.count > 0
            ? `${result.count} invoice${result.count === 1 ? '' : 's'}`
            : undefined
        }
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/sales/new">
                <Plus data-icon="inline-start" />
                New Sale
              </Link>
            </Button>
          )
        }
      />

      <FilterBar
        searchPlaceholder="Invoice number, customer…"
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
        ]}        >
          <DateRangeFilter />
        </FilterBar>

      {result.count === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={hasFilters ? 'No sales found.' : 'No sales yet.'}
          description={
            hasFilters
              ? 'Try a different search or date range.'
              : 'Your first sale will appear here after you charge it from the New Sale screen.'
          }
          action={
            !hasFilters && canCreate ? (
              <Button asChild>
                <Link href="/sales/new">
                  <Plus data-icon="inline-start" />
                  Start a sale
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      <Link href={`/sales/${sale.id}`} className="underline-offset-2 hover:underline">
                        {sale.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(sale.created_at)}
                    </TableCell>
                    <TableCell>{sale.customer?.name ?? 'Walk-in'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatRs(sale.total)}
                    </TableCell>
                    <TableCell
                      className={
                        Number(sale.due_amount) > 0
                          ? 'text-right font-medium text-destructive'
                          : 'text-right text-muted-foreground'
                      }
                    >
                      {Number(sale.due_amount) > 0 ? formatRs(sale.due_amount) : '—'}
                    </TableCell>
                    <TableCell className="capitalize">{sale.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <TxStatusBadge status={sale.status} />
                        {sale.status === 'completed' && (
                          <PaymentBadge due={sale.due_amount} total={sale.total} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/sales/${sale.id}`}>
                          <Eye className="h-4 w-4" data-icon="inline-start" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {result.rows.map((sale) => (
              <li key={sale.id}>
                <Link
                  href={`/sales/${sale.id}`}
                  className="block rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{sale.invoice_number}</span>
                    <span className="font-semibold">{formatRs(sale.total)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sale.customer?.name ?? 'Walk-in'} · {formatDateTime(sale.created_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <TxStatusBadge status={sale.status} />
                    {sale.status === 'completed' && (
                      <PaymentBadge due={sale.due_amount} total={sale.total} />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={result.page} totalPages={result.totalPages} basePath="/sales" query={query} />
        </>
      )}
    </div>
  );
}

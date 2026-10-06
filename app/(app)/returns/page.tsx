import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listReturns, type ReturnKind } from '@/services/returns';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { DateRangeFilter } from '@/components/shared/date-range-filter';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRs, isIsoDate } from '@/utils/format';
import { Eye, Undo2, UserRound, Truck } from 'lucide-react';

export const metadata = { title: 'Returns' };

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const ctx = await requirePermission('returns.process');
  const role = ctx.profile.role;
  const params = await searchParams;

  // a return can only be made against a bill the person is allowed to see
  const canSales = hasPermission(role, 'sales.view');
  const canPurchase = hasPermission(role, 'purchases.view');
  const kind: ReturnKind =
    params.type === 'purchase' && canPurchase ? 'purchase' : canSales ? 'sales' : 'purchase';

  const result = await listReturns({
    kind,
    search: params.q,
    from: isIsoDate(params.from) ? params.from : undefined,
    to: isIsoDate(params.to) ? params.to : undefined,
    page: Number(params.page) || 1,
    perPage: 20,
  });

  const isSales = kind === 'sales';
  const hasFilters = Boolean(params.q || params.from || params.to);
  const query = { type: kind, q: params.q, from: params.from, to: params.to };

  return (
    <div>
      <PageHeader
        title="Returns"
        description="Goods coming back from customers, and goods you send back to suppliers."
        actions={
          <>
            {canSales && (
              <Button asChild>
                <Link href="/returns/new?type=sales">
                  <UserRound data-icon="inline-start" />
                  Customer Return
                </Link>
              </Button>
            )}
            {canPurchase && (
              <Button variant={canSales ? 'outline' : 'default'} asChild>
                <Link href="/returns/new?type=purchase">
                  <Truck data-icon="inline-start" />
                  Return to Supplier
                </Link>
              </Button>
            )}
          </>
        }
      />

      {canSales && canPurchase && (
        <div className="mb-4 inline-flex rounded-lg border bg-card p-1" role="tablist">
          {(
            [
              { value: 'sales', label: 'From customers' },
              { value: 'purchase', label: 'To suppliers' },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.value}
              href={`/returns?type=${tab.value}`}
              role="tab"
              aria-selected={kind === tab.value}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                kind === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <FilterBar
        searchPlaceholder={isSales ? 'Return no., invoice no. or reason…' : 'Return no., purchase no. or reason…'}
        searchValue={params.q ?? ''}
      >
        <DateRangeFilter />
      </FilterBar>

      {result.count === 0 ? (
        <EmptyState
          icon={Undo2}
          title={hasFilters ? 'No returns found.' : 'No returns yet.'}
          description={
            hasFilters
              ? 'Try a different search or date range.'
              : isSales
                ? 'When a customer brings goods back, record it here so stock and their balance stay right.'
                : 'When you send goods back to a supplier, record it here so stock and what you owe stay right.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>{isSales ? 'Invoice' : 'Purchase'}</TableHead>
                  <TableHead>{isSales ? 'Customer' : 'Supplier'}</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">{isSales ? 'Refund' : 'Value'}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link href={`/returns/${row.id}`} className="underline-offset-2 hover:underline">
                        {row.return_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      {row.source_number ? (
                        <Link
                          href={isSales ? `/sales/${row.source_id}` : `/purchases/${row.source_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {row.source_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{row.party_name ?? '—'}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {row.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatRs(row.total)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/returns/${row.id}`}>
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
            {result.rows.map((row) => (
              <li key={row.id}>
                <Link href={`/returns/${row.id}`} className="block rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.return_number}</span>
                    <span className="font-semibold">{formatRs(row.total)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.source_number ?? '—'} · {row.party_name ?? '—'} ·{' '}
                    {formatDateTime(row.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={result.page} totalPages={result.totalPages} basePath="/returns" query={query} />
        </>
      )}
    </div>
  );
}

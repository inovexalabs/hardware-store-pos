import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listAllExpenses, listExpenseCategories, listExpenses } from '@/services/expenses';
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
import { formatDate, formatRs, isIsoDate, isUuid, paymentMethodLabel } from '@/utils/format';
import { Download, Paperclip, Plus, Wallet } from 'lucide-react';

export const metadata = { title: 'Expenses' };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; from?: string; to?: string; page?: string }>;
}) {
  const ctx = await requirePermission('expenses.view');
  const role = ctx.profile.role;
  const params = await searchParams;
  const canWrite = hasPermission(role, 'expenses.write');
  const canExport = hasPermission(role, 'data.export');

  const filters = {
    search: params.q,
    category_id: isUuid(params.category) ? params.category : undefined,
    from: isIsoDate(params.from) ? params.from : undefined,
    to: isIsoDate(params.to) ? params.to : undefined,
  };

  const [result, all, categories] = await Promise.all([
    listExpenses({ ...filters, page: Number(params.page) || 1, perPage: 20 }),
    listAllExpenses(filters),
    listExpenseCategories(),
  ]);
  const total = all.reduce((sum, e) => sum + Number(e.amount), 0);

  const query = { q: params.q, category: params.category, from: params.from, to: params.to };
  const hasFilters = Boolean(params.q || params.category || params.from || params.to);
  const exportQuery = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]))
  ).toString();

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={
          result.count > 0
            ? `${result.count} entr${result.count === 1 ? 'y' : 'ies'} · ${formatRs(total)} in total${hasFilters ? ' for this filter' : ''}`
            : 'Money the shop spends that is not stock'
        }
        actions={
          <>
            {canExport && result.count > 0 && (
              <Button variant="outline" asChild>
                <a href={`/expenses/download${exportQuery ? `?${exportQuery}` : ''}`}>
                  <Download data-icon="inline-start" />
                  Download CSV
                </a>
              </Button>
            )}
            {canWrite && (
              <Button asChild>
                <Link href="/expenses/new">
                  <Plus data-icon="inline-start" />
                  Add Expense
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        searchPlaceholder="Search the details…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'category',
            label: 'Category',
            value: filters.category_id ?? '',
            options: [
              { value: '', label: 'All categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ],
          },
        ]}
      >
        <DateRangeFilter />
      </FilterBar>

      {result.count === 0 ? (
        <EmptyState
          icon={Wallet}
          title={hasFilters ? 'No expenses found.' : 'No expenses yet.'}
          description={
            hasFilters
              ? 'Try a different category or date range.'
              : 'Record rent, bills, salaries and other costs so your profit report is accurate.'
          }
          action={
            !hasFilters && canWrite ? (
              <Button asChild>
                <Link href="/expenses/new">
                  <Plus data-icon="inline-start" />
                  Add your first expense
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
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead>Entered by</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/expenses/${expense.id}`} className="underline-offset-2 hover:underline">
                        {formatDate(expense.spent_on)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{expense.category?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-[20rem] truncate text-muted-foreground">
                      {expense.description ?? '—'}
                    </TableCell>
                    <TableCell>{paymentMethodLabel(expense.method)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.profile?.full_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      {expense.receipt_url ? (
                        <a
                          href={`/expenses/${expense.id}/receipt`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatRs(expense.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {result.rows.map((expense) => (
              <li key={expense.id}>
                <Link href={`/expenses/${expense.id}`} className="block rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {expense.category?.name ?? 'Expense'}
                      {expense.receipt_url && (
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Receipt attached" />
                      )}
                    </span>
                    <span className="font-semibold">{formatRs(expense.amount)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(expense.spent_on)}
                    {expense.description ? ` · ${expense.description}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={result.page} totalPages={result.totalPages} basePath="/expenses" query={query} />
        </>
      )}
    </div>
  );
}

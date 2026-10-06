import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listCustomers } from '@/services/parties';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { Pagination } from '@/components/shared/pagination';
import { ActiveBadge } from '@/components/shared/status-badge';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRs } from '@/utils/format';
import { Eye, Users } from 'lucide-react';

export const metadata = { title: 'Customers' };

function BalanceCell({ amount }: { amount: number }) {
  const value = Number(amount);
  if (value > 0) return <span className="font-medium text-destructive">{formatRs(value)}</span>;
  if (value < 0) return <span className="text-success">{formatRs(Math.abs(value))} advance</span>;
  return <span className="text-muted-foreground">—</span>;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; due?: string; page?: string }>;
}) {
  const ctx = await requirePermission('customers.view');
  const params = await searchParams;
  const canWrite = hasPermission(ctx.profile.role, 'customers.write');
  const dueOnly = params.due === '1';

  const result = await listCustomers({
    search: params.q,
    dueOnly,
    page: Number(params.page) || 1,
    perPage: 20,
  });

  const hasFilters = Boolean(params.q || dueOnly);
  const query = { q: params.q, due: dueOnly ? '1' : undefined };

  return (
    <div>
      <PageHeader
        title="Customers"
        description={
          result.count > 0
            ? `${result.count} customer${result.count === 1 ? '' : 's'}${dueOnly ? ' with money due' : ''}`
            : undefined
        }
        actions={canWrite && <CustomerFormDialog />}
      />

      <FilterBar
        searchPlaceholder="Name, phone or address…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'due',
            label: 'Show',
            value: dueOnly ? '1' : '',
            options: [
              { value: '', label: 'All customers' },
              { value: '1', label: 'Only with money due' },
            ],
          },
        ]}
      />

      {result.count === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? 'No customers found.' : 'No customers yet.'}
          description={
            hasFilters
              ? 'Try a different name or phone number.'
              : 'Add the people who buy on credit or buy often, so you can track what they owe.'
          }
          action={!hasFilters && canWrite ? <CustomerFormDialog /> : undefined}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Balance due</TableHead>
                  <TableHead className="text-right">Credit limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>{customer.phone ?? '—'}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {customer.address ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <BalanceCell amount={customer.balance_due} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {Number(customer.credit_limit) > 0 ? formatRs(customer.credit_limit) : '—'}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={customer.is_active} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/customers/${customer.id}`}>
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
            {result.rows.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="block rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{customer.name}</span>
                    <BalanceCell amount={customer.balance_due} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {customer.phone ?? 'No phone'}
                    {customer.address ? ` · ${customer.address}` : ''}
                  </p>
                  {!customer.is_active && (
                    <div className="mt-2">
                      <ActiveBadge active={false} />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/customers"
            query={query}
          />
        </>
      )}
    </div>
  );
}

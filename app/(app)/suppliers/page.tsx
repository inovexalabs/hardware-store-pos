import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listSuppliers } from '@/services/parties';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { Pagination } from '@/components/shared/pagination';
import { ActiveBadge } from '@/components/shared/status-badge';
import { SupplierFormDialog } from '@/components/suppliers/supplier-form-dialog';
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
import { Building2, Eye } from 'lucide-react';

export const metadata = { title: 'Suppliers' };

function PayableCell({ amount }: { amount: number }) {
  const value = Number(amount);
  if (value > 0) return <span className="font-medium text-destructive">{formatRs(value)}</span>;
  if (value < 0) return <span className="text-success">{formatRs(Math.abs(value))} advance</span>;
  return <span className="text-muted-foreground">—</span>;
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; payable?: string; page?: string }>;
}) {
  const ctx = await requirePermission('suppliers.view');
  const params = await searchParams;
  const canWrite = hasPermission(ctx.profile.role, 'suppliers.write');
  const payableOnly = params.payable === '1';

  const result = await listSuppliers({
    search: params.q,
    payableOnly,
    page: Number(params.page) || 1,
    perPage: 20,
  });

  const hasFilters = Boolean(params.q || payableOnly);
  const query = { q: params.q, payable: payableOnly ? '1' : undefined };

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description={
          result.count > 0
            ? `${result.count} supplier${result.count === 1 ? '' : 's'}${payableOnly ? ' you owe money to' : ''}`
            : undefined
        }
        actions={canWrite && <SupplierFormDialog />}
      />

      <FilterBar
        searchPlaceholder="Name, company or phone…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'payable',
            label: 'Show',
            value: payableOnly ? '1' : '',
            options: [
              { value: '', label: 'All suppliers' },
              { value: '1', label: 'Only those we owe' },
            ],
          },
        ]}
      />

      {result.count === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasFilters ? 'No suppliers found.' : 'No suppliers yet.'}
          description={
            hasFilters
              ? 'Try a different name or phone number.'
              : 'Add the wholesalers and companies you buy stock from.'
          }
          action={!hasFilters && canWrite ? <SupplierFormDialog /> : undefined}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">We owe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{supplier.company ?? '—'}</TableCell>
                    <TableCell>{supplier.phone ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <PayableCell amount={supplier.balance_payable} />
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={supplier.is_active} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/suppliers/${supplier.id}`}>
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
            {result.rows.map((supplier) => (
              <li key={supplier.id}>
                <Link
                  href={`/suppliers/${supplier.id}`}
                  className="block rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{supplier.name}</span>
                    <PayableCell amount={supplier.balance_payable} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {supplier.company ?? 'No company'}
                    {supplier.phone ? ` · ${supplier.phone}` : ''}
                  </p>
                  {!supplier.is_active && (
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
            basePath="/suppliers"
            query={query}
          />
        </>
      )}
    </div>
  );
}

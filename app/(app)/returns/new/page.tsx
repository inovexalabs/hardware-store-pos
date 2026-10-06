import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listSales } from '@/services/sales';
import { listPurchases } from '@/services/purchases';
import { getReturnablePurchase, getReturnableSale } from '@/services/returns';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { ReturnForm } from '@/components/returns/return-form';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatRs, isUuid } from '@/utils/format';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';

export const metadata = { title: 'New Return' };

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; sale?: string; purchase?: string }>;
}) {
  const ctx = await requirePermission('returns.process');
  const role = ctx.profile.role;
  const params = await searchParams;
  const canSales = hasPermission(role, 'sales.view');
  const canPurchase = hasPermission(role, 'purchases.view');

  const back = (
    <Button variant="outline" asChild>
      <Link href="/returns">
        <ArrowLeft data-icon="inline-start" />
        All Returns
      </Link>
    </Button>
  );

  // ---------- step 2a: customer return against one invoice ----------
  if (params.sale) {
    if (!canSales) redirect('/not-authorized');
    if (!isUuid(params.sale)) notFound();
    const data = await getReturnableSale(params.sale);
    if (!data) notFound();
    const { sale } = data;

    return (
      <div>
        <PageHeader
          title={`Customer return — ${sale.invoice_number}`}
          description={`${sale.customer?.name ?? 'Walk-in customer'} · ${formatDateTime(sale.created_at)} · invoice total ${formatRs(sale.total)}`}
          actions={back}
        />
        {sale.status === 'cancelled' ? (
          <EmptyState
            title="This invoice was cancelled."
            description="Its stock was already put back, so nothing can be returned against it."
          />
        ) : (
          <ReturnForm
            kind="sales"
            sourceId={sale.id}
            lines={data.lines}
            hasCustomer={Boolean(sale.customer_id)}
            invoiceDue={Number(sale.due_amount)}
          />
        )}
      </div>
    );
  }

  // ---------- step 2b: return to supplier against one purchase ----------
  if (params.purchase) {
    if (!canPurchase) redirect('/not-authorized');
    if (!isUuid(params.purchase)) notFound();
    const data = await getReturnablePurchase(params.purchase);
    if (!data) notFound();
    const { purchase } = data;

    return (
      <div>
        <PageHeader
          title={`Return to supplier — ${purchase.purchase_number}`}
          description={`${purchase.supplier?.company ?? purchase.supplier?.name ?? 'Supplier'} · ${formatDateTime(purchase.created_at)} · quantities are in each product's stock unit`}
          actions={back}
        />
        {purchase.status === 'cancelled' ? (
          <EmptyState
            title="This purchase was cancelled."
            description="Its stock was already removed, so nothing can be returned against it."
          />
        ) : (
          <ReturnForm kind="purchase" sourceId={purchase.id} lines={data.lines} />
        )}
      </div>
    );
  }

  // ---------- step 1: find the invoice / purchase ----------
  const type = params.type === 'purchase' && canPurchase ? 'purchase' : canSales ? 'sales' : 'purchase';
  const isSales = type === 'sales';
  const search = params.q?.trim() ?? '';

  const matches = isSales
    ? (await listSales({ search, status: 'completed', perPage: 10 })).rows.map((sale) => ({
        id: sale.id,
        number: sale.invoice_number,
        party: sale.customer?.name ?? 'Walk-in customer',
        created_at: sale.created_at,
        total: sale.total,
        href: `/returns/new?sale=${sale.id}`,
      }))
    : (await listPurchases({ search, status: 'completed', perPage: 10 })).rows.map((purchase) => ({
        id: purchase.id,
        number: purchase.purchase_number,
        party: purchase.supplier?.company ?? purchase.supplier?.name ?? '—',
        created_at: purchase.created_at,
        total: purchase.total,
        href: `/returns/new?purchase=${purchase.id}`,
      }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isSales ? 'Customer Return' : 'Return to Supplier'}
        description={
          isSales
            ? 'Find the invoice the goods were sold on. Look at the customer’s receipt for the number.'
            : 'Find the purchase the goods came in on.'
        }
        actions={back}
      />

      <FilterBar
        searchPlaceholder={isSales ? 'Invoice number or customer name…' : 'Purchase number, supplier bill no. or supplier…'}
        searchValue={search}
        showClear={false}
      />

      {matches.length === 0 ? (
        <EmptyState
          icon={Search}
          title={search ? 'Nothing found.' : isSales ? 'No invoices yet.' : 'No purchases yet.'}
          description={
            search
              ? 'Check the number on the receipt and try again.'
              : 'Only completed bills can have returns.'
          }
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {search ? 'Matching bills' : 'Most recent bills'} — choose one:
          </p>
          <ul className="space-y-2">
            {matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={match.href}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:border-primary/50"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{match.number}</span>
                    <span className="block text-sm text-muted-foreground">
                      {match.party} · {formatDateTime(match.created_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-semibold">
                    {formatRs(match.total)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

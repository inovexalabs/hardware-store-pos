import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getSupplier, getSupplierStatement } from '@/services/parties';
import { PageHeader } from '@/components/shared/page-header';
import { StatementTable } from '@/components/shared/statement-table';
import { ReportDateRange } from '@/components/reports/report-date-range';
import { Button } from '@/components/ui/button';
import { daysAgoInShopTimezone, formatDateRange, resolveDateRange, isUuid } from '@/utils/format';
import { ArrowLeft, Printer } from 'lucide-react';

export const metadata = { title: 'Supplier Statement' };

export default async function SupplierStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requirePermission('suppliers.view');
  const { from, to } = resolveDateRange(await searchParams, daysAgoInShopTimezone(89));

  const detail = await getSupplier(id);
  if (!detail) notFound();
  const rows = await getSupplierStatement(id, from, to);
  const { supplier } = detail;

  return (
    <div>
      <PageHeader
        title={`Statement — ${supplier.company ?? supplier.name}`}
        description={`${formatDateRange(from, to)}. Debit is what you bought; credit is what you paid or returned.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/suppliers/${supplier.id}`}>
                <ArrowLeft data-icon="inline-start" />
                Back to Supplier
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/suppliers/${supplier.id}/print?from=${from}&to=${to}`} target="_blank">
                <Printer data-icon="inline-start" />
                Print Statement
              </Link>
            </Button>
          </>
        }
      />

      <ReportDateRange key={`${from}_${to}`} from={from} to={to} />

      <StatementTable rows={rows} balanceLabel="We owe" />
      <p className="mt-3 text-sm text-muted-foreground">
        A balance marked &quot;advance&quot; means you have paid this supplier more than you owe.
      </p>
    </div>
  );
}

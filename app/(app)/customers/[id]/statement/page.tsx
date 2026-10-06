import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getCustomer, getCustomerStatement } from '@/services/parties';
import { PageHeader } from '@/components/shared/page-header';
import { StatementTable } from '@/components/shared/statement-table';
import { ReportDateRange } from '@/components/reports/report-date-range';
import { Button } from '@/components/ui/button';
import { daysAgoInShopTimezone, formatDateRange, resolveDateRange, isUuid } from '@/utils/format';
import { ArrowLeft, Printer } from 'lucide-react';

export const metadata = { title: 'Customer Statement' };

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requirePermission('customers.view');
  const { from, to } = resolveDateRange(await searchParams, daysAgoInShopTimezone(89));

  const detail = await getCustomer(id);
  if (!detail) notFound();
  const rows = await getCustomerStatement(id, from, to);
  const { customer } = detail;

  return (
    <div>
      <PageHeader
        title={`Statement — ${customer.name}`}
        description={`${formatDateRange(from, to)}. Debit is what they bought; credit is what they paid or returned.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/customers/${customer.id}`}>
                <ArrowLeft data-icon="inline-start" />
                Back to Customer
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/customers/${customer.id}/print?from=${from}&to=${to}`} target="_blank">
                <Printer data-icon="inline-start" />
                Print Statement
              </Link>
            </Button>
          </>
        }
      />

      <ReportDateRange key={`${from}_${to}`} from={from} to={to} />

      <StatementTable rows={rows} balanceLabel="Customer owes" />
      <p className="mt-3 text-sm text-muted-foreground">
        A balance marked &quot;advance&quot; means the customer has paid more than they owe.
      </p>
    </div>
  );
}

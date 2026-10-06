import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getCustomer, getCustomerStatement } from '@/services/parties';
import { getShopSettings } from '@/services/settings';
import { PrintDocument } from '@/components/shared/print-document';
import { PrintButton } from '@/components/shared/print-button';
import { StatementTable } from '@/components/shared/statement-table';
import { Button } from '@/components/ui/button';
import { daysAgoInShopTimezone, formatDateRange, formatRs, resolveDateRange, isUuid } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Customer Statement' };

export default async function CustomerStatementPrintPage({
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

  const [detail, rows, settings] = await Promise.all([
    getCustomer(id),
    getCustomerStatement(id, from, to),
    getShopSettings(),
  ]);
  if (!detail) notFound();
  const { customer } = detail;
  const closing = rows.length > 0 ? Number(rows[rows.length - 1].balance) : 0;

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/customers/${customer.id}/statement?from=${from}&to=${to}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Statement
          </Link>
        </Button>
        <PrintButton logLabel={`Statement — ${customer.name}`} />
      </div>

      <PrintDocument
        settings={settings}
        title="STATEMENT"
        meta={<p>{formatDateRange(from, to)}</p>}
        footer={
          <p>
            {closing > 0
              ? `Amount due: ${formatRs(closing)}. Please clear the balance at your earliest convenience.`
              : closing < 0
                ? `You have an advance of ${formatRs(Math.abs(closing))} with us.`
                : 'Your account is fully settled. Thank you!'}
          </p>
        }
      >
        <section className="a4-parties">
          <div>
            <h3>Customer</h3>
            <p>
              <strong>{customer.name}</strong>
            </p>
            {customer.phone && <p>{customer.phone}</p>}
            {customer.address && <p>{customer.address}</p>}
          </div>
          <div>
            <h3>Closing balance</h3>
            <p>
              <strong>
                {closing < 0 ? `${formatRs(Math.abs(closing))} advance` : formatRs(closing)}
              </strong>
            </p>
          </div>
        </section>
        <StatementTable rows={rows} balanceLabel="Balance" print />
      </PrintDocument>
    </div>
  );
}

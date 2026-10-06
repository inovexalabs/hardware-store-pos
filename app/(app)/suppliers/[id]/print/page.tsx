import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getSupplier, getSupplierStatement } from '@/services/parties';
import { getShopSettings } from '@/services/settings';
import { PrintDocument } from '@/components/shared/print-document';
import { PrintButton } from '@/components/shared/print-button';
import { StatementTable } from '@/components/shared/statement-table';
import { Button } from '@/components/ui/button';
import { daysAgoInShopTimezone, formatDateRange, formatRs, resolveDateRange, isUuid } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Supplier Statement' };

export default async function SupplierStatementPrintPage({
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

  const [detail, rows, settings] = await Promise.all([
    getSupplier(id),
    getSupplierStatement(id, from, to),
    getShopSettings(),
  ]);
  if (!detail) notFound();
  const { supplier } = detail;
  const closing = rows.length > 0 ? Number(rows[rows.length - 1].balance) : 0;

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/suppliers/${supplier.id}/statement?from=${from}&to=${to}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Statement
          </Link>
        </Button>
        <PrintButton logLabel={`Statement — ${supplier.company ?? supplier.name}`} />
      </div>

      <PrintDocument
        settings={settings}
        title="STATEMENT"
        meta={<p>{formatDateRange(from, to)}</p>}
        footer={
          <p>
            {closing > 0
              ? `Balance payable to you: ${formatRs(closing)}.`
              : closing < 0
                ? `Advance paid to you: ${formatRs(Math.abs(closing))}.`
                : 'Our account with you is fully settled.'}
          </p>
        }
      >
        <section className="a4-parties">
          <div>
            <h3>Supplier</h3>
            <p>
              <strong>{supplier.company ?? supplier.name}</strong>
            </p>
            {supplier.company && <p>Attn: {supplier.name}</p>}
            {supplier.phone && <p>{supplier.phone}</p>}
            {supplier.address && <p>{supplier.address}</p>}
            {supplier.pan_vat && <p>PAN/VAT: {supplier.pan_vat}</p>}
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

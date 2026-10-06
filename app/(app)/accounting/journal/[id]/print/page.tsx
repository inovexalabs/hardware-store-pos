import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getJournalEntry } from '@/services/accounting';
import { getShopSettings } from '@/services/settings';
import { SOURCE_LABELS } from '@/lib/accounting';
import { PrintDocument } from '@/components/shared/print-document';
import { PrintButton } from '@/components/shared/print-button';
import { JournalLinesTable } from '@/components/accounting/journal-lines-table';
import { Button } from '@/components/ui/button';
import { formatDate, isUuid } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Journal Voucher' };

export default async function JournalVoucherPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requirePermission('accounting.view');

  const [entry, settings] = await Promise.all([getJournalEntry(id), getShopSettings()]);
  if (!entry) notFound();

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/accounting/journal/${entry.id}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Entry
          </Link>
        </Button>
        <PrintButton logLabel={`Journal voucher ${entry.entry_number}`} />
      </div>

      <PrintDocument
        settings={settings}
        title="JOURNAL VOUCHER"
        meta={
          <>
            <p>No. {entry.entry_number}</p>
            <p>Date: {formatDate(entry.entry_date)}</p>
            {entry.reference && <p>Ref: {entry.reference}</p>}
          </>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '48px 0 16px' }}>
            <p>Prepared by: {entry.profile?.full_name ?? '________________'}</p>
            <p>Approved by: ________________</p>
          </div>
        }
      >
        <p style={{ margin: '12px 0' }}>
          <strong>{entry.narration}</strong>
          <br />
          <span className="a4-sub">{SOURCE_LABELS[entry.source_type]}</span>
        </p>
        <JournalLinesTable lines={entry.lines} entryDate={entry.entry_date} print />
      </PrintDocument>
    </div>
  );
}

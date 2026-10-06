import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getJournalEntry } from '@/services/accounting';
import { SOURCE_LABELS, sourceHref } from '@/lib/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { JournalLinesTable } from '@/components/accounting/journal-lines-table';
import { ReverseEntryButton } from '@/components/accounting/reverse-entry-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime, isUuid } from '@/utils/format';
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react';

export const metadata = { title: 'Journal Entry' };

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('accounting.view');
  const canWrite = hasPermission(ctx.profile.role, 'accounting.write');

  const entry = await getJournalEntry(id);
  if (!entry) notFound();

  const firstCustomer = entry.lines.find((line) => line.customer_id)?.customer_id;
  const firstSupplier = entry.lines.find((line) => line.supplier_id)?.supplier_id;
  const documentHref = sourceHref(entry.source_type, entry.source_id, {
    customerId: firstCustomer,
    supplierId: firstSupplier,
    productId: entry.productId,
  });
  const canReverse = canWrite && entry.source_type === 'manual' && !entry.reversedBy;

  return (
    <div className="space-y-6">
      <PageHeader
        title={entry.entry_number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{formatDate(entry.entry_date)}</span>
            <Badge variant={entry.source_type === 'manual' ? 'secondary' : 'outline'}>
              {SOURCE_LABELS[entry.source_type]}
            </Badge>
            {entry.reversedBy && (
              <Badge className="border-transparent bg-danger-subtle">Reversed</Badge>
            )}
            {entry.profile?.full_name && <span>by {entry.profile.full_name}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/accounting/journal">
                <ArrowLeft data-icon="inline-start" />
                Journal
              </Link>
            </Button>
            {canReverse && <ReverseEntryButton entryId={entry.id} entryNumber={entry.entry_number} />}
            <Button asChild>
              <a href={`/accounting/journal/${entry.id}/print`} target="_blank" rel="noreferrer">
                <Printer data-icon="inline-start" />
                Print Voucher
              </a>
            </Button>
          </>
        }
      />

      {entry.reversedBy && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">This entry was reversed.</p>
          <p className="mt-1 text-muted-foreground">
            Cancelled out by{' '}
            <Link href={`/accounting/journal/${entry.reversedBy.id}`} className="font-medium underline">
              {entry.reversedBy.entry_number}
            </Link>{' '}
            on {formatDate(entry.reversedBy.entry_date)}.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Debits and credits</CardTitle>
          </CardHeader>
          <CardContent>
            <JournalLinesTable lines={entry.lines} entryDate={entry.entry_date} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div>
              <p className="text-muted-foreground">Narration</p>
              <p className="font-medium">{entry.narration}</p>
            </div>
            {entry.reference && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-medium">{entry.reference}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Saved</span>
              <span>{formatDateTime(entry.created_at)}</span>
            </div>
            {documentHref && (
              <Button variant="outline" className="w-full" asChild>
                <Link href={documentHref}>
                  <ExternalLink data-icon="inline-start" />
                  {entry.source_type === 'reversal' ? 'Open the original entry' : 'Open the document'}
                </Link>
              </Button>
            )}
            {entry.source_type !== 'manual' && entry.source_type !== 'reversal' && (
              <p className="text-xs text-muted-foreground">
                This entry was made by the app. It changes by itself when the document is edited,
                cancelled or returned.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

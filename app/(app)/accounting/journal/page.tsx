import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listJournalEntries } from '@/services/accounting';
import { SOURCE_FILTERS, SOURCE_LABELS } from '@/lib/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { DateRangeFilter } from '@/components/shared/date-range-filter';
import { Pagination } from '@/components/shared/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRs, isIsoDate } from '@/utils/format';
import { ArrowLeft, Download, NotebookPen, Plus } from 'lucide-react';

export const metadata = { title: 'Journal' };

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; from?: string; to?: string; page?: string }>;
}) {
  const ctx = await requirePermission('accounting.view');
  const role = ctx.profile.role;
  const canWrite = hasPermission(role, 'accounting.write');
  const canExport = hasPermission(role, 'data.export');
  const params = await searchParams;

  const filters = {
    search: params.q,
    source: SOURCE_FILTERS.some((f) => f.value === params.source) ? params.source : undefined,
    from: isIsoDate(params.from) ? params.from : undefined,
    to: isIsoDate(params.to) ? params.to : undefined,
  };
  const result = await listJournalEntries({ ...filters, page: Number(params.page) || 1, perPage: 25 });

  const query = { q: params.q, source: filters.source, from: filters.from, to: filters.to };
  const hasFilters = Boolean(params.q || filters.source || filters.from || filters.to);
  const exportQuery = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]))
  ).toString();

  return (
    <div>
      <PageHeader
        title="Journal"
        description={
          result.count > 0
            ? `${result.count} entr${result.count === 1 ? 'y' : 'ies'}${hasFilters ? ' for this filter' : ''} — the day book of everything posted to the accounts`
            : 'The day book of everything posted to the accounts'
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/accounting">
                <ArrowLeft data-icon="inline-start" />
                Accounting
              </Link>
            </Button>
            {canExport && result.count > 0 && (
              <Button variant="outline" asChild>
                <a href={`/accounting/journal/download${exportQuery ? `?${exportQuery}` : ''}`}>
                  <Download data-icon="inline-start" />
                  Download CSV
                </a>
              </Button>
            )}
            {canWrite && (
              <Button asChild>
                <Link href="/accounting/journal/new">
                  <Plus data-icon="inline-start" />
                  New Entry
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        searchPlaceholder="Entry number, narration or reference…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'source',
            label: 'Show',
            value: filters.source ?? '',
            options: [
              { value: '', label: 'All entries' },
              ...SOURCE_FILTERS.map((f) => ({ value: f.value, label: f.label })),
            ],
          },
        ]}
      >
        <DateRangeFilter />
      </FilterBar>

      {result.count === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={hasFilters ? 'No entries found.' : 'No entries yet.'}
          description={
            hasFilters
              ? 'Try a different filter or date range.'
              : 'Entries appear here by themselves as soon as you sell, buy, take payments or record expenses.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead>Made by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(entry.entry_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/accounting/journal/${entry.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {entry.entry_number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[28rem]">
                      <span className="block truncate">{entry.narration}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant={entry.source_type === 'manual' ? 'secondary' : 'outline'}>
                          {SOURCE_LABELS[entry.source_type]}
                        </Badge>
                        {entry.reference && (
                          <span className="text-xs text-muted-foreground">Ref: {entry.reference}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.profile?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatRs(entry.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {result.rows.map((entry) => (
              <li key={entry.id}>
                <Link href={`/accounting/journal/${entry.id}`} className="block rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{entry.entry_number}</span>
                    <span className="font-semibold tabular-nums">{formatRs(entry.total)}</span>
                  </div>
                  <p className="mt-1 text-sm">{entry.narration}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(entry.entry_date)} · {SOURCE_LABELS[entry.source_type]}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/accounting/journal"
            query={query}
          />
        </>
      )}
    </div>
  );
}

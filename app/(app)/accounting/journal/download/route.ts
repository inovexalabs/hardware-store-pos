import type { NextRequest } from 'next/server';
import { getProfileOrNull } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { SOURCE_FILTERS, SOURCE_LABELS } from '@/lib/accounting';
import { listJournalEntriesWithLines } from '@/services/accounting';
import { csvResponse, toCsv } from '@/utils/csv';
import { isIsoDate, todayInShopTimezone } from '@/utils/format';

/** /accounting/journal/download?from=…&to=…&source=…&q=… → day book CSV, one row per line */
export async function GET(request: NextRequest) {
  const ctx = await getProfileOrNull();
  if (!ctx) return new Response('Please sign in again.', { status: 401 });
  const role = ctx.profile.role;
  if (!hasPermission(role, 'accounting.view') || !hasPermission(role, 'data.export')) {
    return new Response('You do not have permission to download the journal.', { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const source = params.get('source') ?? undefined;
  const entries = await listJournalEntriesWithLines({
    search: params.get('q') ?? undefined,
    source: SOURCE_FILTERS.some((f) => f.value === source) ? source : undefined,
    from: isIsoDate(from) ? from : undefined,
    to: isIsoDate(to) ? to : undefined,
  });

  // oldest first, like a paper day book
  const rows = entries.reverse().flatMap((entry) =>
    entry.lines.map((line) => ({
      date: entry.entry_date,
      entry: entry.entry_number,
      type: SOURCE_LABELS[entry.source_type],
      narration: entry.narration,
      reference: entry.reference ?? '',
      code: line.account.code,
      account: line.account.name,
      party: line.customer?.name ?? line.supplier?.company ?? line.supplier?.name ?? '',
      details: line.memo ?? '',
      debit: Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '',
      credit: Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : '',
    }))
  );

  const csv = toCsv(
    [
      { header: 'Date', value: (r) => r.date },
      { header: 'Entry', value: (r) => r.entry },
      { header: 'Type', value: (r) => r.type },
      { header: 'Narration', value: (r) => r.narration },
      { header: 'Reference', value: (r) => r.reference },
      { header: 'Account code', value: (r) => r.code },
      { header: 'Account', value: (r) => r.account },
      { header: 'Customer / supplier', value: (r) => r.party },
      { header: 'Details', value: (r) => r.details },
      { header: 'Debit (Rs.)', value: (r) => r.debit },
      { header: 'Credit (Rs.)', value: (r) => r.credit },
    ],
    rows
  );

  const suffix = isIsoDate(from) && isIsoDate(to) ? `${from}_to_${to}` : todayInShopTimezone();
  return csvResponse(`journal_${suffix}.csv`, csv);
}

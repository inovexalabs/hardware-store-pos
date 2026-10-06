import type { NextRequest } from 'next/server';
import { getProfileOrNull } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { listAllExpenses } from '@/services/expenses';
import { csvResponse, toCsv } from '@/utils/csv';
import { isIsoDate, isUuid, paymentMethodLabel, todayInShopTimezone } from '@/utils/format';

/** Expenses as CSV (same filters as the Expenses page). */
export async function GET(request: NextRequest) {
  const ctx = await getProfileOrNull();
  if (!ctx) return new Response('Please sign in again.', { status: 401 });
  if (!hasPermission(ctx.profile.role, 'expenses.view') || !hasPermission(ctx.profile.role, 'data.export')) {
    return new Response('You do not have permission to download this.', { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const category = params.get('category');

  const rows = await listAllExpenses({
    search: params.get('q') ?? undefined,
    category_id: isUuid(category) ? category : undefined,
    from: isIsoDate(from) ? from : undefined,
    to: isIsoDate(to) ? to : undefined,
  });

  const csv = toCsv(
    [
      { header: 'Date', value: (e) => e.spent_on },
      { header: 'Category', value: (e) => e.category?.name ?? '' },
      { header: 'Details', value: (e) => e.description ?? '' },
      { header: 'Paid by', value: (e) => paymentMethodLabel(e.method) },
      { header: 'Entered by', value: (e) => e.profile?.full_name ?? '' },
      { header: 'Receipt attached', value: (e) => (e.receipt_url ? 'Yes' : 'No') },
      { header: 'Amount (Rs.)', value: (e) => Number(e.amount).toFixed(2) },
    ],
    rows
  );

  return csvResponse(`expenses_${todayInShopTimezone()}.csv`, csv);
}

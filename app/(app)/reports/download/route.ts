import type { NextRequest } from 'next/server';
import { getProfileOrNull } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { csvCell, getReportDefinition, reportPermission, resolveDays } from '@/services/report-registry';
import { csvResponse, toCsv } from '@/utils/csv';
import { resolveDateRange, todayInShopTimezone } from '@/utils/format';

/** /reports/download?kind=sales-by-day&from=…&to=… → CSV file */
export async function GET(request: NextRequest) {
  const ctx = await getProfileOrNull();
  if (!ctx) return new Response('Please sign in again.', { status: 401 });
  const role = ctx.profile.role;
  const params = request.nextUrl.searchParams;
  const report = getReportDefinition(params.get('kind') ?? '');
  const needed = report ? reportPermission(report) : 'reports.view';
  if (!hasPermission(role, needed) || !hasPermission(role, 'data.export')) {
    return new Response('You do not have permission to download reports.', { status: 403 });
  }
  if (!report) return new Response('Unknown report.', { status: 404 });

  const { from, to } = resolveDateRange({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });
  const days = resolveDays(params.get('days') ?? undefined);
  const rows = await report.load({ from, to, days });

  const csv = toCsv(
    report.columns.map((column) => ({
      header: column.kind === 'money' ? `${column.label} (Rs.)` : column.label,
      value: (row: Record<string, unknown>) => csvCell(column, row),
    })),
    rows
  );

  const suffix = report.asOf
    ? `as_of_${to}`
    : report.usesRange
      ? `${from}_to_${to}`
      : todayInShopTimezone();
  return csvResponse(`${report.kind}_${suffix}.csv`, csv);
}

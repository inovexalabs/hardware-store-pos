import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { getPurchasesTotals, getSalesTotals } from '@/services/reports';
import { canOpenReport, REPORT_GROUPS, REPORTS, type ReportGroup } from '@/services/report-registry';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReportDateRange } from '@/components/reports/report-date-range';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDateRange, formatRs, resolveDateRange } from '@/utils/format';
import {
  ChevronRight,
  CircleDollarSign,
  Receipt,
  TrendingUp,
  Truck,
  Wallet,
  Landmark,
} from 'lucide-react';

export const metadata = { title: 'Reports' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const ctx = await requirePermission('reports.view');
  const role = ctx.profile.role;
  const params = await searchParams;
  const { from, to } = resolveDateRange(params);
  // only tabs with at least one report this person may open
  const groups = REPORT_GROUPS.filter((group) =>
    REPORTS.some((report) => report.group === group.value && canOpenReport(role, report))
  );
  const tab: ReportGroup = groups.some((g) => g.value === params.tab)
    ? (params.tab as ReportGroup)
    : 'sales';

  const [sales, purchases] = await Promise.all([
    getSalesTotals(from, to),
    getPurchasesTotals(from, to),
  ]);

  const rangeQuery = `from=${from}&to=${to}`;
  const reports = REPORTS.filter((report) => report.group === tab && canOpenReport(role, report));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`Summary for ${formatDateRange(from, to)}`} />

      <ReportDateRange key={`${from}_${to}`} from={from} to={to} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Net sales (without VAT)"
          value={formatRs(sales.revenue)}
          icon={Receipt}
          hint={`${sales.sales_count} invoice${sales.sales_count === 1 ? '' : 's'}`}
          href={`/reports/sales-by-day?${rangeQuery}`}
        />
        <StatCard
          label="Gross profit"
          value={formatRs(sales.gross_profit)}
          icon={TrendingUp}
          tone={Number(sales.gross_profit) >= 0 ? 'success' : 'danger'}
          hint="Sales minus cost of goods"
          href={`/reports/profit-loss?${rangeQuery}`}
        />
        <StatCard
          label="Net profit"
          value={formatRs(sales.net_profit)}
          icon={CircleDollarSign}
          tone={Number(sales.net_profit) >= 0 ? 'success' : 'danger'}
          hint={`After ${formatRs(sales.expenses)} expenses`}
          href={`/reports/profit-loss?${rangeQuery}`}
        />
        <StatCard
          label="Purchases"
          value={formatRs(purchases.total)}
          icon={Truck}
          hint={`${purchases.count} purchase${purchases.count === 1 ? '' : 's'}`}
          href={`/reports/purchases-by-day?${rangeQuery}`}
        />
        <StatCard
          label="Unpaid on these purchases"
          value={formatRs(purchases.due)}
          icon={Wallet}
          tone={Number(purchases.due) > 0 ? 'warning' : 'neutral'}
          href="/reports/supplier-payables"
        />
        <StatCard
          label="VAT collected"
          value={formatRs(sales.vat_collected)}
          icon={Landmark}
          hint="Owed to the tax office, not income"
        />
      </div>

      <div>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-card p-1" role="tablist">
          {groups.map((group) => (
            <Link
              key={group.value}
              href={`/reports?tab=${group.value}&${rangeQuery}`}
              role="tab"
              aria-selected={tab === group.value}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                tab === group.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {group.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map((report) => (
            <Link
              key={report.kind}
              href={`/reports/${report.kind}${report.usesRange ? `?${rangeQuery}` : ''}`}
            >
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold">{report.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                    {!report.usesRange && (
                      <p className="mt-2 text-xs font-medium text-primary">Shows right now</p>
                    )}
                    {report.asOf && (
                      <p className="mt-2 text-xs font-medium text-primary">Shows balances on one date</p>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

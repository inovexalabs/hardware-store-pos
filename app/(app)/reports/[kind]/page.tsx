import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import {
  getReportDefinition,
  resolveDays,
  SLOW_MOVING_DAYS,
} from '@/services/report-registry';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ReportDateRange } from '@/components/reports/report-date-range';
import { ReportExportBar } from '@/components/reports/report-export-bar';
import { ReportTable } from '@/components/reports/report-table';
import { Button } from '@/components/ui/button';
import { formatDateRange, formatDateTime, resolveDateRange } from '@/utils/format';
import { ArrowLeft, BarChart3 } from 'lucide-react';

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ from?: string; to?: string; days?: string }>;
}) {
  const { kind } = await params;
  const ctx = await requirePermission('reports.view');
  const report = getReportDefinition(kind);
  if (!report) notFound();

  const query = await searchParams;
  const { from, to } = resolveDateRange(query);
  const days = resolveDays(query.days);
  const rows = await report.load({ from, to, days });

  const exportQuery: Record<string, string> = report.usesRange
    ? { from, to }
    : report.usesDays
      ? { days: String(days) }
      : {};

  return (
    <div>
      <PageHeader
        title={report.title}
        description={
          <>
            {report.description}{' '}
            <span className="font-medium text-foreground">
              {report.usesRange
                ? formatDateRange(from, to)
                : report.usesDays
                  ? `Not sold in the last ${days} days`
                  : `As of ${formatDateTime(new Date())}`}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/reports?tab=${report.group}${report.usesRange ? `&from=${from}&to=${to}` : ''}`}>
                <ArrowLeft data-icon="inline-start" />
                All Reports
              </Link>
            </Button>
            <ReportExportBar
              kind={report.kind}
              query={exportQuery}
              canExport={hasPermission(ctx.profile.role, 'data.export') && rows.length > 0}
            />
          </>
        }
      />

      {report.usesRange && <ReportDateRange key={`${from}_${to}`} from={from} to={to} />}

      {report.usesDays && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <span className="text-sm text-muted-foreground">Not sold in the last</span>
          {SLOW_MOVING_DAYS.map((option) => (
            <Button key={option} size="sm" variant={option === days ? 'default' : 'outline'} asChild>
              <Link href={`/reports/${report.kind}?days=${option}`}>{option} days</Link>
            </Button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title={report.emptyMessage} description="Try a different date range." />
      ) : (
        <ReportTable columns={report.columns} rows={rows} />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: getReportDefinition(kind)?.title ?? 'Report' };
}

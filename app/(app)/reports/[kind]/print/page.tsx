import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getReportDefinition, resolveDays } from '@/services/report-registry';
import { getShopSettings } from '@/services/settings';
import { PrintDocument } from '@/components/shared/print-document';
import { PrintButton } from '@/components/shared/print-button';
import { ReportTable } from '@/components/reports/report-table';
import { Button } from '@/components/ui/button';
import { formatDateRange, formatDateTime, resolveDateRange } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Report' };

export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ from?: string; to?: string; days?: string }>;
}) {
  const { kind } = await params;
  await requirePermission('reports.view');
  const report = getReportDefinition(kind);
  if (!report) notFound();

  const query = await searchParams;
  const { from, to } = resolveDateRange(query);
  const days = resolveDays(query.days);
  const [rows, settings] = await Promise.all([report.load({ from, to, days }), getShopSettings()]);

  const backQuery = report.usesRange ? `?from=${from}&to=${to}` : report.usesDays ? `?days=${days}` : '';

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/reports/${report.kind}${backQuery}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Report
          </Link>
        </Button>
        <PrintButton logLabel={`Report — ${report.title}`} />
      </div>

      <PrintDocument
        settings={settings}
        title={report.title.toUpperCase()}
        meta={
          <p>
            {report.usesRange
              ? formatDateRange(from, to)
              : report.usesDays
                ? `Not sold in ${days} days`
                : `As of ${formatDateTime(new Date())}`}
          </p>
        }
      >
        <p className="a4-sub" style={{ margin: '12px 0' }}>
          {report.description}
        </p>
        {rows.length === 0 ? (
          <p>{report.emptyMessage}</p>
        ) : (
          <ReportTable columns={report.columns} rows={rows} print />
        )}
      </PrintDocument>
    </div>
  );
}

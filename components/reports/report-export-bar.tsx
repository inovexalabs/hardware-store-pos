import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface Props {
  kind: string;
  /** current query (from/to/days) so exports match the screen */
  query: Record<string, string>;
  canExport: boolean;
}

/** Print and CSV buttons for one report. */
export function ReportExportBar({ kind, query, canExport }: Props) {
  const qs = new URLSearchParams(query).toString();
  const csvQs = new URLSearchParams({ kind, ...query }).toString();

  return (
    <>
      <Button variant="outline" asChild>
        <a href={`/reports/${kind}/print${qs ? `?${qs}` : ''}`} target="_blank" rel="noreferrer">
          <Printer data-icon="inline-start" />
          Print
        </a>
      </Button>
      {canExport && (
        <Button variant="outline" asChild>
          <a href={`/reports/download?${csvQs}`}>
            <Download data-icon="inline-start" />
            Download CSV
          </a>
        </Button>
      )}
    </>
  );
}

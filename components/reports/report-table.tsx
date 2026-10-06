import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  columnTotals,
  displayCell,
  displayTotal,
  type ReportColumn,
  type ReportRow,
} from '@/services/report-registry';

interface Props {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** plain A4 table for printing */
  print?: boolean;
}

const RIGHT: ReportColumn['kind'][] = ['money', 'number', 'qty'];

function negative(column: ReportColumn, row: ReportRow) {
  return column.kind === 'money' && Number(row[column.key]) < 0;
}

/** Renders any report from the registry, with a totals row when it makes sense. */
export function ReportTable({ columns, rows, print = false }: Props) {
  const totals = columnTotals(columns, rows);
  const hasTotals = Object.keys(totals).length > 0 && rows.length > 1;
  const firstTotal = columns.findIndex((c) => c.total);

  if (print) {
    return (
      <table className="a4-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={RIGHT.includes(column.kind) ? 'a4-num' : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key} className={RIGHT.includes(column.kind) ? 'a4-num' : undefined}>
                  {displayCell(column, row)}
                </td>
              ))}
            </tr>
          ))}
          {hasTotals && (
            <tr>
              {columns.map((column, index) => (
                <td key={column.key} className={RIGHT.includes(column.kind) ? 'a4-num' : undefined}>
                  <strong>
                    {column.total
                      ? displayTotal(column, totals[column.key])
                      : index === 0 && firstTotal !== 0
                        ? 'Total'
                        : ''}
                  </strong>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn('whitespace-nowrap', RIGHT.includes(column.kind) && 'text-right')}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column, columnIndex) => {
                const text = displayCell(column, row);
                const href = column.href?.(row);
                return (
                  <TableCell
                    key={column.key}
                    className={cn(
                      RIGHT.includes(column.kind) && 'text-right tabular-nums',
                      columnIndex === 0 && 'font-medium',
                      negative(column, row) && 'text-destructive',
                      column.kind === 'datetime' && 'whitespace-nowrap text-sm text-muted-foreground'
                    )}
                  >
                    {href ? (
                      <Link href={href} className="underline-offset-2 hover:underline">
                        {text}
                      </Link>
                    ) : (
                      text
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {hasTotals && (
            <TableRow className="border-t-2 bg-muted/40 font-semibold">
              {columns.map((column, index) => (
                <TableCell
                  key={column.key}
                  className={cn(RIGHT.includes(column.kind) && 'text-right tabular-nums')}
                >
                  {column.total
                    ? displayTotal(column, totals[column.key])
                    : index === 0 && firstTotal !== 0
                      ? 'Total'
                      : ''}
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

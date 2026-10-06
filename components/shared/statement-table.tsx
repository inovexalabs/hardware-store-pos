import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRs } from '@/utils/format';
import type { StatementRow } from '@/types/database';

interface Props {
  rows: StatementRow[];
  /** "Customer owes" for customers, "We owe" for suppliers */
  balanceLabel: string;
  /** Use plain A4 print styling instead of the app table */
  print?: boolean;
}

function balanceText(value: number) {
  const n = Number(value);
  if (n < 0) return `${formatRs(Math.abs(n))} advance`;
  return formatRs(n);
}

/** Ledger: date · details · debit · credit · running balance. */
export function StatementTable({ rows, balanceLabel, print = false }: Props) {
  const totals = rows.reduce(
    (acc, row) => ({ debit: acc.debit + Number(row.debit), credit: acc.credit + Number(row.credit) }),
    { debit: 0, credit: 0 }
  );
  const closing = rows.length > 0 ? Number(rows[rows.length - 1].balance) : 0;

  if (print) {
    return (
      <table className="a4-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Details</th>
            <th className="a4-num">Debit</th>
            <th className="a4-num">Credit</th>
            <th className="a4-num">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{formatDate(row.entry_date)}</td>
              <td>{row.description}</td>
              <td className="a4-num">{Number(row.debit) > 0 ? formatRs(row.debit) : ''}</td>
              <td className="a4-num">{Number(row.credit) > 0 ? formatRs(row.credit) : ''}</td>
              <td className="a4-num">{balanceText(row.balance)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              <strong>Totals for the period</strong>
            </td>
            <td className="a4-num">
              <strong>{formatRs(totals.debit)}</strong>
            </td>
            <td className="a4-num">
              <strong>{formatRs(totals.credit)}</strong>
            </td>
            <td className="a4-num">
              <strong>{balanceText(closing)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">{balanceLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} className={index === 0 ? 'bg-muted/40' : undefined}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(row.entry_date)}
              </TableCell>
              <TableCell className={index === 0 ? 'font-medium' : undefined}>
                {row.description}
              </TableCell>
              <TableCell className="text-right">
                {Number(row.debit) > 0 ? formatRs(row.debit) : '—'}
              </TableCell>
              <TableCell className="text-right text-success">
                {Number(row.credit) > 0 ? formatRs(row.credit) : '—'}
              </TableCell>
              <TableCell
                className={
                  Number(row.balance) > 0
                    ? 'text-right font-medium text-destructive'
                    : 'text-right font-medium'
                }
              >
                {balanceText(row.balance)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={2}>Totals for the period</TableCell>
            <TableCell className="text-right">{formatRs(totals.debit)}</TableCell>
            <TableCell className="text-right">{formatRs(totals.credit)}</TableCell>
            <TableCell className="text-right">{balanceText(closing)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

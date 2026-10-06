import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDrCr } from '@/lib/accounting';
import { formatDate, formatRs } from '@/utils/format';
import type { LedgerRow } from '@/types/database';

interface Props {
  rows: LedgerRow[];
  /** plain A4 table for printing */
  print?: boolean;
}

function details(row: LedgerRow) {
  return [row.narration, row.party && !row.narration.includes(row.party) ? row.party : null, row.memo]
    .filter(Boolean)
    .join(' — ');
}

/** One account: date · entry · details · debit · credit · running balance (Dr/Cr). */
export function LedgerTable({ rows, print = false }: Props) {
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
            <th>Entry</th>
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
              <td>{row.entry_number ?? ''}</td>
              <td>{details(row)}</td>
              <td className="a4-num">{Number(row.debit) > 0 ? formatRs(row.debit) : ''}</td>
              <td className="a4-num">{Number(row.credit) > 0 ? formatRs(row.credit) : ''}</td>
              <td className="a4-num">{formatDrCr(row.balance)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <strong>Totals for the period</strong>
            </td>
            <td className="a4-num">
              <strong>{formatRs(totals.debit)}</strong>
            </td>
            <td className="a4-num">
              <strong>{formatRs(totals.credit)}</strong>
            </td>
            <td className="a4-num">
              <strong>{formatDrCr(closing)}</strong>
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
            <TableHead>Entry</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} className={row.entry_id ? undefined : 'bg-muted/40'}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(row.entry_date)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.entry_id ? (
                  <Link
                    href={`/accounting/journal/${row.entry_id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {row.entry_number}
                  </Link>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className={row.entry_id ? 'min-w-[16rem] text-sm' : 'font-medium'}>
                {row.entry_id ? (
                  <>
                    <span className="block">{row.narration}</span>
                    {(row.memo || (row.party && !row.narration.includes(row.party))) && (
                      <span className="block text-xs text-muted-foreground">
                        {[row.party && !row.narration.includes(row.party) ? row.party : null, row.memo]
                          .filter(Boolean)
                          .join(' — ')}
                      </span>
                    )}
                  </>
                ) : (
                  row.narration
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Number(row.debit) > 0 ? formatRs(row.debit) : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Number(row.credit) > 0 ? formatRs(row.credit) : '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                {formatDrCr(row.balance)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={3}>Totals for the period</TableCell>
            <TableCell className="text-right tabular-nums">{formatRs(totals.debit)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRs(totals.credit)}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">{formatDrCr(closing)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

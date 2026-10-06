import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ledgerHref } from '@/lib/accounting';
import { formatRs } from '@/utils/format';
import type { JournalLineWithDetails } from '@/types/database';

interface Props {
  lines: JournalLineWithDetails[];
  /** range used for the account links */
  entryDate: string;
  /** plain A4 table for printing */
  print?: boolean;
}

function partyName(line: JournalLineWithDetails) {
  if (line.customer) return line.customer.name;
  if (line.supplier) return line.supplier.company || line.supplier.name;
  return null;
}

/** Account · details · debit · credit, with equal totals underneath. */
export function JournalLinesTable({ lines, entryDate, print = false }: Props) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);

  if (print) {
    return (
      <table className="a4-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Details</th>
            <th className="a4-num">Debit</th>
            <th className="a4-num">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                {line.account.code} · {line.account.name}
              </td>
              <td>{[partyName(line), line.memo].filter(Boolean).join(' — ')}</td>
              <td className="a4-num">{Number(line.debit) > 0 ? formatRs(line.debit) : ''}</td>
              <td className="a4-num">{Number(line.credit) > 0 ? formatRs(line.credit) : ''}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              <strong>Total</strong>
            </td>
            <td className="a4-num">
              <strong>{formatRs(debit)}</strong>
            </td>
            <td className="a4-num">
              <strong>{formatRs(credit)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const party = partyName(line);
            return (
              <TableRow key={line.id}>
                <TableCell>
                  <Link
                    href={ledgerHref(line.account.id, `${entryDate.slice(0, 7)}-01`, entryDate)}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {line.account.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{line.account.code}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {party && <span className="block font-medium">{party}</span>}
                  {line.memo && <span className="text-muted-foreground">{line.memo}</span>}
                  {!party && !line.memo && <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(line.debit) > 0 ? formatRs(line.debit) : ''}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(line.credit) > 0 ? formatRs(line.credit) : ''}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="font-semibold">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right tabular-nums">{formatRs(debit)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRs(credit)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

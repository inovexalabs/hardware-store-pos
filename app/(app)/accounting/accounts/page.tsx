import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getAccountBalances } from '@/services/accounting';
import {
  ACCOUNT_TYPE_HINTS,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  ledgerHref,
} from '@/lib/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { AccountFormDialog } from '@/components/accounting/account-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatRs, startOfMonthInShopTimezone, todayInShopTimezone } from '@/utils/format';
import { ArrowLeft, BookOpenText } from 'lucide-react';
import type { AccountBalanceRow, AccountType } from '@/types/database';

export const metadata = { title: 'Chart of Accounts' };

const CODE_BASE: Record<AccountType, number> = {
  asset: 1000,
  liability: 2000,
  equity: 3000,
  income: 4000,
  expense: 5000,
};

/** Next free number in each type's block (1xxx, 2xxx …) for a new account. */
function nextCodes(rows: AccountBalanceRow[]): Record<AccountType, string> {
  const result = {} as Record<AccountType, string>;
  for (const type of ACCOUNT_TYPES) {
    const base = CODE_BASE[type];
    const used = rows
      .map((row) => Number(row.code))
      .filter((n) => Number.isInteger(n) && n >= base && n < base + 1000);
    result[type] = String(Math.min(base + 999, (used.length ? Math.max(...used) : base) + 1));
  }
  return result;
}

export default async function AccountsPage() {
  const ctx = await requirePermission('accounting.view');
  const canWrite = hasPermission(ctx.profile.role, 'accounting.write');
  const rows = await getAccountBalances();
  const codes = nextCodes(rows);
  const from = startOfMonthInShopTimezone();
  const to = todayInShopTimezone();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Every heading your money is sorted into, with its balance today."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/accounting">
                <ArrowLeft data-icon="inline-start" />
                Accounting
              </Link>
            </Button>
            {canWrite && <AccountFormDialog nextCodes={codes} />}
          </>
        }
      />

      {ACCOUNT_TYPES.map((type) => {
        const accounts = rows.filter((row) => row.type === type);
        if (accounts.length === 0) return null;
        const total = accounts.reduce((sum, row) => sum + Number(row.balance), 0);
        return (
          <section key={type}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{ACCOUNT_TYPE_LABELS[type]}</h2>
                <p className="text-sm text-muted-foreground">{ACCOUNT_TYPE_HINTS[type]}</p>
              </div>
              <p className="text-sm">
                Total <strong className="tabular-nums">{formatRs(total)}</strong>
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.account_id} className={account.is_active ? undefined : 'opacity-60'}>
                      <TableCell className="tabular-nums text-muted-foreground">{account.code}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{account.name}</span>
                          {account.system_key && <Badge variant="outline">Built-in</Badge>}
                          {!account.allow_manual && (
                            <Badge variant="secondary">Automatic only</Badge>
                          )}
                          {!account.is_active && (
                            <Badge className="border-transparent bg-danger-subtle">Switched off</Badge>
                          )}
                        </span>
                        {account.description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {account.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap text-right font-medium tabular-nums',
                          Number(account.balance) < 0 && 'text-destructive'
                        )}
                      >
                        {formatRs(account.balance)}
                      </TableCell>
                      <TableCell>
                        <span className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={ledgerHref(account.account_id, from, to)}>
                              <BookOpenText data-icon="inline-start" />
                              Ledger
                            </Link>
                          </Button>
                          {canWrite && (
                            <AccountFormDialog
                              account={{
                                id: account.account_id,
                                code: account.code,
                                name: account.name,
                                type: account.type,
                                description: account.description,
                                is_active: account.is_active,
                                builtIn: Boolean(account.system_key),
                                hasEntries: Number(account.debit) + Number(account.credit) > 0,
                              }}
                            />
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}

      <p className="text-sm text-muted-foreground">
        “Automatic only” accounts are kept by sales, purchases, payments and stock changes, so they always
        match your customer, supplier and product screens. A negative balance means the account sits on
        its unusual side — for example Sales Returns, or a customer who paid in advance.
      </p>
    </div>
  );
}

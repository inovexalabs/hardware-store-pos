import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getAccountLedger, listAccounts } from '@/services/accounting';
import { ACCOUNT_TYPE_SINGULAR, formatDrCr } from '@/lib/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReportDateRange } from '@/components/reports/report-date-range';
import { LedgerAccountSelect } from '@/components/accounting/ledger-account-select';
import { LedgerTable } from '@/components/accounting/ledger-table';
import { Button } from '@/components/ui/button';
import { formatDateRange, formatRs, isUuid, resolveDateRange } from '@/utils/format';
import { ArrowLeft, BookOpenText, Download, Printer } from 'lucide-react';

export const metadata = { title: 'Ledger' };

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  const ctx = await requirePermission('accounting.view');
  const canExport = hasPermission(ctx.profile.role, 'data.export');
  const params = await searchParams;
  const { from, to } = resolveDateRange(params);

  const accounts = await listAccounts();
  const account = isUuid(params.account) ? accounts.find((a) => a.id === params.account) : undefined;
  const rows = account ? await getAccountLedger(account.id, from, to) : [];

  const opening = rows.length > 0 ? Number(rows[0].balance) : 0;
  const closing = rows.length > 0 ? Number(rows[rows.length - 1].balance) : 0;
  const debits = rows.reduce((sum, row) => sum + Number(row.debit), 0);
  const credits = rows.reduce((sum, row) => sum + Number(row.credit), 0);
  const query = account ? `account=${account.id}&from=${from}&to=${to}` : '';

  return (
    <div>
      <PageHeader
        title={account ? `${account.name} — Ledger` : 'Ledger'}
        description={
          account ? (
            <>
              {account.code} · {ACCOUNT_TYPE_SINGULAR[account.type]} ·{' '}
              <span className="font-medium text-foreground">{formatDateRange(from, to)}</span>
            </>
          ) : (
            'Every line posted to one account, with a running balance.'
          )
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/accounting/accounts">
                <ArrowLeft data-icon="inline-start" />
                Chart of Accounts
              </Link>
            </Button>
            {account && (
              <Button variant="outline" asChild>
                <a href={`/accounting/ledger/print?${query}`} target="_blank" rel="noreferrer">
                  <Printer data-icon="inline-start" />
                  Print
                </a>
              </Button>
            )}
            {account && canExport && (
              <Button variant="outline" asChild>
                <a href={`/accounting/ledger/download?${query}`}>
                  <Download data-icon="inline-start" />
                  Download CSV
                </a>
              </Button>
            )}
          </>
        }
      />

      <LedgerAccountSelect
        accounts={accounts.map(({ id, code, name, type, is_active }) => ({ id, code, name, type, is_active }))}
        value={account?.id ?? ''}
      />
      <ReportDateRange key={`${from}_${to}`} from={from} to={to} />

      {!account ? (
        <EmptyState
          icon={BookOpenText}
          title="Choose an account."
          description="Pick Cash in Hand, Bank Account or any other account above to see every entry posted to it."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Opening balance" value={formatDrCr(opening)} />
            <StatCard label="Debits" value={formatRs(debits)} />
            <StatCard label="Credits" value={formatRs(credits)} />
            <StatCard label="Closing balance" value={formatDrCr(closing)} tone="primary" />
          </div>
          {rows.length <= 1 && (
            <p className="text-sm text-muted-foreground">Nothing was posted to this account in this period.</p>
          )}
          <LedgerTable rows={rows} />
        </div>
      )}
    </div>
  );
}

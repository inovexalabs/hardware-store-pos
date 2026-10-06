import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getAccountingOverview, listAccounts, listJournalEntries } from '@/services/accounting';
import { ledgerHref, SOURCE_LABELS } from '@/lib/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReportDateRange } from '@/components/reports/report-date-range';
import { StockRevaluationButton } from '@/components/accounting/stock-revaluation-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateRange, formatRs, resolveDateRange } from '@/utils/format';
import {
  Banknote,
  BookOpenText,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Landmark,
  ListTree,
  NotebookPen,
  Percent,
  Plus,
  Scale,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react';

export const metadata = { title: 'Accounting' };

const LINKS = [
  { href: '/accounting/journal', label: 'Journal (day book)', hint: 'Every entry, newest first', icon: NotebookPen, range: true },
  { href: '/accounting/ledger', label: 'Ledger', hint: 'One account, line by line, with a running balance', icon: BookOpenText, range: true },
  { href: '/accounting/accounts', label: 'Chart of accounts', hint: 'All accounts and their balances', icon: ListTree, range: false },
  { href: '/reports/trial-balance', label: 'Trial balance', hint: 'Check that debits equal credits', icon: Scale, range: true },
  { href: '/reports/income-statement', label: 'Income statement', hint: 'Profit and loss from the books', icon: TrendingUp, range: true },
  { href: '/reports/balance-sheet', label: 'Balance sheet', hint: 'What the shop owns and owes', icon: Landmark, range: true },
];

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requirePermission('accounting.view');
  const canWrite = hasPermission(ctx.profile.role, 'accounting.write');
  const params = await searchParams;
  const { from, to } = resolveDateRange(params);
  const rangeQuery = `from=${from}&to=${to}`;

  const [overview, accounts, recent] = await Promise.all([
    getAccountingOverview(from, to),
    listAccounts(),
    listJournalEntries({ page: 1, perPage: 8 }),
  ]);

  const idByKey = new Map(accounts.filter((a) => a.system_key).map((a) => [a.system_key!, a.id]));
  const balance = (key: string) => Number(overview.balances[key] ?? 0);
  const ledger = (key: string) => {
    const id = idByKey.get(key);
    return id ? ledgerHref(id, from, to) : undefined;
  };
  const vatToPay = balance('vat_output') - balance('vat_input');
  const profit = Number(overview.profit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Your shop’s books. Every sale, purchase, return, payment and expense is posted here automatically."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/accounting/accounts">
                <ListTree data-icon="inline-start" />
                Chart of Accounts
              </Link>
            </Button>
            {canWrite && (
              <Button asChild>
                <Link href="/accounting/journal/new">
                  <Plus data-icon="inline-start" />
                  New Journal Entry
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cash in hand"
          value={formatRs(balance('cash'))}
          icon={Banknote}
          tone={balance('cash') < 0 ? 'danger' : 'neutral'}
          hint={balance('cash') < 0 ? 'Below zero — enter your opening cash' : 'Today'}
          href={ledger('cash')}
        />
        <StatCard label="Bank" value={formatRs(balance('bank'))} icon={Landmark} hint="Today" href={ledger('bank')} />
        <StatCard
          label="Digital wallet"
          value={formatRs(balance('wallet'))}
          icon={Smartphone}
          hint="Today"
          href={ledger('wallet')}
        />
        <StatCard
          label="Stock value"
          value={formatRs(balance('inventory'))}
          icon={Boxes}
          hint="At cost, in the books"
          href={ledger('inventory')}
        />
        <StatCard
          label="Customers owe you"
          value={formatRs(balance('receivable'))}
          icon={Users}
          tone={balance('receivable') > 0 ? 'warning' : 'neutral'}
          href={ledger('receivable')}
        />
        <StatCard
          label="You owe suppliers"
          value={formatRs(balance('payable'))}
          icon={Building2}
          tone={balance('payable') > 0 ? 'warning' : 'neutral'}
          href={ledger('payable')}
        />
        <StatCard
          label={vatToPay >= 0 ? 'VAT to pay' : 'VAT to claim back'}
          value={formatRs(Math.abs(vatToPay))}
          icon={Percent}
          hint={`Collected ${formatRs(balance('vat_output'))} − paid ${formatRs(balance('vat_input'))}`}
          href={ledger('vat_output')}
        />
        <StatCard
          label={profit >= 0 ? 'Profit for the period' : 'Loss for the period'}
          value={formatRs(Math.abs(profit))}
          icon={TrendingUp}
          tone={profit >= 0 ? 'success' : 'danger'}
          hint={`Income ${formatRs(overview.income)} − expenses ${formatRs(overview.expenses)}`}
          href={`/reports/income-statement?${rangeQuery}`}
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Profit and entries for <span className="font-medium text-foreground">{formatDateRange(from, to)}</span>
        </p>
        <ReportDateRange key={`${from}_${to}`} from={from} to={to} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Books check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The books must agree with your stock, customer and supplier screens.
            </p>
            {overview.unbalanced_entries > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {overview.unbalanced_entries} entr{overview.unbalanced_entries === 1 ? 'y is' : 'ies are'} out of
                balance. Contact Inovexa Labs support.
              </div>
            )}
            {overview.checks.map((check) => {
              const difference = Math.round((Number(check.app) - Number(check.books)) * 100) / 100;
              return (
                <div key={check.key} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{check.label}</span>
                    {difference === 0 ? (
                      <Badge className="border-transparent bg-success-subtle">
                        <CheckCircle2 data-icon="inline-start" />
                        Matches
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-warning-subtle">
                        <CircleAlert data-icon="inline-start" />
                        Differs by {formatRs(Math.abs(difference))}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Screens {formatRs(check.app)} · Books {formatRs(check.books)}
                  </p>
                  {difference !== 0 && check.key === 'stock' && canWrite && (
                    <div className="mt-2">
                      <StockRevaluationButton difference={difference} />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Books & statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.range ? `${link.href}?${rangeQuery}` : link.href}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted"
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{link.label}</span>
                    <span className="block text-xs text-muted-foreground">{link.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Latest entries</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/accounting/journal">See all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been posted yet.</p>
          ) : (
            <ul className="divide-y">
              {recent.rows.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/accounting/journal/${entry.id}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entry.narration}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.entry_number} · {SOURCE_LABELS[entry.source_type]} · {formatDate(entry.entry_date)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatRs(entry.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

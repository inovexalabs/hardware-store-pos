import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getAccount, getAccountLedger } from '@/services/accounting';
import { getShopSettings } from '@/services/settings';
import { ACCOUNT_TYPE_SINGULAR } from '@/lib/accounting';
import { PrintDocument } from '@/components/shared/print-document';
import { PrintButton } from '@/components/shared/print-button';
import { LedgerTable } from '@/components/accounting/ledger-table';
import { Button } from '@/components/ui/button';
import { formatDateRange, isUuid, resolveDateRange } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Ledger' };

export default async function LedgerPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  await requirePermission('accounting.view');
  const params = await searchParams;
  if (!isUuid(params.account)) notFound();
  const { from, to } = resolveDateRange(params);

  const [account, rows, settings] = await Promise.all([
    getAccount(params.account),
    getAccountLedger(params.account, from, to),
    getShopSettings(),
  ]);
  if (!account) notFound();

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/accounting/ledger?account=${account.id}&from=${from}&to=${to}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Ledger
          </Link>
        </Button>
        <PrintButton logLabel={`Ledger — ${account.name}`} />
      </div>

      <PrintDocument
        settings={settings}
        title="LEDGER"
        meta={
          <>
            <p>
              {account.code} · {account.name}
            </p>
            <p>{ACCOUNT_TYPE_SINGULAR[account.type]}</p>
            <p>{formatDateRange(from, to)}</p>
          </>
        }
      >
        <LedgerTable rows={rows} print />
      </PrintDocument>
    </div>
  );
}

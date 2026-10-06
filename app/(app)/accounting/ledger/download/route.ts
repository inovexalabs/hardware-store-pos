import type { NextRequest } from 'next/server';
import { getProfileOrNull } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getAccount, getAccountLedger } from '@/services/accounting';
import { csvResponse, toCsv } from '@/utils/csv';
import { isUuid, resolveDateRange } from '@/utils/format';

/** /accounting/ledger/download?account=…&from=…&to=… → one account's ledger as CSV */
export async function GET(request: NextRequest) {
  const ctx = await getProfileOrNull();
  if (!ctx) return new Response('Please sign in again.', { status: 401 });
  const role = ctx.profile.role;
  if (!hasPermission(role, 'accounting.view') || !hasPermission(role, 'data.export')) {
    return new Response('You do not have permission to download the ledger.', { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const accountId = params.get('account');
  if (!isUuid(accountId)) return new Response('Choose an account first.', { status: 400 });
  const { from, to } = resolveDateRange({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });

  const [account, rows] = await Promise.all([getAccount(accountId), getAccountLedger(accountId, from, to)]);
  if (!account) return new Response('Account not found.', { status: 404 });

  const csv = toCsv(
    [
      { header: 'Date', value: (r) => r.entry_date },
      { header: 'Entry', value: (r) => r.entry_number ?? '' },
      { header: 'Narration', value: (r) => r.narration },
      { header: 'Customer / supplier', value: (r) => r.party ?? '' },
      { header: 'Details', value: (r) => r.memo ?? '' },
      { header: 'Debit (Rs.)', value: (r) => (Number(r.debit) > 0 ? Number(r.debit).toFixed(2) : '') },
      { header: 'Credit (Rs.)', value: (r) => (Number(r.credit) > 0 ? Number(r.credit).toFixed(2) : '') },
      // positive = debit balance, negative = credit balance
      { header: 'Balance Dr(+)/Cr(-) (Rs.)', value: (r) => Number(r.balance).toFixed(2) },
    ],
    rows
  );

  return csvResponse(`ledger_${account.code}_${from}_to_${to}.csv`, csv);
}

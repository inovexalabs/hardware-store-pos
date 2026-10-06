'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from '@/lib/accounting';
import type { Account } from '@/types/database';

interface Props {
  accounts: Pick<Account, 'id' | 'code' | 'name' | 'type' | 'is_active'>[];
  value: string;
}

/** Pick the account to show; keeps the date range in the URL. */
export function LedgerAccountSelect({ accounts, value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function choose(accountId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (accountId) params.set('account', accountId);
    else params.delete('account');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="no-print mb-4 rounded-xl border bg-card p-3">
      <label htmlFor="ledger-account" className="mb-1 block text-xs font-medium text-muted-foreground">
        Account
      </label>
      <select
        id="ledger-account"
        value={value}
        onChange={(e) => choose(e.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-md"
      >
        <option value="">Choose an account…</option>
        {ACCOUNT_TYPES.map((type) => {
          const items = accounts.filter((account) => account.type === type);
          if (items.length === 0) return null;
          return (
            <optgroup key={type} label={ACCOUNT_TYPE_LABELS[type]}>
              {items.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                  {account.is_active ? '' : ' (switched off)'}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveAccount } from '@/actions/accounting.actions';
import { ACCOUNT_TYPE_HINTS, ACCOUNT_TYPE_SINGULAR, ACCOUNT_TYPES } from '@/lib/accounting';
import { Loader2, Pencil, Plus } from 'lucide-react';
import type { AccountType } from '@/types/database';

export interface EditableAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description: string | null;
  is_active: boolean;
  /** built-in accounts keep their type and stay switched on */
  builtIn: boolean;
  /** an account that already has entries keeps its type */
  hasEntries: boolean;
}

interface Props {
  /** Leave empty to add a new account. */
  account?: EditableAccount;
  /** suggested code for a new account of each type */
  nextCodes?: Record<AccountType, string>;
}

const CODE_HINT = 'Assets 1xxx · Liabilities 2xxx · Equity 3xxx · Income 4xxx · Expenses 5xxx';

function initialValues(account?: EditableAccount, nextCodes?: Record<AccountType, string>) {
  return {
    code: account?.code ?? nextCodes?.expense ?? '',
    name: account?.name ?? '',
    type: (account?.type ?? 'expense') as AccountType,
    description: account?.description ?? '',
    is_active: account?.is_active ?? true,
  };
}

export function AccountFormDialog({ account, nextCodes }: Props) {
  const router = useRouter();
  const editing = Boolean(account);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState(() => initialValues(account, nextCodes));
  const typeLocked = Boolean(account && (account.builtIn || account.hasEntries));

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeType(type: AccountType) {
    setValues((current) => ({
      ...current,
      type,
      // a new account follows the numbering of its type unless the code was typed in
      code:
        !editing && nextCodes && Object.values(nextCodes).includes(current.code)
          ? nextCodes[type]
          : current.code,
    }));
  }

  async function handleSave() {
    if (!values.code.trim()) {
      toast.error('Enter the account code.');
      return;
    }
    if (!values.name.trim()) {
      toast.error('Enter the account name.');
      return;
    }
    setBusy(true);
    try {
      const result = await saveAccount(values, account?.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? 'Account saved.' : `Account "${values.name.trim()}" added.`);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {editing ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Edit ${account?.name}`}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Add Account
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setValues(initialValues(account, nextCodes));
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit account' : 'New account'}</DialogTitle>
            <DialogDescription>
              Accounts are the headings your money is sorted into — for example “Shop Rent” or
              “Bank Loan”.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label>Type *</Label>
              <Select
                value={values.type}
                onValueChange={(value) => changeType(value as AccountType)}
                disabled={typeLocked}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ACCOUNT_TYPE_SINGULAR[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {typeLocked
                  ? account?.builtIn
                    ? 'Built-in accounts keep their type.'
                    : 'This account already has entries, so its type stays the same.'
                  : ACCOUNT_TYPE_HINTS[values.type]}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-code">Code *</Label>
              <Input
                id="account-code"
                value={values.code}
                onChange={(e) => set('code', e.target.value)}
                maxLength={12}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="account-name">Name *</Label>
              <Input
                id="account-name"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={80}
                placeholder="e.g. Shop Rent"
                autoFocus={!editing}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground sm:col-span-3">{CODE_HINT}</p>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="account-description">Description</Label>
              <Textarea
                id="account-description"
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="What goes into this account (optional)"
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-3">
                <div>
                  <Label htmlFor="account-active">In use</Label>
                  <p className="text-xs text-muted-foreground">
                    {account?.builtIn
                      ? 'Built-in accounts are always in use.'
                      : 'Switched-off accounts cannot be picked in new entries. The balance must be zero first.'}
                  </p>
                </div>
                <Switch
                  id="account-active"
                  checked={values.is_active}
                  onCheckedChange={(checked) => set('is_active', checked)}
                  disabled={account?.builtIn}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {editing ? 'Save Changes' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

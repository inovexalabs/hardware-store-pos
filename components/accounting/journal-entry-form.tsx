'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createJournalEntry } from '@/actions/accounting.actions';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, ENTRY_TEMPLATES } from '@/lib/accounting';
import { cn } from '@/lib/utils';
import { formatRs, todayInShopTimezone } from '@/utils/format';
import { CheckCircle2, CircleAlert, Info, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { Account } from '@/types/database';

type PostingAccount = Pick<Account, 'id' | 'code' | 'name' | 'type' | 'system_key'>;

interface Props {
  accounts: PostingAccount[];
}

interface Line {
  key: number;
  account_id: string;
  debit: string;
  credit: string;
  memo: string;
}

const emptyLine = (key: number): Line => ({ key, account_id: '', debit: '', credit: '', memo: '' });

const cents = (value: string) => Math.round((Number(value) || 0) * 100);

export function JournalEntryForm({ accounts }: Props) {
  const router = useRouter();
  const nextKey = useRef(3);
  const [entryDate, setEntryDate] = useState(todayInShopTimezone());
  const [narration, setNarration] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(1), emptyLine(2)]);
  const [template, setTemplate] = useState('');
  const [busy, setBusy] = useState(false);

  const byType = useMemo(
    () =>
      ACCOUNT_TYPES.map((type) => ({ type, items: accounts.filter((a) => a.type === type) })).filter(
        (group) => group.items.length > 0
      ),
    [accounts]
  );

  // only offer templates whose accounts can be used
  const templates = useMemo(() => {
    const byKey = new Map(accounts.filter((a) => a.system_key).map((a) => [a.system_key!, a.id]));
    return ENTRY_TEMPLATES.filter((t) => byKey.has(t.debit) && byKey.has(t.credit)).map((t) => ({
      ...t,
      debitId: byKey.get(t.debit)!,
      creditId: byKey.get(t.credit)!,
    }));
  }, [accounts]);

  const used = lines.filter((line) => cents(line.debit) > 0 || cents(line.credit) > 0);
  const debitCents = used.reduce((sum, line) => sum + cents(line.debit), 0);
  const creditCents = used.reduce((sum, line) => sum + cents(line.credit), 0);
  const difference = (debitCents - creditCents) / 100;
  const balanced = debitCents > 0 && debitCents === creditCents;
  const missingAccount = used.some((line) => !line.account_id);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        // a line is either a debit or a credit
        if (patch.debit !== undefined && cents(patch.debit) > 0) next.credit = '';
        if (patch.credit !== undefined && cents(patch.credit) > 0) next.debit = '';
        return next;
      })
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine(nextKey.current++)]);
  }

  function removeLine(key: number) {
    setLines((current) => (current.length <= 2 ? current : current.filter((line) => line.key !== key)));
  }

  function applyTemplate(key: string) {
    setTemplate(key);
    const chosen = templates.find((t) => t.key === key);
    if (!chosen) return;
    const typed = Math.max(debitCents, creditCents);
    const amount = typed > 0 ? String(typed / 100) : '';
    setNarration((current) =>
      !current.trim() || ENTRY_TEMPLATES.some((t) => t.narration === current) ? chosen.narration : current
    );
    setLines([
      { key: nextKey.current++, account_id: chosen.debitId, debit: amount, credit: '', memo: '' },
      { key: nextKey.current++, account_id: chosen.creditId, debit: '', credit: amount, memo: '' },
    ]);
  }

  /** In a two-line entry, typing one amount fills the other side so it stays balanced. */
  function mirrorAmount(key: number, side: 'debit' | 'credit', value: string) {
    const line = lines.find((l) => l.key === key);
    const other = lines.length === 2 ? lines.find((l) => l.key !== key) : undefined;
    const otherSide = side === 'debit' ? 'credit' : 'debit';
    updateLine(key, { [side]: value });
    // only while the other line is empty or was mirroring this one
    if (line && other && other[side] === '' && (other[otherSide] === '' || other[otherSide] === line[side])) {
      updateLine(other.key, { [otherSide]: value });
    }
  }

  async function handleSave() {
    if (!narration.trim()) {
      toast.error('Write what this entry is for (the narration).');
      return;
    }
    if (missingAccount) {
      toast.error('Choose an account for every line that has an amount.');
      return;
    }
    if (!balanced) {
      toast.error('Debits and credits must be equal before you can save.');
      return;
    }
    setBusy(true);
    try {
      const result = await createJournalEntry({
        entry_date: entryDate,
        narration,
        reference,
        lines: used.map((line) => ({
          account_id: line.account_id,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          memo: line.memo,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Entry ${result.data.entry_number} saved.`);
      router.push(`/accounting/journal/${result.data.entry_id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const accountSelect = (line: Line) => (
    <Select value={line.account_id} onValueChange={(value) => updateLine(line.key, { account_id: value })}>
      <SelectTrigger className="w-full" aria-label="Account">
        <SelectValue placeholder="Choose account" />
      </SelectTrigger>
      <SelectContent>
        {byType.map((group) => (
          <SelectGroup key={group.type}>
            <SelectLabel>{ACCOUNT_TYPE_LABELS[group.type]}</SelectLabel>
            {group.items.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.code} · {account.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Quick entry (optional)</Label>
              <Select value={template} onValueChange={applyTemplate}>
                <SelectTrigger className="w-full sm:max-w-md">
                  <SelectValue placeholder="What happened? Pick one to fill the accounts" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Date *</Label>
              <Input
                id="entry-date"
                type="date"
                value={entryDate}
                max={todayInShopTimezone()}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-reference">Reference (optional)</Label>
              <Input
                id="entry-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={60}
                placeholder="Cheque no., bank slip, bill no."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-narration">Narration — what is this entry for? *</Label>
            <Textarea
              id="entry-narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="e.g. Cash deposited in Nabil Bank"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-muted-foreground">
              <strong className="text-foreground">Debit</strong> the account that receives the money or
              value, <strong className="text-foreground">credit</strong> the account it comes from. Example:
              cash put into the bank → debit <em>Bank Account</em>, credit <em>Cash in Hand</em>.
            </p>
          </div>

          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,2fr)_8rem_8rem_2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
            <span>Account</span>
            <span>Details (optional)</span>
            <span className="text-right">Debit (Rs.)</span>
            <span className="text-right">Credit (Rs.)</span>
            <span />
          </div>

          <ul className="space-y-3">
            {lines.map((line, index) => (
              <li
                key={line.key}
                className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_8rem_8rem_2.5rem] md:items-center md:border-0 md:p-0"
              >
                <div className="md:hidden text-xs font-medium text-muted-foreground">Line {index + 1}</div>
                {accountSelect(line)}
                <Input
                  value={line.memo}
                  onChange={(e) => updateLine(line.key, { memo: e.target.value })}
                  maxLength={200}
                  placeholder="Details"
                  aria-label="Details"
                />
                <div className="grid grid-cols-2 gap-2 md:contents">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={line.debit}
                    onChange={(e) => mirrorAmount(line.key, 'debit', e.target.value)}
                    placeholder="Debit"
                    aria-label="Debit"
                    className="text-right tabular-nums"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={line.credit}
                    onChange={(e) => mirrorAmount(line.key, 'credit', e.target.value)}
                    placeholder="Credit"
                    aria-label="Credit"
                    className="text-right tabular-nums"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 2}
                  aria-label={`Remove line ${index + 1}`}
                  className="justify-self-end"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>

          <Button variant="outline" onClick={addLine}>
            <Plus data-icon="inline-start" />
            Add Line
          </Button>

          <div
            className={cn(
              'grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-3',
              balanced ? 'border-success/40' : debitCents + creditCents > 0 ? 'border-warning/50' : undefined
            )}
            aria-live="polite"
          >
            <p>
              <span className="text-muted-foreground">Total debit: </span>
              <strong className="tabular-nums">{formatRs(debitCents / 100)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Total credit: </span>
              <strong className="tabular-nums">{formatRs(creditCents / 100)}</strong>
            </p>
            <p className="flex items-center gap-1.5">
              {balanced ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-medium text-success">Balanced</span>
                </>
              ) : debitCents + creditCents > 0 ? (
                <>
                  <CircleAlert className="h-4 w-4 text-warning" />
                  <span>
                    {difference > 0 ? 'Credits' : 'Debits'} are short by{' '}
                    <strong>{formatRs(Math.abs(difference))}</strong>
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Enter the amounts</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={busy || !balanced || missingAccount || !narration.trim()}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          Save Entry
        </Button>
      </div>
    </div>
  );
}

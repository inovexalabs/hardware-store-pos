'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { recordCustomerPayment, recordSupplierPayment } from '@/actions/payment.actions';
import { formatDate, formatRs } from '@/utils/format';
import { Loader2, HandCoins } from 'lucide-react';

export interface OpenBill {
  id: string;
  number: string;
  due_amount: number;
  created_at: string;
}

interface Props {
  kind: 'customer' | 'supplier';
  partyId: string;
  partyName: string;
  /** Current balance (customer owes / we owe). */
  balance: number;
  openBills: OpenBill[];
  /** Pre-select one bill (e.g. opened from a purchase screen). */
  defaultBillId?: string;
  triggerLabel?: string;
}

const GENERAL = '__general__';
const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / eSewa' },
  { value: 'wallet', label: 'Digital Wallet' },
] as const;

/** Receive money from a customer, or pay a supplier. */
export function PaymentDialog({
  kind,
  partyId,
  partyName,
  balance,
  openBills,
  defaultBillId,
  triggerLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [billId, setBillId] = useState(defaultBillId ?? GENERAL);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const isCustomer = kind === 'customer';
  const bill = openBills.find((b) => b.id === billId);
  const suggested = bill ? Number(bill.due_amount) : Math.max(0, Number(balance));

  function reset() {
    setAmount('');
    setMethod('cash');
    setBillId(defaultBillId ?? GENERAL);
    setReference('');
    setNotes('');
  }

  async function handleSave() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (bill && value > Number(bill.due_amount)) {
      toast.error(`${bill.number} only has ${formatRs(bill.due_amount)} due.`);
      return;
    }
    setBusy(true);
    try {
      const input = {
        party_id: partyId,
        amount: value,
        method,
        invoice_id: bill?.id ?? '',
        reference: reference.trim(),
        notes: notes.trim(),
      };
      const result = isCustomer
        ? await recordCustomerPayment(input)
        : await recordSupplierPayment(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isCustomer ? 'Payment received and saved.' : 'Payment to supplier saved.');
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <HandCoins data-icon="inline-start" />
        {triggerLabel ?? (isCustomer ? 'Receive Payment' : 'Pay Supplier')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isCustomer ? `Receive payment — ${partyName}` : `Pay ${partyName}`}
            </DialogTitle>
            <DialogDescription>
              {Number(balance) > 0
                ? `${isCustomer ? 'Customer owes' : 'You owe'} ${formatRs(balance)} in total.`
                : isCustomer
                  ? 'This customer owes nothing right now. A payment will be kept as advance.'
                  : 'You owe this supplier nothing right now. A payment will be kept as advance.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {openBills.length > 0 && (
              <div className="space-y-2">
                <Label>{isCustomer ? 'For which invoice?' : 'For which purchase bill?'}</Label>
                <Select value={billId} onValueChange={setBillId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GENERAL}>General payment (not for one bill)</SelectItem>
                    {openBills.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.number} · {formatDate(b.created_at)} · {formatRs(b.due_amount)} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (Rs.) *</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={suggested > 0 ? String(suggested) : '0.00'}
                autoFocus
              />
              {suggested > 0 && (
                <Button variant="outline" size="xs" onClick={() => setAmount(String(suggested))}>
                  {bill ? 'Full bill amount' : 'Full balance'} ({formatRs(suggested)})
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Paid by</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Reference (optional)</Label>
                <Input
                  id="payment-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={60}
                  placeholder="Cheque / transaction no."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Note (optional)</Label>
              <Textarea
                id="payment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

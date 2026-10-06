'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Ban, Printer, Receipt } from 'lucide-react';
import { cancelSale } from '@/actions/sale.actions';
import { recordCustomerPayment } from '@/actions/payment.actions';
import { useActionResult } from '@/hooks/use-action-result';
import type { ActionResult } from '@/lib/result';
import type { Sale } from '@/types/database';
import { formatRs } from '@/utils/format';

interface Props {
  sale: Sale;
  canCancel: boolean;
  canTakePayment: boolean;
}

/** Cancel + print + take-payment buttons for the sale detail screen. */
export function SaleActions({ sale, canCancel, canTakePayment }: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  const [cancelState, cancelAction, cancelPending] = useActionState(
    async (
      _prev: ActionResult<{ id: string }> | null
    ): Promise<ActionResult<{ id: string }>> => cancelSale(sale.id, reason),
    null
  );

  useActionResult(cancelState, {
    successMessage: 'Sale cancelled. Stock has been put back.',
    onSuccess: () => {
      setCancelOpen(false);
      setReason('');
    },
  });

  async function handlePayment() {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (amount > Number(sale.due_amount)) {
      toast.error(`This invoice only has ${formatRs(sale.due_amount)} due.`);
      return;
    }
    setPayBusy(true);
    try {
      const result = await recordCustomerPayment({
        party_id: sale.customer_id ?? '',
        amount,
        method: 'cash',
        invoice_id: sale.id,
        reference: null,
        notes: `Payment for ${sale.invoice_number}`,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Payment recorded.');
      setPayOpen(false);
      setPayAmount('');
      router.refresh();
    } finally {
      setPayBusy(false);
    }
  }

  const isCancelled = sale.status === 'cancelled';
  const hasDue = Number(sale.due_amount) > 0;

  return (
    <>
      <Button variant="outline" asChild>
        <a href={`/sales/${sale.id}/print`} target="_blank" rel="noreferrer">
          <Printer data-icon="inline-start" />
          Print Invoice
        </a>
      </Button>

      {canTakePayment && !isCancelled && hasDue && sale.customer_id && (
        <Button onClick={() => setPayOpen(true)}>
          <Receipt data-icon="inline-start" />
          Take Payment
        </Button>
      )}

      {canCancel && !isCancelled && (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Cancel Sale
        </Button>
      )}

      {/* ---- take payment ---- */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take payment — {sale.invoice_number}</DialogTitle>
            <DialogDescription>
              Amount due: {formatRs(sale.due_amount)}. Payment goes to the customer&apos;s
              balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount received (Rs.)</Label>
            <input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={String(sale.due_amount)}
              autoFocus
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="xs" onClick={() => setPayAmount(String(sale.due_amount))}>
                Full amount
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={payBusy}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={payBusy}>
              {payBusy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- cancel sale ---- */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel invoice {sale.invoice_number}?</DialogTitle>
            <DialogDescription>
              The items go back into stock and the invoice is marked cancelled. This is kept in
              history and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Why are you cancelling? *</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer changed their mind"
              maxLength={300}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelPending}>
              Keep Sale
            </Button>
            <form action={cancelAction}>
              <Button
                type="submit"
                variant="destructive"
                disabled={cancelPending || reason.trim().length < 3}
              >
                {cancelPending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Cancel This Sale
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useState } from 'react';
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
import { cancelPurchase } from '@/actions/purchase.actions';
import { Ban, Loader2 } from 'lucide-react';

interface Props {
  purchaseId: string;
  purchaseNumber: string;
}

/** Cancel a purchase: stock comes back out and the supplier balance is reduced. */
export function CancelPurchaseButton({ purchaseId, purchaseNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      const result = await cancelPurchase(purchaseId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Purchase cancelled. Stock and supplier balance have been corrected.');
      setOpen(false);
      setReason('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Ban data-icon="inline-start" />
        Cancel Purchase
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel purchase {purchaseNumber}?</DialogTitle>
            <DialogDescription>
              The items are taken back out of stock and the unpaid amount is removed from what you
              owe the supplier. Money already paid is not refunded automatically. This is kept in
              history and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-purchase-reason">Why are you cancelling? *</Label>
            <Textarea
              id="cancel-purchase-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Entered twice by mistake"
              maxLength={300}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Keep Purchase
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={busy || reason.trim().length < 3}
            >
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Cancel This Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

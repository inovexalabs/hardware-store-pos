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
import { reverseJournalEntry } from '@/actions/accounting.actions';
import { Loader2, Undo2 } from 'lucide-react';

interface Props {
  entryId: string;
  entryNumber: string;
}

/** Undo a manual entry: posts the opposite entry today, keeps both on record. */
export function ReverseEntryButton({ entryId, entryNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleReverse() {
    if (reason.trim().length < 3) {
      toast.error('Please write a short reason (at least 3 characters).');
      return;
    }
    setBusy(true);
    try {
      const result = await reverseJournalEntry(entryId, { reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${entryNumber} reversed by ${result.data.entry_number}.`);
      setOpen(false);
      router.push(`/accounting/journal/${result.data.entry_id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Undo2 data-icon="inline-start" />
        Reverse Entry
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setReason('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse {entryNumber}?</DialogTitle>
            <DialogDescription>
              A new entry with the opposite amounts is saved today, so the two cancel out. Both stay in
              the journal for your records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reverse-reason">Reason *</Label>
            <Textarea
              id="reverse-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="e.g. Wrong amount entered"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReverse} disabled={busy}>
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Reverse Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

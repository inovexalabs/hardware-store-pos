'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { postStockRevaluation } from '@/actions/accounting.actions';
import { formatRs } from '@/utils/format';
import { RefreshCw } from 'lucide-react';

/** Posts the small difference between the products' stock value and the Stock account. */
export function StockRevaluationButton({ difference }: { difference: number }) {
  const router = useRouter();

  async function handleConfirm() {
    const result = await postStockRevaluation();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Stock account updated (${result.data.entry_number}).`);
    router.refresh();
  }

  return (
    <ConfirmDialog
      title="Update the stock value in the books?"
      description={`The products are worth ${formatRs(Math.abs(difference))} ${
        difference > 0 ? 'more' : 'less'
      } than the Stock account shows. This posts one entry against "${
        difference > 0 ? 'Stock Gain' : 'Stock Loss & Damage'
      }" so the two match. Average-cost rounding and cancelled purchases cause small differences like this.`}
      confirmLabel="Post the difference"
      destructive={false}
      onConfirm={handleConfirm}
    >
      <Button size="sm" variant="outline">
        <RefreshCw data-icon="inline-start" />
        Fix the difference
      </Button>
    </ConfirmDialog>
  );
}

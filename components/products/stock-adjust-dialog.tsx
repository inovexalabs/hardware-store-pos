'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ClipboardEdit } from 'lucide-react';
import { adjustStock } from '@/actions/product.actions';
import { useActionResult } from '@/hooks/use-action-result';
import type { ActionResult } from '@/lib/result';
import type { ProductListItem } from '@/types/database';

interface Props {
  product: ProductListItem;
  /** Only users with stock.adjust permission see the button. */
  canAdjust: boolean;
}

const REASONS = [
  { value: 'adjustment', label: 'Stock count correction' },
  { value: 'damage', label: 'Damaged / broken' },
  { value: 'lost', label: 'Lost / missing' },
  { value: 'initial', label: 'Set opening stock (first time only)' },
];

/**
 * Manual stock change. The database does the math and writes a
 * stock_movement, so stock never changes silently.
 */
export function StockAdjustDialog({ product, canAdjust }: Props) {
  const [open, setOpen] = useState(false);
  const [newStock, setNewStock] = useState(String(product.stock));
  const [reasonType, setReasonType] = useState('adjustment');
  const [reason, setReason] = useState('');

  const [state, formAction, pending] = useActionState(
    async (
      _prev: ActionResult<{ previous_stock: number; new_stock: number }> | null
    ): Promise<ActionResult<{ previous_stock: number; new_stock: number }>> => {
      return adjustStock({
        product_id: product.id,
        new_stock: newStock,
        movement_type: reasonType,
        reason: reasonType === 'initial' ? null : reason,
      });
    },
    null
  );

  useActionResult(state, {
    successMessage: 'Stock updated.',
    onSuccess: () => {
      setOpen(false);
      setReason('');
      setReasonType('adjustment');
      setNewStock(String(state && state.ok ? state.data.new_stock : product.stock));
    },
  });

  if (!canAdjust) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setNewStock(String(product.stock));
          setReason('');
          setReasonType('adjustment');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardEdit data-icon="inline-start" />
          Correct Stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct stock — {product.name}</DialogTitle>
          <DialogDescription>
            Current stock is {product.stock} {product.unit.name}. Enter the real quantity you
            counted. A stock entry is saved with your reason.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_stock">Correct quantity *</Label>
            <Input
              id="new_stock"
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Difference:{' '}
              {(() => {
                const diff = (Number(newStock) || 0) - Number(product.stock);
                if (diff === 0) return 'no change';
                return `${diff > 0 ? '+' : ''}${diff} ${product.unit.name}`;
              })()}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Why is the stock changing? *</Label>
            <Select value={reasonType} onValueChange={setReasonType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reasonType !== 'initial' && (
            <div className="space-y-2">
              <Label htmlFor="reason">Details *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Counted again, 2 boxes were on the other rack"
                maxLength={300}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Save Correction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

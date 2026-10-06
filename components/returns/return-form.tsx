'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createPurchaseReturn, createSalesReturn } from '@/actions/return.actions';
import { formatQty, formatRs } from '@/utils/format';
import type { ReturnableLine, ReturnKind } from '@/services/returns';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  kind: ReturnKind;
  /** sale id or purchase id */
  sourceId: string;
  lines: ReturnableLine[];
  /** sales: is there a customer account to credit? */
  hasCustomer?: boolean;
  /** sales: money still due on the invoice */
  invoiceDue?: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ReturnForm({ kind, sourceId, lines, hasCustomer = false, invoiceDue = 0 }: Props) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const isSales = kind === 'sales';

  const chosen = useMemo(
    () =>
      lines
        .map((line) => ({ line, qty: Number(quantities[line.product_id] || 0) }))
        .filter((entry) => entry.qty > 0),
    [lines, quantities]
  );

  // Mirrors the database: goods value + the same share of VAT that was charged.
  const goods = round2(chosen.reduce((sum, { line, qty }) => sum + round2(qty * line.unit_price), 0));
  const tax = isSales
    ? round2(
        chosen.reduce(
          (sum, { line, qty }) => sum + round2(line.line_tax * (qty / (line.quantity || 1))),
          0
        )
      )
    : 0;
  const total = round2(goods + tax);
  const settlesDue = isSales ? Math.min(invoiceDue, total) : 0;

  function setQty(productId: string, value: string) {
    setQuantities((current) => ({ ...current, [productId]: value }));
  }

  function validate(): string | null {
    if (chosen.length === 0) return 'Enter how many of at least one product are coming back.';
    for (const { line, qty } of chosen) {
      if (qty > line.returnable) {
        return `Only ${formatQty(line.returnable, line.unit)} of "${line.name}" can still be returned.`;
      }
      if (!line.allow_decimal && !Number.isInteger(qty)) {
        return `"${line.name}" is counted in whole ${line.unit || 'units'} only.`;
      }
      if (!isSales && qty > line.stock) {
        return `Only ${formatQty(line.stock, line.unit)} of "${line.name}" is in stock, so you cannot send more back.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const items = chosen.map(({ line, qty }) => ({ product_id: line.product_id, quantity: qty }));
      const result = isSales
        ? await createSalesReturn({ sale_id: sourceId, items, reason: reason.trim() })
        : await createPurchaseReturn({ purchase_id: sourceId, items, reason: reason.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        isSales
          ? `Return ${result.data.return_number} saved. Stock has been put back.`
          : `Return ${result.data.return_number} saved. Stock has been reduced.`
      );
      router.push(`/returns/${result.data.return_id}`);
    } finally {
      setBusy(false);
    }
  }

  const nothingLeft = lines.every((line) => line.returnable <= 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isSales ? 'What is the customer bringing back?' : 'What are you sending back?'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {nothingLeft ? (
            <p className="p-6 text-sm text-muted-foreground">
              Everything on this {isSales ? 'invoice' : 'purchase'} has already been returned.
            </p>
          ) : (
            <ul className="divide-y">
              {lines.map((line) => {
                const qty = Number(quantities[line.product_id] || 0);
                const tooMany = qty > line.returnable;
                return (
                  <li key={line.product_id} className="flex flex-wrap items-end justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.sku} · {isSales ? 'sold' : 'bought'}{' '}
                        {formatQty(line.quantity, line.unit)}
                        {line.already_returned > 0 &&
                          ` · already returned ${formatQty(line.already_returned, line.unit)}`}{' '}
                        · {formatRs(line.unit_price)} per {line.unit || 'unit'}
                        {!isSales && ` · in stock ${formatQty(line.stock, line.unit)}`}
                      </p>
                      {tooMany && (
                        <p className="mt-1 text-xs font-medium text-destructive">
                          Only {formatQty(line.returnable, line.unit)} can be returned.
                        </p>
                      )}
                    </div>
                    {line.returnable > 0 ? (
                      <div className="flex items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`ret-${line.product_id}`}>
                            Return qty
                          </Label>
                          <Input
                            id={`ret-${line.product_id}`}
                            type="number"
                            min="0"
                            max={line.returnable}
                            step={line.allow_decimal ? '0.001' : '1'}
                            inputMode="decimal"
                            value={quantities[line.product_id] ?? ''}
                            onChange={(e) => setQty(line.product_id, e.target.value)}
                            placeholder="0"
                            className="w-24"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQty(line.product_id, String(line.returnable))}
                        >
                          All {formatQty(line.returnable)}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Fully returned</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Goods value</span>
                <span>{formatRs(goods)}</span>
              </div>
              {isSales && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT refunded</span>
                  <span>{formatRs(tax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                <span>{isSales ? 'Refund' : 'Return value'}</span>
                <span>{formatRs(total)}</span>
              </div>
            </div>

            {total > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                {isSales ? (
                  <>
                    {settlesDue > 0 && (
                      <p>{formatRs(settlesDue)} clears the money still due on this invoice.</p>
                    )}
                    {total - settlesDue > 0 &&
                      (hasCustomer ? (
                        <p>
                          {formatRs(total - settlesDue)} is credited to the customer&apos;s account
                          (pay it back in cash if they want it now).
                        </p>
                      ) : (
                        <p>Give the customer {formatRs(total - settlesDue)} back in cash.</p>
                      ))}
                  </>
                ) : (
                  <p>{formatRs(total)} is taken off what you owe this supplier.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="return-reason">Reason (optional)</Label>
              <Textarea
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder={isSales ? 'e.g. Wrong size' : 'e.g. Damaged on arrival'}
              />
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSave}
              disabled={busy || chosen.length === 0}
            >
              {busy ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              Save Return
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

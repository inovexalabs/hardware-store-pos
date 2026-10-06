'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { addUnitConversion, removeUnitConversion } from '@/actions/product.actions';
import { formatNumber } from '@/utils/format';
import { ArrowRight, Plus, Trash2, Scale } from 'lucide-react';
import type { Unit, UnitConversion } from '@/types/database';

interface Props {
  productId: string;
  /** The product's own base unit (what stock is counted in). */
  baseUnit: Unit;
  units: Unit[];
  conversions: (UnitConversion & {
    from_unit?: Pick<Unit, 'id' | 'name'> | null;
    to_unit?: Pick<Unit, 'id' | 'name'> | null;
  })[];
  canEdit: boolean;
}

/**
 * "1 Box = 100 Piece" — tells the system how a purchase unit relates to
 * the unit stock is counted in, so buying boxes fills stock correctly.
 */
export function UnitConversions({
  productId,
  baseUnit,
  units,
  conversions,
  canEdit,
}: Props) {
  const [fromUnit, setFromUnit] = useState('');
  const [factor, setFactor] = useState('');
  const [pending, setPending] = useState(false);

  async function handleAdd() {
    if (!fromUnit) {
      toast.error('Choose the unit you buy or sell in.');
      return;
    }
    setPending(true);
    try {
      const result = await addUnitConversion(productId, fromUnit, Number(factor));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Conversion saved.');
      setFromUnit('');
      setFactor('');
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(id: string) {
    const result = await removeUnitConversion(id, productId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Conversion removed.');
  }

  const otherUnits = units.filter((u) => u.id !== baseUnit.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Unit Conversions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Stock is counted in <strong>{baseUnit.name}</strong>. Add a conversion if you buy or
          sell this item in a different unit (for example 1 Box = 100 Piece).
        </p>

        {conversions.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No conversions yet."
            description={`If you always buy this in ${baseUnit.name}, you don't need any.`}
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {conversions.map((conversion) => (
              <li
                key={conversion.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  1 {conversion.from_unit?.name ?? '?'}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {formatNumber(conversion.factor)} {conversion.to_unit?.name ?? '?'}
                </span>
                {canEdit && (
                  <ConfirmDialog
                    title="Remove this conversion?"
                    description="Purchases in that unit will no longer convert automatically. Existing stock is not changed."
                    confirmLabel="Remove"
                    onConfirm={() => handleRemove(conversion.id)}
                  >
                    <Button variant="ghost" size="icon" aria-label="Remove conversion">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </ConfirmDialog>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <div className="space-y-2">
              <Label>Buying / selling unit</Label>
              <Select value={fromUnit} onValueChange={setFromUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
                <SelectContent>
                  {otherUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equals (in {baseUnit.name})</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <Button onClick={handleAdd} disabled={pending || !fromUnit || !factor}>
              <Plus data-icon="inline-start" />
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

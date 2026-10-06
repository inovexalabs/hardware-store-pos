'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { createPurchase, purchaseProductSearch } from '@/actions/purchase.actions';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useDevices } from '@/hooks/use-devices';
import { logDeviceEvent } from '@/lib/devices';
import { beepError, beepOk } from '@/utils/beep';
import { formatNumber, formatQty, formatRs } from '@/utils/format';
import type { PurchaseProduct, PurchaseUnitOption } from '@/services/purchases';
import type { Supplier } from '@/types/database';
import { CheckCircle2, Loader2, PackagePlus, Search, Trash2 } from 'lucide-react';

interface Line {
  key: string;
  product_id: string;
  name: string;
  sku: string;
  base_unit: string;
  units: PurchaseUnitOption[];
  unit_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
  /** purchase price per base unit, used to suggest a price when the unit changes */
  base_price: number;
}

interface Props {
  suppliers: Pick<Supplier, 'id' | 'name' | 'company'>[];
  defaultSupplierId?: string;
  taxEnabled: boolean;
  taxRate: number;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / eSewa' },
  { value: 'wallet', label: 'Digital Wallet' },
] as const;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: string): number {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function lineTotal(line: Line): number {
  return round2(num(line.quantity) * num(line.unit_price) - num(line.discount));
}

/** Purchase entry: supplier, products in any buying unit, bill totals, payment. */
export function PurchaseForm({ suppliers, defaultSupplierId, taxEnabled, taxRate }: Props) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [supplierId, setSupplierId] = useState(
    suppliers.some((s) => s.id === defaultSupplierId) ? (defaultSupplierId as string) : ''
  );
  const [supplierBill, setSupplierBill] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [paid, setPaid] = useState('0');
  const [method, setMethod] = useState<string>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ---------- product search ----------
  const { settings: device } = useDevices();
  const [term, setTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { results, searching } = useDebouncedSearch(term, async (query) => {
    const res = await purchaseProductSearch(query);
    if (!res.ok) {
      toast.error(res.error);
      return [];
    }
    return res.data;
  });


  function addProduct(product: PurchaseProduct) {
    setLines((current) => {
      const existing = current.find(
        (l) => l.product_id === product.id && l.unit_id === product.base_unit.id
      );
      if (existing) {
        return current.map((l) =>
          l.key === existing.key ? { ...l, quantity: String(num(l.quantity) + 1) } : l
        );
      }
      return [
        ...current,
        {
          key: `${product.id}-${Date.now()}`,
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          base_unit: product.base_unit.name,
          units: product.units,
          unit_id: product.base_unit.id,
          quantity: '1',
          unit_price: String(product.purchase_price),
          discount: '0',
          base_price: product.purchase_price,
        },
      ];
    });
    setTerm('');
    setShowResults(false);
    searchRef.current?.focus();
  }

  /** Look a scanned/typed code up immediately and add it to the purchase. */
  async function addByCode(code: string, source: 'scanner' | 'search-box') {
    const clean = code.trim();
    if (!clean) return;
    const res = await purchaseProductSearch(clean);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const lower = clean.toLowerCase();
    const exact = res.data.find((p) => p.barcode === clean || p.sku.toLowerCase() === lower);
    const product = exact ?? (source === 'search-box' ? res.data[0] : undefined);
    if (!product) {
      if (device.beepOnScan) beepError();
      logDeviceEvent('scan-not-found', `Purchase screen: "${clean}"`, false);
      toast.error(`No product found for "${clean}".`, {
        description: 'Add the barcode to the product first, or add it as a new product.',
      });
      return;
    }
    addProduct(product);
    if (device.beepOnScan) beepOk();
    if (exact) logDeviceEvent('scan', `Purchase screen: ${clean} → ${product.name}`);
  }

  useBarcodeScanner((code) => void addByCode(code, 'scanner'));

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function changeUnit(line: Line, unitId: string) {
    const option = line.units.find((u) => u.unit_id === unitId);
    if (!option) return;
    updateLine(line.key, {
      unit_id: unitId,
      unit_price: String(round2(line.base_price * option.factor)),
    });
  }

  // ---------- totals (same rules as create_purchase) ----------
  const subtotal = useMemo(() => round2(lines.reduce((sum, l) => sum + lineTotal(l), 0)), [lines]);
  const discountValue = num(discount);
  const taxValue = num(tax);
  const total = round2(subtotal - discountValue + taxValue);
  const paidValue = num(paid);
  const due = round2(total - paidValue);

  function validate(): string | null {
    if (!supplierId) return 'Choose a supplier for this purchase.';
    if (lines.length === 0) return 'Add at least one product.';
    for (const line of lines) {
      const qty = num(line.quantity);
      const unit = line.units.find((u) => u.unit_id === line.unit_id);
      if (qty <= 0) return `"${line.name}" needs a quantity above zero.`;
      if (unit && !unit.allow_decimal && !Number.isInteger(qty)) {
        return `"${line.name}" is bought in whole ${unit.name} only.`;
      }
      if (num(line.unit_price) < 0) return `Price of "${line.name}" cannot be negative.`;
      if (num(line.discount) < 0) return `Discount on "${line.name}" cannot be negative.`;
      if (lineTotal(line) < 0) return `Discount on "${line.name}" is more than its line total.`;
    }
    if (discountValue < 0 || taxValue < 0) return 'Discount and tax cannot be negative.';
    if (discountValue > subtotal) return 'Discount cannot be more than the purchase total.';
    if (paidValue < 0) return 'Paid amount cannot be negative.';
    if (paidValue > total) return 'Paid amount cannot be more than the total.';
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPurchase({
        supplier_id: supplierId,
        supplier_invoice_no: supplierBill.trim(),
        items: lines.map((line) => {
          const unit = line.units.find((u) => u.unit_id === line.unit_id) ?? line.units[0];
          return {
            product_id: line.product_id,
            name: line.name,
            sku: line.sku,
            unit_id: line.unit_id,
            unit: unit.name,
            quantity: num(line.quantity),
            unit_price: num(line.unit_price),
            discount: num(line.discount),
            base_unit: line.base_unit,
            conversion_factor: unit.factor,
          };
        }),
        discount: discountValue,
        tax: taxValue,
        paid: paidValue,
        // nothing paid now = bought on credit
        payment_method: paidValue > 0 ? method : 'credit',
        notes: notes.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Purchase ${result.data.purchase_number} saved. Stock has been updated.`);
      router.push(`/purchases/${result.data.purchase_id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose the supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                      {supplier.company ? ` · ${supplier.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No suppliers yet.{' '}
                  <Link href="/suppliers" className="underline">
                    Add one first
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-bill">Supplier&apos;s bill number</Label>
              <Input
                id="supplier-bill"
                value={supplierBill}
                onChange={(e) => setSupplierBill(e.target.value)}
                maxLength={60}
                placeholder="As printed on their bill (optional)"
              />
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (results[0]) addProduct(results.find((p) => p.barcode === term.trim()) ?? results[0]);
                // results not loaded yet — typical for a fast scanner
                else void addByCode(term, 'search-box');
              }
            }}
            placeholder="Scan barcode or type product name to add it…"
            className="h-14 pl-12 text-lg"
            aria-label="Search products"
          />
          {showResults && (searching || results.length > 0) && (
            <div className="absolute right-0 left-0 z-20 mt-1 max-h-80 overflow-auto rounded-xl border bg-card p-2 shadow-lg">
              {searching ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : (
                results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {product.sku} · in stock {formatQty(product.stock, product.base_unit.name)}
                        {product.units.length > 1
                          ? ` · buy in ${product.units.map((u) => u.name).join(' / ')}`
                          : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold">
                      {formatRs(product.purchase_price)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        per {product.base_unit.name}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {lines.length === 0 ? (
              <EmptyState
                icon={PackagePlus}
                title="No products added yet."
                description="Search above and add each item on the supplier's bill. Stock goes up when you save."
              />
            ) : (
              <ul className="divide-y">
                {lines.map((line) => {
                  const unit = line.units.find((u) => u.unit_id === line.unit_id) ?? line.units[0];
                  const baseQty = num(line.quantity) * unit.factor;
                  return (
                    <li key={line.key} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.sku}
                            {unit.factor !== 1 &&
                              ` · adds ${formatNumber(baseQty)} ${line.base_unit} to stock`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="min-w-24 text-right font-semibold">
                            {formatRs(lineTotal(line))}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${line.name}`}
                            onClick={() =>
                              setLines((current) => current.filter((l) => l.key !== line.key))
                            }
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step={unit.allow_decimal ? '0.001' : '1'}
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                            aria-label={`Quantity of ${line.name}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          {line.units.length > 1 ? (
                            <Select value={line.unit_id} onValueChange={(v) => changeUnit(line, v)}>
                              <SelectTrigger aria-label={`Unit of ${line.name}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {line.units.map((option) => (
                                  <SelectItem key={option.unit_id} value={option.unit_id}>
                                    {option.name}
                                    {option.factor !== 1
                                      ? ` (= ${formatNumber(option.factor)} ${line.base_unit})`
                                      : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="flex h-11 items-center text-sm text-muted-foreground">
                              {unit.name}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price per {unit.name} (Rs.)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={line.unit_price}
                            onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                            aria-label={`Price of ${line.name}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Discount (Rs.)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={line.discount}
                            onChange={(e) => updateLine(line.key, { discount: e.target.value })}
                            aria-label={`Discount on ${line.name}`}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Subtotal ({lines.length} item{lines.length === 1 ? '' : 's'})
              </span>
              <span>{formatRs(subtotal)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-discount">Bill discount (Rs.)</Label>
              <Input
                id="purchase-discount"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-tax">VAT / tax on the bill (Rs.)</Label>
              <Input
                id="purchase-tax"
                type="number"
                min="0"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
              {taxEnabled && taxRate > 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setTax(String(round2(Math.max(0, subtotal - discountValue) * (taxRate / 100))))
                  }
                >
                  Add {formatNumber(taxRate)}% VAT
                </Button>
              )}
            </div>

            <div className="flex justify-between border-t pt-3 text-lg font-semibold">
              <span>Total</span>
              <span>{formatRs(total)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-paid">Paid now (Rs.)</Label>
              <Input
                id="purchase-paid"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="xs" onClick={() => setPaid(String(total))} disabled={total <= 0}>
                  Paid in full
                </Button>
                <Button variant="outline" size="xs" onClick={() => setPaid('0')}>
                  On credit
                </Button>
              </div>
            </div>

            {paidValue > 0 && (
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
            )}

            {due > 0 && (
              <p className="text-sm font-medium text-warning">
                {formatRs(due)} will be added to what you owe this supplier.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="purchase-notes">Note (optional)</Label>
              <Textarea
                id="purchase-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
              />
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSave}
              disabled={submitting || lines.length === 0}
            >
              {submitting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              Save Purchase
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

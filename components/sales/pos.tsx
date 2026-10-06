'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { posSearch } from '@/actions/pos.actions';
import { createSale } from '@/actions/sale.actions';
import { saveHeldSale, deleteHeldSale } from '@/actions/held.actions';
import { saveCustomer } from '@/actions/party.actions';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useDevices } from '@/hooks/use-devices';
import { logDeviceEvent, openPrintWindow } from '@/lib/devices';
import { printerUnplugged } from '@/lib/device-connection';
import { beepError, beepOk } from '@/utils/beep';
import { formatRs, formatQty } from '@/utils/format';
import type { PosProduct } from '@/services/products';
import type { Customer, HeldSale } from '@/types/database';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  CheckCircle2,
  UserPlus,
  Loader2,
  Receipt,
  FileText,
} from 'lucide-react';

interface CartLine {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  allow_decimal: boolean;
  quantity: number;
  unit_price: number;
  discount: number;
  stock: number;
  tax_rate: number;
}

interface Props {
  customers: Pick<Customer, 'id' | 'name' | 'phone'>[];
  heldSales: HeldSale[];
  taxEnabled: boolean;
}

const NONE = '__none__';
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / eSewa' },
  { value: 'wallet', label: 'Digital Wallet' },
  { value: 'credit', label: 'Credit (pay later)' },
] as const;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function PosTerminal({ customers, heldSales, taxEnabled }: Props) {
  const router = useRouter();

  // ---------- search ----------
  const [term, setTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { results, searching } = useDebouncedSearch(term, async (query) => {
    const res = await posSearch(query);
    if (!res.ok) {
      toast.error(res.error);
      return [];
    }
    return res.data;
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const { settings: device } = useDevices();
  const [lookingUp, setLookingUp] = useState(false);

  // ---------- cart ----------
  const [lines, setLines] = useState<CartLine[]>([]);

  // ---------- customer & payment ----------
  const [customerId, setCustomerId] = useState(NONE);
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [notes, setNotes] = useState('');

  // ---------- dialogs ----------
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSaving, setCustomerSaving] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [holdTitle, setHoldTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneSale, setDoneSale] = useState<{
    sale_id: string;
    invoice_number: string;
    total: number;
    paid: number;
    due: number;
  } | null>(null);

  // ---------- totals (mirrors the database rules exactly) ----------
  const subtotal = useMemo(
    () => round2(lines.reduce((sum, l) => sum + l.quantity * l.unit_price - l.discount, 0)),
    [lines]
  );
  const cartDiscount = Math.min(Number(discount) || 0, subtotal);
  const taxAmount = useMemo(
    () =>
      taxEnabled
        ? round2(
            lines.reduce((sum, l) => {
              const net = l.quantity * l.unit_price - l.discount;
              return sum + (net * l.tax_rate) / 100;
            }, 0)
          )
        : 0,
    [lines, taxEnabled]
  );
  const total = useMemo(
    () => round2(subtotal - cartDiscount + taxAmount),
    [subtotal, cartDiscount, taxAmount]
  );
  const paidValue = Math.min(Number(paid) || 0, total);
  const due = round2(total - paidValue);
  const change = round2((Number(paid) || 0) - total);


  const addProduct = useCallback((product: PosProduct) => {
    setLines((current) => {
      const existing = current.find((l) => l.product_id === product.id);
      if (existing) {
        return current.map((l) =>
          l.product_id === product.id
            ? { ...l, quantity: round2(l.quantity + 1) }
            : l
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit?.name ?? 'pcs',
          allow_decimal: product.unit?.allow_decimal ?? false,
          quantity: 1,
          unit_price: Number(product.selling_price),
          discount: 0,
          stock: Number(product.stock),
          tax_rate: Number(product.tax_rate),
        },
      ];
    });
    setTerm('');
    setShowResults(false);
  }, []);

  /**
   * Look a code up right now (no waiting for search-as-you-type) and add it.
   * Used for scans anywhere on the screen and for Enter in the search box.
   */
  async function addByCode(code: string, source: 'scanner' | 'search-box') {
    const clean = code.trim();
    if (!clean) return;
    setLookingUp(true);
    try {
      const res = await posSearch(clean);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const lower = clean.toLowerCase();
      const exact = res.data.find(
        (p) => p.barcode === clean || p.sku.toLowerCase() === lower
      );
      // a scanner must match exactly; typed text may pick the best match
      const product = exact ?? (source === 'search-box' ? res.data[0] : undefined);
      if (!product) {
        if (device.beepOnScan) beepError();
        logDeviceEvent('scan-not-found', `Sale screen: "${clean}"`, false);
        toast.error(`No product found for "${clean}".`, {
          description: 'Check the barcode is saved on the product. Scanner trouble? Open Devices to test it.',
        });
        return;
      }
      addProduct(product);
      if (device.beepOnScan) beepOk();
      if (exact) logDeviceEvent('scan', `Sale screen: ${clean} → ${product.name}`);
      searchRef.current?.focus();
    } finally {
      setLookingUp(false);
    }
  }

  // Enter on the search box (typed or scanned into it)
  function handleSearchEnter() {
    const first = results[0];
    if (first) {
      const exact = results.find((p) => p.barcode === term.trim());
      addProduct(exact ?? first);
      if (exact && device.beepOnScan) beepOk();
      searchRef.current?.focus();
      return;
    }
    // results not loaded yet — typical for a fast scanner
    void addByCode(term, 'search-box');
  }

  // scans while the cursor is somewhere else on the screen
  useBarcodeScanner((code) => void addByCode(code, 'scanner'), { enabled: !doneSale });

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setLines((current) =>
      current.map((l) => (l.product_id === productId ? { ...l, ...patch } : l))
    );
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((l) => l.product_id !== productId));
  }

  // ---------- actions ----------
  async function handleSaveCustomer() {
    const name = customerName.trim();
    if (!name) {
      toast.error('Enter the customer name.');
      return;
    }
    setCustomerSaving(true);
    try {
      const result = await saveCustomer({
        name,
        phone: customerPhone.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Customer added.');
      setNewCustomerOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerId(result.data.id);
      router.refresh();
    } finally {
      setCustomerSaving(false);
    }
  }

  async function handleHold() {
    if (lines.length === 0) {
      toast.error('The cart is empty. Add products before holding the sale.');
      return;
    }
    const result = await saveHeldSale({
      title: holdTitle.trim() || `Held ${new Date().toLocaleTimeString()}`,
      customer_id: customerId === NONE ? null : customerId,
      items: lines.map((l) => ({
        product_id: l.product_id,
        name: l.name,
        sku: l.sku,
        unit: l.unit,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: l.discount,
        stock: l.stock,
        tax_rate: l.tax_rate,
      })),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Sale held. You can continue it later.');
    setLines([]);
    setDiscount('0');
    setPaid('');
    setNotes('');
    setCustomerId(NONE);
    setHoldTitle('');
    setHeldOpen(false);
    router.refresh();
  }

  function resumeHeld(held: HeldSale) {
    setLines(
      held.items.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        allow_decimal: false,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount: Number(item.discount),
        stock: Number(item.stock),
        tax_rate: Number((item as { tax_rate?: number }).tax_rate ?? 0),
      }))
    );
    if (held.customer_id) setCustomerId(held.customer_id);
    setHeldOpen(false);
    toast.success(`Loaded "${held.title}".`);
  }

  async function handleDeleteHeld(id: string) {
    const result = await deleteHeldSale(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Held sale removed.');
    router.refresh();
  }

  function validateBeforeSubmit(): string | null {
    if (lines.length === 0) return 'The cart is empty. Add at least one product.';
    for (const line of lines) {
      if (line.quantity <= 0) return `"${line.name}" needs a quantity above zero.`;
      if (!line.allow_decimal && !Number.isInteger(line.quantity)) {
        return `"${line.name}" is sold in whole units only.`;
      }
      if (line.discount > line.quantity * line.unit_price) {
        return `Discount on "${line.name}" is more than its line total.`;
      }
    }
    if (cartDiscount > subtotal) return 'Discount cannot be more than the bill total.';
    if (paidValue > total) return 'Paid amount cannot be more than the total.';
    if (due > 0 && customerId === NONE) {
      return 'Please choose a customer for a sale with due amount.';
    }
    if (method === 'credit' && paidValue > 0 && due === 0) {
      return 'Credit sale cannot be fully paid. Check the paid amount.';
    }
    return null;
  }

  async function handleCharge() {
    const problem = validateBeforeSubmit();
    if (problem) {
      toast.error(problem);
      return;
    }
    // open the print window now, inside the click — browsers block it after an await
    const printWindow = device.autoPrint ? openPrintWindow() : null;
    if (device.autoPrint && !printWindow) {
      toast.warning('The receipt could not open for printing: pop-ups are blocked. See Devices for the fix.');
    }
    if (device.autoPrint && printWindow && printerUnplugged()) {
      toast.warning('The receipt printer is not connected — the sale will still be saved.', {
        description: 'Plug the printer in, or reprint the receipt later from the invoice.',
      });
    }
    setSubmitting(true);
    let printed = false;
    try {
      const result = await createSale({
        customer_id: customerId === NONE ? null : customerId,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount: l.discount,
        })),
        discount: cartDiscount,
        paid: paidValue,
        payment_method: method,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (printWindow && !printWindow.closed) {
        printWindow.location.href = `/sales/${result.data.sale_id}/print?auto=1`;
        printed = true;
      }
      setDoneSale(result.data);
      setLines([]);
      setDiscount('0');
      setPaid('');
      setNotes('');
      setCustomerId(NONE);
      setMethod('cash');
      router.refresh();
    } finally {
      if (printWindow && !printed && !printWindow.closed) printWindow.close();
      setSubmitting(false);
    }
  }

  // keep the search box focused for the next scan
  useEffect(() => {
    if (doneSale) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doneSale]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* ================= LEFT: search + cart ================= */}
      <div className="space-y-4">
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
                handleSearchEnter();
              }
            }}
            placeholder="Scan barcode or type product name… (press F2 to focus)"
            className="h-14 pl-12 text-lg"
            autoFocus
            aria-label="Search products"
          />
          {((showResults && (searching || results.length > 0)) || lookingUp) && (
            <div className="absolute right-0 left-0 z-20 mt-1 max-h-80 overflow-auto rounded-xl border bg-card p-2 shadow-lg">
              {lookingUp ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Finding the scanned item…</p>
              ) : searching ? (
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
                        {product.sku}
                        {product.barcode ? ` · ${product.barcode}` : ''} ·{' '}
                        {product.category?.name ?? 'No category'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm">
                      <span className="block font-semibold">
                        {formatRs(product.selling_price)}
                      </span>
                      <span
                        className={
                          Number(product.stock) > 0
                            ? 'block text-xs text-muted-foreground'
                            : 'block text-xs font-medium text-destructive'
                        }
                      >
                        {Number(product.stock) > 0
                          ? `${formatQty(product.stock)} left`
                          : 'Out of stock'}
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
                icon={Search}
                title="Start a sale."
                description="Scan a barcode or search for a product above. It will appear here."
              />
            ) : (
              <ul className="divide-y">
                {lines.map((line) => {
                  const lineTotal = round2(
                    line.quantity * line.unit_price - line.discount
                  );
                  const tooMuch = line.quantity > line.stock;
                  return (
                    <li key={line.product_id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.sku} · {formatRs(line.unit_price)} per {line.unit}
                          </p>
                          {tooMuch && (
                            <p className="mt-1 text-xs font-medium text-destructive">
                              Only {formatQty(line.stock, line.unit)} in stock — the sale may be
                              rejected.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="min-w-24 text-right font-semibold">
                            {formatRs(lineTotal)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${line.name}`}
                            onClick={() => removeLine(line.product_id)}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <div className="mt-1 flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Less"
                              onClick={() =>
                                updateLine(line.product_id, {
                                  quantity: Math.max(
                                    line.allow_decimal ? 0.001 : 1,
                                    round2(line.quantity - 1)
                                  ),
                                })
                              }
                            >
                              <Minus />
                            </Button>
                            <Input
                              type="number"
                              min={line.allow_decimal ? '0.001' : '1'}
                              step={line.allow_decimal ? '0.001' : '1'}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.product_id, {
                                  quantity: Number(e.target.value) || 0,
                                })
                              }
                              className="w-20 text-center"
                              aria-label={`Quantity of ${line.name}`}
                            />
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="More"
                              onClick={() =>
                                updateLine(line.product_id, {
                                  quantity: round2(line.quantity + 1),
                                })
                              }
                            >
                              <Plus />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Price (Rs.)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) =>
                              updateLine(line.product_id, {
                                unit_price: Number(e.target.value) || 0,
                              })
                            }
                            className="mt-1 w-28"
                            aria-label={`Price of ${line.name}`}
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Discount (Rs.)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.discount}
                            onChange={(e) =>
                              updateLine(line.product_id, {
                                discount: Number(e.target.value) || 0,
                              })
                            }
                            className="mt-1 w-28"
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

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setHeldOpen(true)}
            disabled={submitting}
          >
            <PauseCircle data-icon="inline-start" />
            Hold / Resume Sale
          </Button>
          {heldSales.length > 0 && (
            <Badge variant="secondary" className="self-center px-3 py-1.5">
              {heldSales.length} held
            </Badge>
          )}
        </div>
      </div>

      {/* ================= RIGHT: totals + payment ================= */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setNewCustomerOpen(true)}
                >
                  <UserPlus data-icon="inline-start" />
                  New
                </Button>
              </div>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Walk-in customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.phone ? ` · ${customer.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-discount">Discount (Rs.)</Label>
              <Input
                id="pos-discount"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRs(subtotal)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">− {formatRs(cartDiscount)}</span>
                </div>
              )}
              {taxEnabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span>{formatRs(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                <span>Total</span>
                <span>{formatRs(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Paid by</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-paid">Amount received (Rs.)</Label>
              <Input
                id="pos-paid"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                placeholder={String(total)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setPaid(String(total))}
                  disabled={total <= 0}
                >
                  Exact
                </Button>
                {[100, 500, 1000, 5000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="xs"
                    onClick={() => setPaid(String((Number(paid) || 0) + amount))}
                  >
                    +{amount}
                  </Button>
                ))}
              </div>
              {due > 0 && (
                <p className="text-sm font-medium text-warning">Due: {formatRs(due)}</p>
              )}
              {change > 0 && (
                <p className="text-sm font-medium text-success">
                  Return change: {formatRs(change)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-notes">Note (optional)</Label>
              <Textarea
                id="pos-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="e.g. Delivery to Boudha on Friday"
              />
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleCharge}
              disabled={submitting || lines.length === 0}
            >
              {submitting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              Charge {formatRs(total)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Press Enter in the search box to add a scanned item.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================= new customer ================= */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>
              Only a name is needed. You can fill in the rest later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pos-cust-name">Name *</Label>
              <Input
                id="pos-cust-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-cust-phone">Phone</Label>
              <Input
                id="pos-cust-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="98XXXXXXXX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewCustomerOpen(false)}
              disabled={customerSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer} disabled={customerSaving}>
              {customerSaving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= hold / resume ================= */}
      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold this sale</DialogTitle>
            <DialogDescription>
              Save the cart to serve the next customer, then come back to it later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="hold-title">Name this sale (optional)</Label>
            <Input
              id="hold-title"
              value={holdTitle}
              onChange={(e) => setHoldTitle(e.target.value)}
              placeholder="e.g. Ramesh ji — pipes"
            />
            <Button
              className="w-full"
              onClick={handleHold}
              disabled={lines.length === 0}
            >
              <PauseCircle data-icon="inline-start" />
              Hold current cart
            </Button>
          </div>

          {heldSales.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Continue a held sale</p>
              <ul className="max-h-64 space-y-2 overflow-auto">
                {heldSales.map((held) => (
                  <li
                    key={held.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{held.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {held.items.length} item{held.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => resumeHeld(held)}>
                        Continue
                      </Button>
                      <ConfirmDialog
                        title="Delete this held sale?"
                        description="The saved cart will be removed. No stock or money is affected."
                        confirmLabel="Delete"
                        onConfirm={() => handleDeleteHeld(held.id)}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label="Delete held sale">
                          <Trash2 className="text-destructive" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= success ================= */}
      <Dialog
        open={Boolean(doneSale)}
        onOpenChange={(open) => {
          if (!open) setDoneSale(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-success" />
              Sale saved
            </DialogTitle>
            <DialogDescription>
              {doneSale && (
                <>
                  Invoice {doneSale.invoice_number} — {formatRs(doneSale.total)}
                  {Number(doneSale.due) > 0 ? ` · Due: ${formatRs(doneSale.due)}` : ' · Fully paid'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setDoneSale(null);
                searchRef.current?.focus();
              }}
            >
              <Plus data-icon="inline-start" />
              New Sale
            </Button>
            {doneSale && (
              <Button asChild>
                <Link href={`/sales/${doneSale.sale_id}/print`} target="_blank">
                  <Receipt data-icon="inline-start" />
                  Print Receipt
                </Link>
              </Button>
            )}
            {doneSale && (
              <Button variant="secondary" asChild>
                <Link href={`/sales/${doneSale.sale_id}`}>
                  <FileText data-icon="inline-start" />
                  View Invoice
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

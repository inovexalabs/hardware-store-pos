'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateInvoiceSettings,
  updateShopSettings,
  updateTaxSettings,
} from '@/actions/settings.actions';
import type { ActionResult } from '@/lib/result';
import type { ShopSettings } from '@/types/database';
import { Loader2, Save } from 'lucide-react';

function useSave(successMessage: string, onSaved?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function save(run: () => Promise<ActionResult>) {
    setBusy(true);
    try {
      const result = await run();
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      toast.success(successMessage);
      onSaved?.();
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }
  return { busy, save };
}

function SaveButton({ busy, children = 'Save' }: { busy: boolean; children?: ReactNode }) {
  return (
    <Button type="submit" disabled={busy}>
      {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
      {children}
    </Button>
  );
}

// -------------------------------------------------------------
//  Shop details (letterhead on every printout)
// -------------------------------------------------------------
export function ShopCard({
  settings,
  onSaved,
  submitLabel,
}: {
  settings: ShopSettings;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState({
    shop_name: settings.shop_name ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    pan_vat: settings.pan_vat ?? '',
    invoice_footer: settings.invoice_footer ?? '',
  });
  const { busy, save } = useSave('Shop details saved.', onSaved);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shop details</CardTitle>
        <CardDescription>Printed at the top of every invoice, bill and report.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!values.shop_name.trim()) {
              toast.error('Enter the shop name.');
              return;
            }
            void save(() => updateShopSettings(values));
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shop-name">Shop name *</Label>
            <Input id="shop-name" value={values.shop_name} onChange={set('shop_name')} maxLength={120} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shop-address">Address</Label>
            <Input id="shop-address" value={values.address} onChange={set('address')} maxLength={250} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-phone">Phone</Label>
            <Input id="shop-phone" value={values.phone} onChange={set('phone')} maxLength={25} inputMode="tel" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-email">Email</Label>
            <Input id="shop-email" type="email" value={values.email} onChange={set('email')} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-pan">PAN / VAT number</Label>
            <Input id="shop-pan" value={values.pan_vat} onChange={set('pan_vat')} maxLength={30} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shop-footer">Message at the bottom of receipts</Label>
            <Textarea
              id="shop-footer"
              value={values.invoice_footer}
              onChange={set('invoice_footer')}
              maxLength={300}
              rows={2}
              placeholder="e.g. Thank you for shopping with us! Goods once sold are returnable within 7 days with the bill."
            />
          </div>
          <div className="sm:col-span-2">
            <SaveButton busy={busy}>{submitLabel ?? 'Save Shop Details'}</SaveButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
//  Invoice numbering + receipt paper
// -------------------------------------------------------------
export function InvoiceCard({ settings }: { settings: ShopSettings }) {
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoice_prefix ?? 'INV-');
  const [purchasePrefix, setPurchasePrefix] = useState(settings.purchase_prefix ?? 'PUR-');
  const [receiptSize, setReceiptSize] = useState<string>(settings.receipt_size ?? '80mm');
  const { busy, save } = useSave('Invoice settings saved.');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invoices &amp; receipts</CardTitle>
        <CardDescription>
          New numbers continue from the last one, e.g. {invoicePrefix || 'INV-'}00042.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(() =>
              updateInvoiceSettings({
                invoice_prefix: invoicePrefix,
                purchase_prefix: purchasePrefix,
                receipt_size: receiptSize,
              })
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invoice-prefix">Sale invoice prefix</Label>
            <Input
              id="invoice-prefix"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-prefix">Purchase prefix</Label>
            <Input
              id="purchase-prefix"
              value={purchasePrefix}
              onChange={(e) => setPurchasePrefix(e.target.value.toUpperCase())}
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label>Default receipt paper</Label>
            <Select value={receiptSize} onValueChange={setReceiptSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58 mm thermal (small)</SelectItem>
                <SelectItem value="80mm">80 mm thermal (standard)</SelectItem>
                <SelectItem value="a4">A4 page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <SaveButton busy={busy}>Save Invoice Settings</SaveButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
//  VAT + stock rules
// -------------------------------------------------------------
export function TaxCard({ settings }: { settings: ShopSettings }) {
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled);
  const [taxRate, setTaxRate] = useState(String(settings.tax_rate ?? 13));
  const [allowNegative, setAllowNegative] = useState(settings.allow_negative_stock);
  const { busy, save } = useSave('Tax and stock settings saved.');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">VAT &amp; stock rules</CardTitle>
        <CardDescription>Changes apply to new sales only. Old invoices are never changed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(() =>
              updateTaxSettings({
                tax_enabled: taxEnabled,
                tax_rate: taxRate,
                allow_negative_stock: allowNegative,
              })
            );
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="tax-enabled">Charge VAT on sales</Label>
              <p className="text-sm text-muted-foreground">
                Each product has its own VAT rate. Turn this off if the shop is not VAT registered.
              </p>
            </div>
            <Switch id="tax-enabled" checked={taxEnabled} onCheckedChange={setTaxEnabled} />
          </div>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="tax-rate">Default VAT rate for new products (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              disabled={!taxEnabled}
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t pt-5">
            <div>
              <Label htmlFor="allow-negative">Allow selling more than the stock shows</Label>
              <p className="text-sm text-muted-foreground">
                Keep this off so stock numbers stay honest. Turn it on only if goods often arrive
                before the purchase is entered.
              </p>
            </div>
            <Switch id="allow-negative" checked={allowNegative} onCheckedChange={setAllowNegative} />
          </div>

          <SaveButton busy={busy}>Save VAT &amp; Stock Rules</SaveButton>
        </form>
      </CardContent>
    </Card>
  );
}

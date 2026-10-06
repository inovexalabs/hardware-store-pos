'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart,
  PackagePlus,
  Truck,
  UserPlus,
  Building2,
  HandCoins,
  Loader2,
} from 'lucide-react';
import { recordCustomerPayment, recordSupplierPayment } from '@/actions/payment.actions';

interface PartyOption {
  id: string;
  name: string;
}

interface Props {
  customers: PartyOption[];
  suppliers: PartyOption[];
  can: {
    sale: boolean;
    product: boolean;
    purchase: boolean;
    customer: boolean;
    supplier: boolean;
    payment: boolean;
  };
}

function PaymentDialog({
  kind,
  parties,
  disabled,
}: {
  kind: 'customer' | 'supplier';
  parties: PartyOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);

  const title = kind === 'customer' ? 'Customer Payment' : 'Supplier Payment';
  const partyLabel = kind === 'customer' ? 'Who paid you?' : 'Who did you pay?';

  async function handleSubmit() {
    const value = Number(amount);
    if (!partyId) {
      toast.error(kind === 'customer' ? 'Choose the customer.' : 'Choose the supplier.');
      return;
    }
    if (!value || value <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }

    setBusy(true);
    try {
      const input = {
        party_id: partyId,
        amount: value,
        method,
        notes: null,
        reference: null,
        invoice_id: null,
      };
      const result =
        kind === 'customer'
          ? await recordCustomerPayment(input)
          : await recordSupplierPayment(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Payment recorded successfully.');
      setOpen(false);
      setAmount('');
      setPartyId('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (parties.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="justify-start" disabled={disabled}>
          <HandCoins data-icon="inline-start" />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Record money {kind === 'customer' ? 'received from a customer' : 'paid to a supplier'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{partyLabel}</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {parties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${kind}-amount`}>Amount (Rs.)</Label>
              <Input
                id={`${kind}-amount`}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Paid by</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="wallet">Digital wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Save Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuickActions({ customers, suppliers, can }: Props) {
  const items = [
    {
      label: 'New Sale',
      href: '/sales/new',
      show: can.sale,
      primary: true,
      icon: ShoppingCart,
    },
    { label: 'Add Product', href: '/products/new', show: can.product, primary: false, icon: PackagePlus },
    { label: 'New Purchase', href: '/purchases/new', show: can.purchase, primary: false, icon: Truck },
    { label: 'Add Customer', href: '/customers/new', show: can.customer, primary: false, icon: UserPlus },
    { label: 'Add Supplier', href: '/suppliers/new', show: can.supplier, primary: false, icon: Building2 },
  ].filter((item) => item.show);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.href}
            asChild
            variant={item.primary ? 'default' : 'outline'}
            size="lg"
            className="h-auto flex-col gap-2 py-5 text-center"
          >
            <Link href={item.href}>
              <Icon className="h-6 w-6" />
              {item.label}
            </Link>
          </Button>
        );
      })}

      <PaymentDialog kind="customer" parties={customers} disabled={!can.payment} />
      <PaymentDialog kind="supplier" parties={suppliers} disabled={!can.payment} />
    </div>
  );
}

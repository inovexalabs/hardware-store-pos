'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
} from '@/components/ui/dialog';
import { saveCustomer } from '@/actions/party.actions';
import { Loader2, Pencil, UserPlus } from 'lucide-react';
import type { Customer } from '@/types/database';

interface Props {
  /** Leave empty to add a new customer. */
  customer?: Customer;
}

export function CustomerFormDialog({ customer }: Props) {
  const router = useRouter();
  const editing = Boolean(customer);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState(() => initialValues(customer));

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!values.name.trim()) {
      toast.error('Enter the customer name.');
      return;
    }
    setBusy(true);
    try {
      const result = await saveCustomer(
        { ...values, credit_limit: values.credit_limit || 0, is_active: customer?.is_active ?? true },
        customer?.id
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? 'Customer details saved.' : 'Customer added.');
      setOpen(false);
      if (editing) {
        router.refresh();
      } else {
        setValues(initialValues());
        router.push(`/customers/${result.data.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {editing ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus data-icon="inline-start" />
          Add Customer
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setValues(initialValues(customer));
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit customer' : 'New customer'}</DialogTitle>
            <DialogDescription>
              Only the name is required. A phone number helps you find them quickly.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-name">Name *</Label>
              <Input
                id="customer-name"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                maxLength={25}
                inputMode="tel"
                placeholder="98XXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-address">Address</Label>
              <Input
                id="customer-address"
                value={values.address}
                onChange={(e) => set('address', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-credit">Credit limit (Rs.)</Label>
              <Input
                id="customer-credit"
                type="number"
                min="0"
                step="0.01"
                value={values.credit_limit}
                onChange={(e) => set('credit_limit', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">0 means no limit is shown.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-notes">Notes</Label>
              <Textarea
                id="customer-notes"
                value={values.notes}
                onChange={(e) => set('notes', e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {editing ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function initialValues(customer?: Customer) {
  return {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    credit_limit: customer ? String(customer.credit_limit ?? 0) : '0',
    notes: customer?.notes ?? '',
  };
}

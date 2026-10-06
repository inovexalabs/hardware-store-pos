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
import { saveSupplier } from '@/actions/party.actions';
import { Loader2, Pencil, Plus } from 'lucide-react';
import type { Supplier } from '@/types/database';

interface Props {
  /** Leave empty to add a new supplier. */
  supplier?: Supplier;
}

export function SupplierFormDialog({ supplier }: Props) {
  const router = useRouter();
  const editing = Boolean(supplier);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState(() => initialValues(supplier));

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!values.name.trim()) {
      toast.error('Enter the contact person name.');
      return;
    }
    setBusy(true);
    try {
      const result = await saveSupplier(
        { ...values, is_active: supplier?.is_active ?? true },
        supplier?.id
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? 'Supplier details saved.' : 'Supplier added.');
      setOpen(false);
      if (editing) {
        router.refresh();
      } else {
        setValues(initialValues());
        router.push(`/suppliers/${result.data.id}`);
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
          <Plus data-icon="inline-start" />
          Add Supplier
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setValues(initialValues(supplier));
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit supplier' : 'New supplier'}</DialogTitle>
            <DialogDescription>
              Who you buy from. Only the contact person&apos;s name is required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Contact person *</Label>
              <Input
                id="supplier-name"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-company">Company</Label>
              <Input
                id="supplier-company"
                value={values.company}
                onChange={(e) => set('company', e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                maxLength={25}
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-pan">PAN / VAT number</Label>
              <Input
                id="supplier-pan"
                value={values.pan_vat}
                onChange={(e) => set('pan_vat', e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={values.address}
                onChange={(e) => set('address', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-notes">Notes</Label>
              <Textarea
                id="supplier-notes"
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
              {editing ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function initialValues(supplier?: Supplier) {
  return {
    name: supplier?.name ?? '',
    company: supplier?.company ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    pan_vat: supplier?.pan_vat ?? '',
    notes: supplier?.notes ?? '',
  };
}

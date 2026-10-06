'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { setCustomerActive, setSupplierActive } from '@/actions/party.actions';
import { Power, PowerOff } from 'lucide-react';

interface Props {
  kind: 'customer' | 'supplier';
  id: string;
  name: string;
  active: boolean;
}

/** Customers and suppliers are never deleted — only deactivated. */
export function PartyActiveButton({ kind, id, name, active }: Props) {
  const router = useRouter();

  async function handleConfirm() {
    const action = kind === 'customer' ? setCustomerActive : setSupplierActive;
    const result = await action(id, !active);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(active ? `${name} deactivated.` : `${name} is active again.`);
    router.refresh();
  }

  const noun = kind === 'customer' ? 'customer' : 'supplier';

  return (
    <ConfirmDialog
      title={active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
      description={
        active
          ? `The ${noun} will be hidden from new ${kind === 'customer' ? 'sales' : 'purchases'}. Their history and balance stay as they are. You can reactivate them any time.`
          : `The ${noun} can be chosen again on new ${kind === 'customer' ? 'sales' : 'purchases'}.`
      }
      confirmLabel={active ? 'Deactivate' : 'Reactivate'}
      destructive={active}
      onConfirm={handleConfirm}
    >
      <Button variant={active ? 'destructive' : 'outline'}>
        {active ? <PowerOff data-icon="inline-start" /> : <Power data-icon="inline-start" />}
        {active ? 'Deactivate' : 'Reactivate'}
      </Button>
    </ConfirmDialog>
  );
}

import { requirePermission } from '@/lib/auth/guards';
import { listCustomers } from '@/services/parties';
import { listHeldSales } from '@/services/held';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { PosTerminal } from '@/components/sales/pos';
import { DeviceStatusChip } from '@/components/devices/device-status';

export const metadata = { title: 'New Sale' };

export default async function NewSalePage() {
  await requirePermission('sales.create');

  const [customers, heldSales, settings] = await Promise.all([
    listCustomers({ perPage: 100, activeOnly: true }),
    listHeldSales(),
    getShopSettings(),
  ]);

  return (
    <div>
      <PageHeader
        title="New Sale"
        description="Scan or search items, take payment, print the receipt."
        actions={<DeviceStatusChip shopDefault={settings.receipt_size} />}
      />
      <PosTerminal
        customers={customers.rows.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        }))}
        heldSales={heldSales}
        taxEnabled={settings.tax_enabled}
      />
    </div>
  );
}

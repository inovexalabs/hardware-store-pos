import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { listSuppliers } from '@/services/parties';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { PurchaseForm } from '@/components/purchases/purchase-form';
import { DeviceStatusChip } from '@/components/devices/device-status';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'New Purchase' };

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  await requirePermission('purchases.write');
  const { supplier } = await searchParams;

  const [suppliers, settings] = await Promise.all([
    listSuppliers({ perPage: 100, activeOnly: true }),
    getShopSettings(),
  ]);

  return (
    <div>
      <PageHeader
        title="New Purchase"
        description="Enter the supplier's bill. Stock increases as soon as you save."
        actions={
          <>
            <DeviceStatusChip shopDefault={settings.receipt_size} />
            <Button variant="outline" asChild>
              <Link href="/purchases">
                <ArrowLeft data-icon="inline-start" />
                All Purchases
              </Link>
            </Button>
          </>
        }
      />
      <PurchaseForm
        suppliers={suppliers.rows.map((s) => ({ id: s.id, name: s.name, company: s.company }))}
        defaultSupplierId={supplier}
        taxEnabled={settings.tax_enabled}
        taxRate={Number(settings.tax_rate)}
      />
    </div>
  );
}

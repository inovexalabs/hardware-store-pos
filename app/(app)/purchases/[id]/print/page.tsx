import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getPurchase } from '@/services/purchases';
import { getShopSettings } from '@/services/settings';
import { PurchasePrint } from '@/components/purchases/purchase-print';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { isUuid } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Purchase' };

export default async function PurchasePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requirePermission('purchases.view');

  const [detail, settings] = await Promise.all([getPurchase(id), getShopSettings()]);
  if (!detail) notFound();

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/purchases/${id}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Purchase
          </Link>
        </Button>
        <PrintButton logLabel={`Purchase ${detail.purchase.purchase_number}`} />
      </div>
      <PurchasePrint detail={detail} settings={settings} />
    </div>
  );
}

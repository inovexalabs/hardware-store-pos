import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getReturn } from '@/services/returns';
import { getShopSettings } from '@/services/settings';
import { ReturnPrint } from '@/components/returns/return-print';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { isUuid } from '@/utils/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Return' };

export default async function ReturnPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requirePermission('returns.process');

  const [detail, settings] = await Promise.all([getReturn(id), getShopSettings()]);
  if (!detail) notFound();

  return (
    <div className="print-host">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/returns/${id}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Return
          </Link>
        </Button>
        <PrintButton logLabel={`Return ${detail.return_number}`} />
      </div>
      <ReturnPrint detail={detail} settings={settings} />
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid } from '@/utils/format';
import { requirePermission } from '@/lib/auth/guards';
import { getSale } from '@/services/sales';
import { getShopSettings } from '@/services/settings';
import { InvoicePrint, type PrintSize } from '@/components/sales/invoice-print';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/shared/print-button';
import { PrintController } from '@/components/devices/print-controller';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Print Invoice' };

export default async function SalePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requirePermission('sales.view');
  const { size } = await searchParams;

  const detail = await getSale(id);
  if (!detail) notFound();

  const settings = await getShopSettings();
  const chosen = (['58mm', '80mm', 'a4'] as const).includes(size as PrintSize)
    ? (size as PrintSize)
    : settings.receipt_size;

  return (
    <div className="print-host">
      <PrintController
        size={chosen}
        shopDefault={settings.receipt_size}
        label={`Invoice ${detail.sale.invoice_number}`}
      />
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/sales/${id}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to Invoice
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Paper size:</span>
          {(['58mm', '80mm', 'a4'] as const).map((option) => (
            <Button
              key={option}
              variant={option === chosen ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href={`/sales/${id}/print?size=${option}`}>
                {option === 'a4' ? 'A4 page' : option}
              </Link>
            </Button>
          ))}
          <PrintButton logLabel={`Invoice ${detail.sale.invoice_number} · ${chosen}`} />
        </div>
      </div>

      <InvoicePrint detail={detail} settings={settings} size={chosen} />
    </div>
  );
}

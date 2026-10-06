import Link from 'next/link';
import { requireProfile } from '@/lib/auth/guards';
import { getShopSettings } from '@/services/settings';
import { TestReceipt } from '@/components/devices/test-receipt';
import { PrintController } from '@/components/devices/print-controller';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Printer Test' };

const SIZES = ['58mm', '80mm', 'a4'] as const;
type Size = (typeof SIZES)[number];

export default async function TestPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string }>;
}) {
  await requireProfile();
  const { size } = await searchParams;
  const settings = await getShopSettings();
  const chosen: Size = SIZES.includes(size as Size) ? (size as Size) : settings.receipt_size;

  return (
    <div className="print-host">
      <PrintController size={chosen} shopDefault={settings.receipt_size} label="Printer test page" kind="print-test" />
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href="/devices">
            <ArrowLeft data-icon="inline-start" />
            Back to Devices
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Paper size:</span>
          {SIZES.map((option) => (
            <Button key={option} variant={option === chosen ? 'default' : 'outline'} size="sm" asChild>
              <Link href={`/devices/test-print?size=${option}`}>{option === 'a4' ? 'A4 page' : option}</Link>
            </Button>
          ))}
          <PrintButton label="Print Test Page" logLabel={`Printer test page · ${chosen}`} />
        </div>
      </div>
      <TestReceipt settings={settings} size={chosen} />
    </div>
  );
}

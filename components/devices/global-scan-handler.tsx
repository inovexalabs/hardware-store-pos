'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useDevices } from '@/hooks/use-devices';
import { lookupBarcode } from '@/actions/product.actions';
import { logDeviceEvent } from '@/lib/devices';
import { beepError, beepOk } from '@/utils/beep';
import { formatQty, formatRs } from '@/utils/format';

/** Screens that handle scans themselves (adding to a bill, filling a form, testing). */
function hasOwnScanHandling(pathname: string): boolean {
  return (
    pathname === '/sales/new' ||
    pathname === '/purchases/new' ||
    pathname === '/products/new' ||
    /^\/products\/[^/]+\/edit$/.test(pathname) ||
    pathname.startsWith('/devices') ||
    pathname.endsWith('/print')
  );
}

/**
 * Scan a product label on any other screen → open that product.
 * Unknown barcode → offer to add it as a new product.
 */
export function GlobalScanHandler({ canCreateProduct }: { canCreateProduct: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useDevices();

  useBarcodeScanner(
    async (code) => {
      const res = await lookupBarcode(code);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const product = res.data;
      if (!product) {
        if (settings.beepOnScan) beepError();
        logDeviceEvent('scan-not-found', `${pathname}: "${code}"`, false);
        toast.error(`No product has the barcode ${code}.`, {
          action: canCreateProduct
            ? {
                label: 'Add product',
                onClick: () => router.push(`/products/new?barcode=${encodeURIComponent(code)}`),
              }
            : undefined,
        });
        return;
      }
      if (settings.beepOnScan) beepOk();
      logDeviceEvent('scan', `${pathname}: ${code} → ${product.name}`);
      toast.success(product.name, {
        description: `${formatRs(product.selling_price)} · ${formatQty(product.stock)} in stock${product.is_active ? '' : ' · inactive'}`,
      });
      router.push(`/products/${product.id}`);
    },
    { enabled: !hasOwnScanHandling(pathname) }
  );

  return null;
}

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { effectivePaperSize, logDeviceEvent, readDeviceSettings } from '@/lib/devices';

interface Props {
  /** paper size this page was rendered with */
  size: '58mm' | '80mm' | 'a4';
  shopDefault: '58mm' | '80mm' | 'a4';
  /** what is being printed, for the device log (e.g. "Invoice INV-00012") */
  label: string;
  /** 'print' for real documents, 'print-test' for the test page */
  kind?: 'print' | 'print-test';
}

/**
 * Lives on every print page:
 *  1. if no ?size= was chosen, switch to THIS counter's paper size
 *     (set on the Devices page) instead of the shop default;
 *  2. with ?auto=1, open the print dialog by itself and close the
 *     window afterwards (used for auto-print after a sale).
 */
export function PrintController({ size, shopDefault, label, kind = 'print' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const wanted = effectivePaperSize(readDeviceSettings().paperSize, shopDefault);
    if (!searchParams.get('size') && wanted !== size) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('size', wanted);
      router.replace(`${pathname}?${params.toString()}`);
      return; // print after the page re-renders at the right width
    }

    if (searchParams.get('auto') !== '1') return;

    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const afterPrint = () => {
      // only close windows the app opened itself
      if (window.opener) closeTimer = setTimeout(() => window.close(), 300);
    };
    window.addEventListener('afterprint', afterPrint);

    const start = setTimeout(async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // fonts are optional for receipts
      }
      logDeviceEvent(kind, `${label} · ${size}${kind === 'print' ? ' · auto' : ''}`);
      window.print();
    }, 350);

    return () => {
      clearTimeout(start);
      if (closeTimer) clearTimeout(closeTimer);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [size, shopDefault, label, kind, pathname, router, searchParams]);

  return null;
}

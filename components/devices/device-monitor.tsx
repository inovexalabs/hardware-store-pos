'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/use-devices';
import { DEVICE_LABELS, markScannerSeen, watchUsbDevices, type DeviceKind } from '@/lib/device-connection';
import { createScanDetector } from '@/lib/scan-detector';
import { TriangleAlert, X } from 'lucide-react';

/**
 * Mounted once in the app layout:
 *  - watches linked USB scanner/printer and toasts when one is unplugged or back;
 *  - notices scanner bursts on any screen (even inside text boxes) so the
 *    scanner shows as "Detected";
 *  - shows a warning strip while a linked device is unplugged.
 * It never blocks anything — every screen keeps working without the devices.
 */
export function DeviceMonitor() {
  const { ready, connections } = useDevices();
  // which unplug (by version) the person dismissed
  const [dismissed, setDismissed] = useState<Partial<Record<DeviceKind, number>>>({});

  useEffect(
    () =>
      watchUsbDevices(({ kind, connected, name }) => {
        if (connected) {
          toast.success(`${DEVICE_LABELS[kind]} connected again.`, { description: name });
        } else {
          toast.warning(`${DEVICE_LABELS[kind]} is not connected.`, {
            description:
              kind === 'scanner'
                ? 'You can keep working — search products by name or type the barcode.'
                : 'Sales still save. Print the receipt later from the invoice.',
            duration: 8000,
          });
        }
      }),
    []
  );

  useEffect(() => {
    // passive: only listens, never stops the key from reaching the page
    const detector = createScanDetector(() => markScannerSeen());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      detector.key(event.key, performance.now());
    };
    window.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      detector.reset();
    };
  }, []);

  if (!ready) return null;
  const unplugged = (['scanner', 'printer'] as const)
    .map((kind) => connections[kind])
    .filter((c) => c.state === 'disconnected' && dismissed[c.kind] !== c.version);
  if (unplugged.length === 0) return null;

  return (
    <div className="no-print space-y-2 px-4 pt-4 sm:px-6" role="status" aria-live="polite">
      {unplugged.map((connection) => (
        <div
          key={connection.kind}
          className="mx-auto flex w-full max-w-[1440px] items-start gap-3 rounded-lg border border-warning/50 bg-warning-subtle px-4 py-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{DEVICE_LABELS[connection.kind]} not connected</p>
            <p className="text-muted-foreground">{connection.message}</p>
            <Link href="/devices" className="mt-1 inline-block font-medium underline underline-offset-2">
              Check on the Devices page
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setDismissed((current) => ({ ...current, [connection.kind]: connection.version }))}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hide this warning"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

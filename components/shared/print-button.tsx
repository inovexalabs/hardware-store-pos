'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { logDeviceEvent } from '@/lib/devices';
import { printerUnplugged } from '@/lib/device-connection';
import { Printer } from 'lucide-react';

/** Opens the browser print dialog. Must be a client component. */
export function PrintButton({ label = 'Print', logLabel }: { label?: string; logLabel?: string }) {
  return (
    <Button
      onClick={() => {
        if (logLabel) logDeviceEvent('print', logLabel);
        // warn only — the print window still opens (Save as PDF, or another printer)
        if (printerUnplugged()) {
          toast.warning('The receipt printer is not connected.', {
            description: 'Plug it in and switch it on, or choose "Save as PDF" / another printer in the print window.',
          });
        }
        window.print();
      }}
    >
      <Printer data-icon="inline-start" />
      {label}
    </Button>
  );
}

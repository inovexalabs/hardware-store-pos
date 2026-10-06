'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useDevices } from '@/hooks/use-devices';
import { clearDeviceLog, effectivePaperSize, type DeviceEventKind } from '@/lib/devices';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/format';
import { ClipboardCopy, ScrollText, Trash2 } from 'lucide-react';

const KIND_LABELS: Record<DeviceEventKind, string> = {
  scan: 'Scan',
  'scan-not-found': 'Scan — not found',
  'scan-test': 'Scanner test',
  print: 'Print',
  'print-test': 'Printer test',
  'print-blocked': 'Print blocked',
  connection: 'Plugged in / unplugged',
  settings: 'Setting changed',
};

/** Recent scanner/printer activity on this computer — the first place to look when something goes wrong. */
export function DeviceLog({ shopDefault }: { shopDefault: '58mm' | '80mm' | 'a4' }) {
  const { log, settings, status } = useDevices();

  async function copyReport() {
    const lines = [
      'Inovexa POS — device report',
      `Time: ${new Date().toString()}`,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${window.screen.width}×${window.screen.height}`,
      `Paper: ${effectivePaperSize(settings.paperSize, shopDefault)} (setting: ${settings.paperSize})`,
      `Auto-print: ${settings.autoPrint ? 'on' : 'off'} · Beep: ${settings.beepOnScan ? 'on' : 'off'}`,
      `Scanner check: ${status.scanner ? `${status.scanner.result} — ${status.scanner.detail} (${status.scanner.at})` : 'not tested'}`,
      `Printer check: ${status.printer ? `${status.printer.result} — ${status.printer.detail} (${status.printer.at})` : 'not tested'}`,
      '',
      'Recent events:',
      ...log.map((e) => `${e.at}  ${e.ok ? 'OK ' : 'ERR'}  ${KIND_LABELS[e.kind]}: ${e.detail}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Device report copied. Paste it into a message to your support person.');
    } catch {
      toast.error('Could not copy automatically. Select the log below and copy it by hand.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-5 w-5" />
          Device log (this computer)
        </CardTitle>
        <CardDescription>
          Every scan that was not found, every print, and every blocked print window is noted here — so when
          something goes wrong you can see exactly what happened and when.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyReport}>
            <ClipboardCopy data-icon="inline-start" />
            Copy Report for Support
          </Button>
          {log.length > 0 && (
            <ConfirmDialog
              title="Clear the device log?"
              description="Only the history on this computer is removed. Settings and sales are not affected."
              confirmLabel="Clear"
              onConfirm={() => {
                clearDeviceLog();
                toast.success('Device log cleared.');
              }}
            >
              <Button variant="ghost">
                <Trash2 data-icon="inline-start" />
                Clear
              </Button>
            </ConfirmDialog>
          )}
        </div>

        {log.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nothing yet. Scans and prints will appear here.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border text-sm">
            {log.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
                <span className={cn('font-medium', !event.ok && 'text-destructive')}>{KIND_LABELS[event.kind]}</span>
                <span className="min-w-0 flex-1 break-words text-muted-foreground">{event.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

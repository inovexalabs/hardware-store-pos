'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/use-devices';
import { effectivePaperSize } from '@/lib/devices';
import {
  linkUsbDevice,
  unlinkUsbDevice,
  usbSupported,
  type DeviceConnection,
  type DeviceKind,
} from '@/lib/device-connection';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/format';
import { CircleAlert, CircleCheck, CircleHelp, Link2, Loader2, Plug, Printer, ScanBarcode, Unplug } from 'lucide-react';

type ShopSize = '58mm' | '80mm' | 'a4';

function Indicator({ result }: { result: 'ok' | 'problem' | null }) {
  if (result === 'ok') return <CircleCheck className="h-4 w-4 text-success" aria-label="Working" />;
  if (result === 'problem') return <CircleAlert className="h-4 w-4 text-destructive" aria-label="Problem" />;
  return <CircleHelp className="h-4 w-4 text-muted-foreground" aria-label="Not tested" />;
}

/** Connection first (unplugged beats everything), then the last test. */
function chipResult(connection: DeviceConnection, check: 'ok' | 'problem' | null): 'ok' | 'problem' | null {
  if (connection.state === 'disconnected') return 'problem';
  if (check === 'problem') return 'problem';
  if (connection.state === 'connected') return 'ok';
  return check;
}

/** Small "Scanner ✓ · Printer 80mm ✓" link for the sale/purchase screens. */
export function DeviceStatusChip({ shopDefault }: { shopDefault: ShopSize }) {
  const { ready, settings, status, connections } = useDevices();
  if (!ready) return null;
  const size = effectivePaperSize(settings.paperSize, shopDefault);
  const scanner = chipResult(connections.scanner, status.scanner?.result ?? null);
  const printer = chipResult(connections.printer, status.printer?.result ?? null);
  const problem = scanner === 'problem' || printer === 'problem';
  const offline = (['scanner', 'printer'] as const).filter((k) => connections[k].state === 'disconnected');

  return (
    <Link
      href="/devices"
      className={cn(
        'no-print inline-flex items-center gap-3 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted',
        problem && 'border-destructive/50 bg-destructive/5'
      )}
      title={[
        `Scanner: ${connections.scanner.message}`,
        `Printer: ${connections.printer.message}`,
        offline.length ? 'You can keep working — open Devices to fix it.' : '',
      ]
        .filter(Boolean)
        .join('\n')}
    >
      <span className="inline-flex items-center gap-1">
        <ScanBarcode className="h-3.5 w-3.5" />
        {connections.scanner.state === 'disconnected' ? 'Scanner not connected' : 'Scanner'}
        <Indicator result={scanner} />
      </span>
      <span className="inline-flex items-center gap-1">
        <Printer className="h-3.5 w-3.5" />
        {connections.printer.state === 'disconnected'
          ? 'Printer not connected'
          : `${size === 'a4' ? 'A4' : size}${settings.autoPrint ? ' · auto' : ''}`}
        <Indicator result={printer} />
      </span>
    </Link>
  );
}

function ConnectionRow({ connection }: { connection: DeviceConnection }) {
  const [busy, setBusy] = useState(false);
  const supported = usbSupported();

  async function link(kind: DeviceKind) {
    setBusy(true);
    try {
      const linked = await linkUsbDevice(kind);
      if (linked) toast.success(`Linked ${linked.name}. You will be warned if it is unplugged.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not link the device.');
    } finally {
      setBusy(false);
    }
  }

  const tone =
    connection.state === 'connected'
      ? 'text-success'
      : connection.state === 'disconnected'
        ? 'text-destructive'
        : 'text-muted-foreground';
  const Icon = connection.state === 'disconnected' ? Unplug : Plug;

  return (
    <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 font-medium', tone)}>
          <Icon className="h-4 w-4" />
          {connection.label}
          {connection.linked && <span className="font-normal text-muted-foreground">· watched</span>}
        </span>
        {connection.linked ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => void unlinkUsbDevice(connection.kind)}>
            Unlink
          </Button>
        ) : supported ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void link(connection.kind)}>
            {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
            Link USB device
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-muted-foreground">{connection.message}</p>
      {!connection.linked && (
        <p className="mt-1 text-xs text-muted-foreground">
          {supported
            ? 'Linking lets this browser warn you when the device is unplugged. Pick it from the list that opens. If it is not in the list (Bluetooth or network devices), skip this — the tests below still work.'
            : 'This browser cannot watch USB devices. Use Google Chrome or Microsoft Edge to get unplug warnings. The tests below work in any browser.'}
        </p>
      )}
    </div>
  );
}

/** Two summary cards at the top of the Devices page. */
export function DeviceStatusCards() {
  const { ready, status, log, connections } = useDevices();
  const lastBlocked = log.find((e) => e.kind === 'print-blocked');
  // misses since the scanner was last tested (or all recent ones if never tested)
  const recentMisses = log.filter(
    (e) => e.kind === 'scan-not-found' && (!status.scanner || e.at > status.scanner.at)
  ).length;

  const cards = [
    {
      kind: 'scanner' as const,
      title: 'Barcode scanner',
      icon: ScanBarcode,
      check: status.scanner,
      extra:
        recentMisses > 0
          ? `${recentMisses} scanned code${recentMisses === 1 ? '' : 's'} not found ${status.scanner ? 'since the last test' : 'recently'} — see the log below.`
          : null,
    },
    {
      kind: 'printer' as const,
      title: 'Receipt printer',
      icon: Printer,
      check: status.printer,
      extra:
        lastBlocked && (!status.printer || new Date(lastBlocked.at) > new Date(status.printer.at))
          ? 'Pop-ups were blocked — receipts could not open for printing.'
          : null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => {
        const connection = connections[card.kind];
        const unplugged = connection.state === 'disconnected';
        return (
          <div
            key={card.title}
            className={cn(
              'rounded-xl border bg-card p-4',
              (unplugged || card.check?.result === 'problem') && 'border-destructive/50',
              !unplugged && card.check?.result === 'ok' && 'border-success/50'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <card.icon className="h-5 w-5" />
                {card.title}
              </p>
              <span className="flex items-center gap-1 text-sm">
                <Indicator result={card.check?.result ?? null} />
                {card.check ? (card.check.result === 'ok' ? 'Test passed' : 'Needs attention') : 'Not tested yet'}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.check ? card.check.detail : 'Run the test below to check this computer.'}
            </p>
            {card.check && <p className="mt-1 text-xs text-muted-foreground">Checked {formatDateTime(card.check.at)}</p>}
            {card.extra && <p className="mt-2 text-sm font-medium text-warning">{card.extra}</p>}
            {ready && <ConnectionRow connection={connection} />}
          </div>
        );
      })}
    </div>
  );
}

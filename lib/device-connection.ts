// =============================================================
//  Is the scanner / printer plugged in?
//
//  A web page cannot see USB hardware by itself, so two signals
//  are used:
//   1. Linked USB device (Chrome / Edge): the person picks the
//      device once on the Devices page. After that the browser
//      reports when it is plugged in or unplugged — a definite
//      answer, used for the "not connected" warnings.
//   2. Activity: without a link, the scanner counts as detected
//      once a scan arrives in this browser tab. The printer has no
//      activity signal, so only its last test result is known.
//
//  Warnings only — nothing here ever blocks selling or printing.
//  Client-side only.
// =============================================================

import {
  logDeviceEvent,
  notifyDevicesChange,
  readStored,
  writeStored,
  type DeviceStatus,
} from '@/lib/devices';

export type DeviceKind = 'scanner' | 'printer';

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  scanner: 'Barcode scanner',
  printer: 'Receipt printer',
};

export interface UsbLink {
  vendorId: number;
  productId: number;
  serialNumber: string | null;
  name: string;
  linkedAt: string;
}

type UsbLinks = Partial<Record<DeviceKind, UsbLink>>;

const LINKS_KEY = 'inovexa.devices.usb';
/** sessionStorage: a scan arrived in this tab */
const SEEN_KEY = 'inovexa.devices.scanner-seen';

// ---------- minimal WebUSB types (not in the TypeScript DOM library) ----------
interface UsbDeviceLike {
  vendorId: number;
  productId: number;
  serialNumber?: string | null;
  productName?: string | null;
  manufacturerName?: string | null;
  forget?: () => Promise<void>;
}

interface UsbLike extends EventTarget {
  getDevices(): Promise<UsbDeviceLike[]>;
  requestDevice(options: { filters: object[] }): Promise<UsbDeviceLike>;
}

function usb(): UsbLike | null {
  if (typeof navigator === 'undefined' || !('usb' in navigator)) return null;
  return (navigator as unknown as { usb: UsbLike }).usb ?? null;
}

/** Chrome/Edge on https or localhost. Firefox and Safari have no WebUSB. */
export function usbSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && usb() !== null;
}

// ---------- runtime state (this tab) ----------
/** null = not checked yet / not linked */
const present: Record<DeviceKind, boolean | null> = { scanner: null, printer: null };
/** bumps on every plug/unplug, so a dismissed warning comes back next time */
const changes: Record<DeviceKind, number> = { scanner: 0, printer: 0 };

export function readUsbLinks(): UsbLinks {
  const links = readStored<UsbLinks>(LINKS_KEY, {});
  return links && typeof links === 'object' ? links : {};
}

function matches(device: UsbDeviceLike, link: UsbLink): boolean {
  return (
    device.vendorId === link.vendorId &&
    device.productId === link.productId &&
    (!link.serialNumber || !device.serialNumber || device.serialNumber === link.serialNumber)
  );
}

function deviceName(device: UsbDeviceLike): string {
  const name = [device.manufacturerName, device.productName].filter(Boolean).join(' ').trim();
  return name || `USB device ${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}`;
}

/**
 * Ask the person to pick the scanner/printer from the browser's USB list.
 * Must run inside a click. Returns null when they close the list.
 */
export async function linkUsbDevice(kind: DeviceKind): Promise<UsbLink | null> {
  const api = usb();
  if (!api) throw new Error('This browser cannot watch USB devices. Use Google Chrome or Microsoft Edge.');
  let device: UsbDeviceLike;
  try {
    device = await api.requestDevice({ filters: [] });
  } catch (error) {
    // NotFoundError = the list was closed without choosing
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
  const link: UsbLink = {
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber ?? null,
    name: deviceName(device),
    linkedAt: new Date().toISOString(),
  };
  present[kind] = true;
  writeStored(LINKS_KEY, { ...readUsbLinks(), [kind]: link });
  logDeviceEvent('connection', `${DEVICE_LABELS[kind]} linked: ${link.name}`);
  return link;
}

export async function unlinkUsbDevice(kind: DeviceKind) {
  const links = readUsbLinks();
  const link = links[kind];
  const rest: UsbLinks = { ...links };
  delete rest[kind];
  present[kind] = null;
  changes[kind] += 1;
  writeStored(LINKS_KEY, Object.keys(rest).length ? rest : null);
  if (link) logDeviceEvent('connection', `${DEVICE_LABELS[kind]} unlinked: ${link.name}`);
  // also drop the browser permission, if the other device isn't the same one
  try {
    const other = rest[kind === 'scanner' ? 'printer' : 'scanner'];
    const devices = (await usb()?.getDevices()) ?? [];
    for (const device of devices) {
      if (link && matches(device, link) && !(other && matches(device, other))) await device.forget?.();
    }
  } catch {
    // forgetting is optional
  }
}

/** Re-check which linked devices are plugged in. Returns what changed. */
export async function refreshUsbPresence(): Promise<{ kind: DeviceKind; connected: boolean; name: string }[]> {
  const api = usb();
  const links = readUsbLinks();
  if (!api || (!links.scanner && !links.printer)) return [];
  let devices: UsbDeviceLike[];
  try {
    devices = await api.getDevices();
  } catch {
    return [];
  }
  const changed: { kind: DeviceKind; connected: boolean; name: string }[] = [];
  for (const kind of ['scanner', 'printer'] as const) {
    const link = links[kind];
    const now = link ? devices.some((device) => matches(device, link)) : null;
    if (now === present[kind]) continue;
    // the first check after the page opens is not a "change"
    if (present[kind] !== null && now !== null && link) changed.push({ kind, connected: now, name: link.name });
    present[kind] = now;
    changes[kind] += 1;
  }
  notifyDevicesChange();
  return changed;
}

/** Listen for plug/unplug. Calls `onChange` for linked devices only. */
export function watchUsbDevices(
  onChange: (change: { kind: DeviceKind; connected: boolean; name: string }) => void
): () => void {
  const api = usb();
  if (!api) return () => {};
  let active = true;
  const check = async () => {
    const changed = await refreshUsbPresence();
    if (!active) return;
    for (const change of changed) {
      logDeviceEvent(
        'connection',
        `${DEVICE_LABELS[change.kind]} ${change.connected ? 'plugged in' : 'unplugged'}: ${change.name}`,
        change.connected
      );
      onChange(change);
    }
  };
  void check();
  api.addEventListener('connect', check);
  api.addEventListener('disconnect', check);
  return () => {
    active = false;
    api.removeEventListener('connect', check);
    api.removeEventListener('disconnect', check);
  };
}

// ---------- scanner activity ----------
export function scannerSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markScannerSeen() {
  if (scannerSeen()) return;
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // private window — the scanner just won't show as detected
  }
  notifyDevicesChange();
}

// ---------- snapshot for useSyncExternalStore ----------
export function connectionSnapshot(): string {
  let links = '';
  try {
    links = window.localStorage.getItem(LINKS_KEY) ?? '';
  } catch {
    // ignore
  }
  return [links, scannerSeen() ? 1 : 0, present.scanner, present.printer, changes.scanner, changes.printer].join('|');
}

// =============================================================
//  What to show (pure)
// =============================================================
export type ConnectionState = 'connected' | 'disconnected' | 'unknown';

export interface DeviceConnection {
  kind: DeviceKind;
  state: ConnectionState;
  /** linked through WebUSB, so plug/unplug is watched */
  linked: boolean;
  name: string | null;
  /** short label for chips, e.g. "Not connected" */
  label: string;
  /** one or two sentences for people at the counter */
  message: string;
  /** bumps on every plug/unplug (for re-showing dismissed warnings) */
  version: number;
}

export function describeConnection(
  kind: DeviceKind,
  input: {
    link: UsbLink | undefined;
    present: boolean | null;
    seen: boolean;
    check: DeviceStatus[DeviceKind];
    version: number;
  }
): DeviceConnection {
  const { link, check, version } = input;
  const base = { kind, linked: Boolean(link), name: link?.name ?? null, version };

  if (link && input.present === false) {
    return {
      ...base,
      state: 'disconnected',
      label: 'Not connected',
      message:
        kind === 'scanner'
          ? `${link.name} is unplugged. Plug it in again — until then, search products by name or type the barcode. Everything else works normally.`
          : `${link.name} is unplugged or switched off. Sales still save — print the receipt later from the invoice, or choose "Save as PDF".`,
    };
  }
  if (link && input.present === true) {
    return { ...base, state: 'connected', label: 'Connected', message: `${link.name} is plugged in.` };
  }
  if (link) {
    return { ...base, state: 'unknown', label: 'Checking…', message: `Checking whether ${link.name} is plugged in…` };
  }

  if (kind === 'scanner') {
    if (input.seen) {
      return { ...base, state: 'connected', label: 'Detected', message: 'A scan was received on this computer.' };
    }
    return {
      ...base,
      state: 'unknown',
      label: 'Not detected',
      message:
        check?.result === 'problem'
          ? `The last scanner test found a problem: ${check.detail}`
          : 'No scan received yet. Scan any barcode to confirm the scanner is connected — or keep working by typing.',
    };
  }

  return {
    ...base,
    state: 'unknown',
    label: check?.result === 'ok' ? 'Tested' : 'Not checked',
    message:
      check?.result === 'ok'
        ? 'The last test print worked. Link the printer on the Devices page to be warned when it is unplugged.'
        : check?.result === 'problem'
          ? `The last test print had a problem: ${check.detail}`
          : 'The printer has not been checked on this computer. Print a test page on the Devices page.',
  };
}

/** Synchronous check used right before printing. */
export function printerUnplugged(): boolean {
  return Boolean(readUsbLinks().printer) && present.printer === false;
}

export function readConnections(status: DeviceStatus): Record<DeviceKind, DeviceConnection> {
  const links = readUsbLinks();
  const seen = scannerSeen();
  return {
    scanner: describeConnection('scanner', {
      link: links.scanner,
      present: present.scanner,
      seen,
      check: status.scanner,
      version: changes.scanner,
    }),
    printer: describeConnection('printer', {
      link: links.printer,
      present: present.printer,
      seen,
      check: status.printer,
      version: changes.printer,
    }),
  };
}

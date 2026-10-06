// =============================================================
//  Counter hardware: barcode scanner + receipt printer.
//  Each shop computer has its own scanner and printer, so these
//  settings and the device log are kept in THIS browser
//  (localStorage), not in the database.  Every read/write is
//  guarded: private windows or blocked storage just fall back to
//  the defaults and the app keeps working.
//  Client-side only.
// =============================================================

export type DevicePaperSize = 'shop' | '58mm' | '80mm' | 'a4';

export interface DeviceSettings {
  /** paper in this counter's printer ('shop' = use the shop default from Settings) */
  paperSize: DevicePaperSize;
  /** open the receipt and the print dialog right after a sale */
  autoPrint: boolean;
  /** short sound when a scan adds an item / a lower one when nothing is found */
  beepOnScan: boolean;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  paperSize: 'shop',
  autoPrint: false,
  beepOnScan: true,
};

export type CheckResult = 'ok' | 'problem';

export interface DeviceStatus {
  scanner: { result: CheckResult; at: string; detail: string } | null;
  printer: { result: CheckResult; at: string; detail: string } | null;
}

export type DeviceEventKind =
  | 'scan'
  | 'scan-not-found'
  | 'scan-test'
  | 'print'
  | 'print-test'
  | 'print-blocked'
  | 'connection'
  | 'settings';

export interface DeviceEvent {
  at: string;
  kind: DeviceEventKind;
  detail: string;
  ok: boolean;
}

const SETTINGS_KEY = 'inovexa.devices.settings';
const STATUS_KEY = 'inovexa.devices.status';
const LOG_KEY = 'inovexa.devices.log';
const LOG_LIMIT = 60;
const CHANGE_EVENT = 'inovexa-devices-change';

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked/full — settings simply won't be remembered
  }
  notifyDevicesChange();
}

/** Tell every useDevices / useDeviceConnection hook to re-read. */
export function notifyDevicesChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// ---------- subscription (for useSyncExternalStore) ----------
export function subscribeDevices(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith('inovexa.devices.')) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** Raw JSON strings, so snapshots only change when the stored data changes. */
export function devicesSnapshot(): string {
  try {
    return [
      window.localStorage.getItem(SETTINGS_KEY) ?? '',
      window.localStorage.getItem(STATUS_KEY) ?? '',
      window.localStorage.getItem(LOG_KEY) ?? '',
    ].join('\u0000');
  } catch {
    return '';
  }
}

// ---------- settings ----------
export function readDeviceSettings(): DeviceSettings {
  return { ...DEFAULT_DEVICE_SETTINGS, ...readStored<Partial<DeviceSettings>>(SETTINGS_KEY, {}) };
}

export function saveDeviceSettings(patch: Partial<DeviceSettings>) {
  writeStored(SETTINGS_KEY, { ...readDeviceSettings(), ...patch });
}

// ---------- last check results ----------
export function readDeviceStatus(): DeviceStatus {
  return { scanner: null, printer: null, ...readStored<Partial<DeviceStatus>>(STATUS_KEY, {}) };
}

export function saveDeviceCheck(device: 'scanner' | 'printer', result: CheckResult, detail: string) {
  writeStored(STATUS_KEY, {
    ...readDeviceStatus(),
    [device]: { result, detail, at: new Date().toISOString() },
  });
}

// ---------- event log ----------
export function readDeviceLog(): DeviceEvent[] {
  const log = readStored<DeviceEvent[]>(LOG_KEY, []);
  return Array.isArray(log) ? log : [];
}

export function logDeviceEvent(kind: DeviceEventKind, detail: string, ok = true) {
  const next = [{ at: new Date().toISOString(), kind, detail: detail.slice(0, 200), ok }, ...readDeviceLog()];
  writeStored(LOG_KEY, next.slice(0, LOG_LIMIT));
}

export function clearDeviceLog() {
  writeStored(LOG_KEY, []);
}

// =============================================================
//  Barcode checks (pure — usable anywhere)
// =============================================================
export interface BarcodeCheck {
  format: 'EAN-13' | 'EAN-8' | 'UPC-A' | 'Code (letters/numbers)';
  /** null = this format has no check digit */
  checkDigitValid: boolean | null;
}

function gtinValid(digits: string): boolean {
  const nums = digits.split('').map(Number);
  const check = nums.pop()!;
  // weights 3,1,3,1… from the right (excluding the check digit)
  const sum = nums
    .reverse()
    .reduce((acc, n, index) => acc + n * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function checkBarcode(code: string): BarcodeCheck {
  if (/^\d{13}$/.test(code)) return { format: 'EAN-13', checkDigitValid: gtinValid(code) };
  if (/^\d{12}$/.test(code)) return { format: 'UPC-A', checkDigitValid: gtinValid(code) };
  if (/^\d{8}$/.test(code)) return { format: 'EAN-8', checkDigitValid: gtinValid(code) };
  return { format: 'Code (letters/numbers)', checkDigitValid: null };
}

/** Elements where the scanner's keystrokes already go somewhere useful. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(target.type);
  }
  return false;
}

// =============================================================
//  Print windows
// =============================================================

/**
 * Open a window for printing. Call this DIRECTLY inside a click handler
 * (before any await) — browsers block pop-ups opened later. Returns null
 * and records it in the device log when the pop-up was blocked.
 */
export function openPrintWindow(url = 'about:blank'): Window | null {
  const win = window.open(url, '_blank');
  if (!win) {
    logDeviceEvent(
      'print-blocked',
      'The browser blocked the print window. Allow pop-ups for this site.',
      false
    );
  }
  return win;
}

/** The paper this counter should print on, given the shop default. */
export function effectivePaperSize(
  device: DevicePaperSize,
  shopDefault: '58mm' | '80mm' | 'a4'
): '58mm' | '80mm' | 'a4' {
  return device === 'shop' ? shopDefault : device;
}

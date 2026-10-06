// Tells a barcode scanner apart from a person typing, using keystroke timing.
// Pure logic (timers aside) so it can be tested without a browser.

export interface ScanInfo {
  /** key the scanner sent after the code ('none' = it sent nothing, we detected the pause) */
  suffix: 'enter' | 'tab' | 'none';
  /** average milliseconds between characters (scanners: ~5–40, people: 80+) */
  avgMs: number;
}

/** A gap longer than this starts a new code. */
export const MAX_GAP_MS = 80;
/** Bursts slower than this on average are a person typing, not a scanner. */
export const MAX_AVG_MS = 50;
/** Scanners without an Enter suffix: treat this much silence as the end of the code. */
export const IDLE_FLUSH_MS = 120;

export function createScanDetector(
  onScan: (code: string, info: ScanInfo) => void,
  minLength = 4
) {
  let buffer = '';
  let times: number[] = [];
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const reset = () => {
    buffer = '';
    times = [];
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };

  const averageGap = () =>
    times.length > 1 ? (times[times.length - 1] - times[0]) / (times.length - 1) : Infinity;

  const finish = (suffix: ScanInfo['suffix']): boolean => {
    const code = buffer.trim();
    const avgMs = averageGap();
    reset();
    if (code.length >= minLength && avgMs <= MAX_AVG_MS) {
      onScan(code, { suffix, avgMs: Math.round(avgMs) });
      return true;
    }
    return false;
  };

  /** Feed one key. Returns true when the key ended a scan (caller should swallow it). */
  const key = (k: string, now: number): boolean => {
    if (times.length && now - times[times.length - 1] > MAX_GAP_MS) reset();

    if (k === 'Enter' || k === 'Tab') {
      return buffer ? finish(k === 'Enter' ? 'enter' : 'tab') : false;
    }
    if (k.length !== 1) return false;

    buffer += k;
    times.push(now);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => finish('none'), IDLE_FLUSH_MS);
    return false;
  };

  return { key, reset };
}

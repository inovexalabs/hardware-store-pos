'use client';

import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/lib/devices';
import { createScanDetector, type ScanInfo } from '@/lib/scan-detector';

export type { ScanInfo };

interface Options {
  enabled?: boolean;
  /** also catch scans while a text box has focus (default: let the text box handle them) */
  whileTyping?: boolean;
  minLength?: number;
}

/**
 * USB/Bluetooth barcode scanners act like a very fast keyboard. This
 * listens on the whole page and calls `onScan` when a fast burst of
 * characters arrives — so scanning works even when no search box is
 * focused. Typing by hand is ignored.
 */
export function useBarcodeScanner(
  onScan: (code: string, info: ScanInfo) => void,
  { enabled = true, whileTyping = false, minLength = 4 }: Options = {}
) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;
    const detector = createScanDetector((code, info) => onScanRef.current(code, info), minLength);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (!whileTyping && isTypingTarget(event.target)) {
        detector.reset();
        return;
      }
      if (detector.key(event.key, performance.now())) {
        // the scanner's Enter must not also press a focused button
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      detector.reset();
    };
  }, [enabled, whileTyping, minLength]);
}

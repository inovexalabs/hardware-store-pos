'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { lookupBarcode, type ScannedProduct } from '@/actions/product.actions';
import {
  checkBarcode,
  isTypingTarget,
  logDeviceEvent,
  saveDeviceCheck,
  saveDeviceSettings,
  type BarcodeCheck,
} from '@/lib/devices';
import { useDevices } from '@/hooks/use-devices';
import { beepError, beepOk } from '@/utils/beep';
import { cn } from '@/lib/utils';
import { formatQty, formatRs } from '@/utils/format';
import { CircleAlert, CircleCheck, Loader2, ScanBarcode, TriangleAlert } from 'lucide-react';

interface Keystroke {
  key: string;
  at: number;
  caps: boolean;
}

interface Issue {
  level: 'problem' | 'warning';
  title: string;
  fix: string;
}

interface ScanResult {
  code: string;
  suffix: 'Enter' | 'Tab' | 'none';
  chars: number;
  avgMs: number;
  totalMs: number;
  looksLikeScanner: boolean;
  capsLock: boolean;
  check: BarcodeCheck;
  product: ScannedProduct | null;
  lookupError: string | null;
  issues: Issue[];
}

/** French/Belgian AZERTY layouts type these instead of 1–0 when the scanner expects US layout. */
const AZERTY_DIGITS = /[&é"'(§è!çà\-_]/;

function analyse(keys: Keystroke[], suffix: ScanResult['suffix']) {
  const code = keys.map((k) => k.key).join('');
  const totalMs = keys.length > 1 ? keys[keys.length - 1].at - keys[0].at : 0;
  const avgMs = keys.length > 1 ? totalMs / (keys.length - 1) : 0;
  return {
    code,
    suffix,
    chars: keys.length,
    avgMs: Math.round(avgMs),
    totalMs: Math.round(totalMs),
    looksLikeScanner: keys.length >= 3 && avgMs <= 50,
    capsLock: keys.some((k) => k.caps),
    check: checkBarcode(code.trim()),
  };
}

function findIssues(r: Omit<ScanResult, 'issues'>, canCreate: boolean): Issue[] {
  const issues: Issue[] = [];
  if (!r.looksLikeScanner) {
    issues.push({
      level: 'problem',
      title: `Characters arrived slowly (${r.avgMs} ms apart) — this looks like typing, not a scanner.`,
      fix: 'If you did scan: the scanner may be in a slow "keyboard emulation" mode or connected through a slow USB hub. Plug it straight into the computer, or scan the "USB HID / fast mode" code in its manual.',
    });
  }
  if (r.suffix !== 'Enter') {
    issues.push({
      level: 'problem',
      title:
        r.suffix === 'Tab'
          ? 'The scanner presses Tab after each code, not Enter.'
          : 'The scanner does not press Enter after each code.',
      fix: 'Items will not be added to the bill automatically. In the scanner manual, scan the setup code called "Add CR suffix", "Enter suffix" or "Carriage return", then test again.',
    });
  }
  if (r.capsLock) {
    issues.push({
      level: 'warning',
      title: 'Caps Lock is ON.',
      fix: 'Some scanners send wrong letters when Caps Lock is on. Press Caps Lock once to turn it off.',
    });
  }
  if (!/\d/.test(r.code) && AZERTY_DIGITS.test(r.code)) {
    issues.push({
      level: 'problem',
      title: `The code came through as symbols ("${r.code}") instead of numbers.`,
      fix: 'The computer keyboard language does not match the scanner. Set Windows to "English (US)" keyboard, or scan the matching keyboard-language code in the scanner manual.',
    });
  }
  if (r.check.checkDigitValid === false && !r.product) {
    issues.push({
      level: 'warning',
      title: `This ${r.check.format} code has a wrong check digit.`,
      fix: 'The label may be damaged or the scanner misread it. Scan the same label again — if the number changes, clean the scanner window or try a cleaner label.',
    });
  }
  if (!r.lookupError && !r.product && r.looksLikeScanner) {
    issues.push({
      level: 'warning',
      title: 'The scanner works, but no product has this barcode yet.',
      fix: canCreate
        ? 'Open the product and type this number in its Barcode field, or add it as a new product.'
        : 'Ask the shop owner or inventory staff to add this barcode to the product.',
    });
  }
  if (r.product && !r.product.is_active) {
    issues.push({
      level: 'warning',
      title: `This barcode belongs to "${r.product.name}", which is switched off (inactive).`,
      fix: 'It will not appear on the sale screen until the product is made active again.',
    });
  }
  return issues;
}

export function ScannerTest({ canCreateProduct }: { canCreateProduct: boolean }) {
  const { settings } = useDevices();
  const boxRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<{ code: string; at: string }[]>([]);
  const canCreateRef = useRef(canCreateProduct);
  const beepRef = useRef(settings.beepOnScan);
  useEffect(() => {
    canCreateRef.current = canCreateProduct;
    beepRef.current = settings.beepOnScan;
  });

  useEffect(() => {
    if (!listening) return;
    let keys: Keystroke[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function complete(suffix: ScanResult['suffix']) {
      if (timer) clearTimeout(timer);
      timer = null;
      const captured = keys;
      keys = [];
      if (captured.length === 0) return;

      setBusy(true);
      const base = analyse(captured, suffix);
      let product: ScannedProduct | null = null;
      let lookupError: string | null = null;
      const res = await lookupBarcode(base.code.trim());
      if (res.ok) product = res.data;
      else lookupError = res.error;

      const partial = { ...base, product, lookupError };
      const issues = findIssues(partial, canCreateRef.current);
      const full: ScanResult = { ...partial, issues };
      setResult(full);
      setHistory((current) => [{ code: base.code, at: new Date().toLocaleTimeString() }, ...current].slice(0, 6));
      setBusy(false);

      const problems = issues.filter((i) => i.level === 'problem');
      const summary = problems.length
        ? problems.map((p) => p.title).join(' ')
        : `Read "${base.code}" in ${base.totalMs} ms with ${suffix} at the end${product ? ` → ${product.name}` : ''}.`;
      saveDeviceCheck('scanner', problems.length ? 'problem' : 'ok', summary);
      logDeviceEvent('scan-test', `${base.code} · ${base.avgMs} ms/char · suffix ${suffix}${product ? ` · ${product.name}` : ' · no product'}`, problems.length === 0);
      if (beepRef.current) (problems.length || !product ? beepError : beepOk)();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // let people type in the header search etc. without triggering the test
      if (isTypingTarget(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (keys.length) {
          event.preventDefault();
          void complete(event.key);
        }
        return;
      }
      if (event.key.length !== 1) return;
      event.preventDefault();
      keys.push({ key: event.key, at: performance.now(), caps: event.getModifierState?.('CapsLock') ?? false });
      if (timer) clearTimeout(timer);
      // no Enter within 400 ms → the scanner sends no suffix
      timer = setTimeout(() => void complete('none'), 400);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (timer) clearTimeout(timer);
    };
  }, [listening]);

  const problems = result?.issues.filter((i) => i.level === 'problem') ?? [];
  const sameCodeTwiceDiffers =
    history.length >= 2 && history[0].code !== history[1].code && history[0].code.length === history[1].code.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanBarcode className="h-5 w-5" />
          Barcode scanner
        </CardTitle>
        <CardDescription>
          Plug the scanner into a USB port (or pair it by Bluetooth). It needs no driver — it types like a
          keyboard. Then scan any product label below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={boxRef}
          tabIndex={0}
          role="status"
          aria-live="polite"
          onClick={() => {
            setListening(true);
            boxRef.current?.focus();
          }}
          className={cn(
            'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center outline-none transition-colors focus-visible:border-primary',
            busy && 'border-primary bg-primary/5',
            !busy && result && problems.length === 0 && 'border-success/60 bg-success/5',
            !busy && result && problems.length > 0 && 'border-destructive/50 bg-destructive/5'
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">Checking the scan…</p>
            </>
          ) : result ? (
            <>
              {problems.length === 0 ? (
                <CircleCheck className="h-9 w-9 text-success" />
              ) : (
                <CircleAlert className="h-9 w-9 text-destructive" />
              )}
              <p className="font-mono text-xl font-semibold break-all">{result.code || '(empty)'}</p>
              <p className="text-sm text-muted-foreground">
                {problems.length === 0 ? 'Scanner is working.' : 'The scanner needs a setting changed — see below.'}{' '}
                Scan again to re-test.
              </p>
            </>
          ) : (
            <>
              <ScanBarcode className="h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-medium">Scan any barcode now</p>
              <p className="text-sm text-muted-foreground">
                Nothing happening? Click inside this box first, then scan.
              </p>
            </>
          )}
        </div>

        {result && !busy && (
          <div className="space-y-3">
            <dl className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Characters</dt>
                <dd className="font-medium">{result.chars}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Speed</dt>
                <dd className={cn('font-medium', !result.looksLikeScanner && 'text-destructive')}>
                  {result.avgMs} ms per character {result.looksLikeScanner ? '(scanner)' : '(too slow)'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Key after the code</dt>
                <dd className={cn('font-medium', result.suffix !== 'Enter' && 'text-destructive')}>
                  {result.suffix === 'none' ? 'nothing' : result.suffix}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Barcode type</dt>
                <dd className="font-medium">
                  {result.check.format}
                  {result.check.checkDigitValid === true && ' · check digit OK'}
                  {result.check.checkDigitValid === false && ' · check digit wrong'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:col-span-2">
                <dt className="text-muted-foreground">Product</dt>
                <dd className="text-right font-medium">
                  {result.lookupError ? (
                    <span className="text-destructive">{result.lookupError}</span>
                  ) : result.product ? (
                    <Link href={`/products/${result.product.id}`} className="underline">
                      {result.product.name} · {formatRs(result.product.selling_price)} ·{' '}
                      {formatQty(result.product.stock)} in stock
                    </Link>
                  ) : (
                    <span className="text-warning">Not found</span>
                  )}
                </dd>
              </div>
            </dl>

            {result.issues.map((issue) => (
              <div
                key={issue.title}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  issue.level === 'problem' ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5'
                )}
              >
                <p className="flex items-start gap-2 font-medium">
                  <TriangleAlert
                    className={cn('mt-0.5 h-4 w-4 shrink-0', issue.level === 'problem' ? 'text-destructive' : 'text-warning')}
                  />
                  {issue.title}
                </p>
                <p className="mt-1 pl-6 text-muted-foreground">{issue.fix}</p>
              </div>
            ))}

            {!result.product && canCreateProduct && result.looksLikeScanner && result.code && (
              <Button variant="outline" asChild>
                <Link href={`/products/new?barcode=${encodeURIComponent(result.code.trim())}`}>
                  Add a new product with this barcode
                </Link>
              </Button>
            )}
          </div>
        )}

        {sameCodeTwiceDiffers && (
          <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
            The last two scans gave different numbers ({history[1].code} → {history[0].code}). If you scanned the
            same label twice, the scanner is misreading it: clean the scanner glass and hold it 10–15 cm from the
            label.
          </p>
        )}

        {history.length > 1 && (
          <div className="text-xs text-muted-foreground">
            Recent test scans:{' '}
            {history.map((h, i) => (
              <span key={`${h.at}-${i}`} className="mr-2 font-mono">
                {h.code}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div>
            <Label htmlFor="beep-on-scan">Beep when scanning</Label>
            <p className="text-sm text-muted-foreground">
              High beep when an item is added, low buzz when the barcode is not found.
            </p>
          </div>
          <Switch
            id="beep-on-scan"
            checked={settings.beepOnScan}
            onCheckedChange={(checked) => {
              saveDeviceSettings({ beepOnScan: checked });
              logDeviceEvent('settings', `Beep on scan ${checked ? 'on' : 'off'}`);
              if (checked) beepOk();
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

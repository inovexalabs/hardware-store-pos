'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDevices } from '@/hooks/use-devices';
import {
  effectivePaperSize,
  logDeviceEvent,
  openPrintWindow,
  saveDeviceCheck,
  saveDeviceSettings,
  type DevicePaperSize,
} from '@/lib/devices';
import { cn } from '@/lib/utils';
import { CircleCheck, Printer, TriangleAlert } from 'lucide-react';

type ShopSize = '58mm' | '80mm' | 'a4';

const SIZE_LABELS: Record<ShopSize, string> = {
  '58mm': '58 mm thermal (small)',
  '80mm': '80 mm thermal (standard)',
  a4: 'A4 page (normal printer)',
};

/** What the person saw → what to do about it. */
const SYMPTOMS: { id: string; label: string; fixes: string[] }[] = [
  {
    id: 'nothing',
    label: 'Nothing came out',
    fixes: [
      'Check the printer is switched on, has paper, and the lid is closed (a blinking light usually means no paper or lid open).',
      'In the print window, check the "Destination" / printer name is your receipt printer — not "Save as PDF" or another printer.',
      'Windows: Settings → Bluetooth & devices → Printers. If the printer is missing, install the driver from the CD or the maker’s website (e.g. "XP-80C driver"), then restart the browser.',
      'If it shows "Offline", unplug the USB cable for 10 seconds and plug it into a different port.',
    ],
  },
  {
    id: 'blank',
    label: 'Paper came out blank',
    fixes: [
      'Thermal paper only prints on one side. Open the lid and turn the roll around so the paper comes out from the other side.',
      'Scratch the paper with a fingernail: the coated side turns grey. That side must face the print head.',
    ],
  },
  {
    id: 'cut',
    label: 'Text is cut off or too wide',
    fixes: [
      'Choose the right paper size above (58 mm or 80 mm) — check the width of your paper roll.',
      'In the print window open "More settings": Paper size = your roll (e.g. 80 × 297 mm or "Receipt"), Margins = None, Scale = Default / 100%.',
      'Untick "Headers and footers" so the date and web address are not printed.',
    ],
  },
  {
    id: 'small',
    label: 'Text is tiny or in the corner',
    fixes: [
      'The browser is shrinking a big page onto the receipt. In "More settings" set Scale to 100% and Paper size to the roll width.',
      'In the printer’s Windows settings (Printing preferences), set the paper to the roll size instead of A4/Letter.',
    ],
  },
  {
    id: 'long',
    label: 'Lots of blank paper after the bill',
    fixes: [
      'In the printer’s Windows "Printing preferences", choose a receipt paper size (often called "80 × 3276 mm" or "Receipt"), not A4.',
      'Turn on "Paper cut / Feed to cut" only after the end of the document, if the driver has that option.',
    ],
  },
  {
    id: 'faded',
    label: 'Print is faded or patchy',
    fixes: [
      'Raise the "Print density / darkness" in the printer’s Windows printing preferences.',
      'Clean the print head gently with a cotton bud and a little alcohol (printer off and cool).',
      'Old or cheap thermal paper fades — try a fresh roll.',
    ],
  },
  {
    id: 'nepali',
    label: 'Nepali text shows as boxes',
    fixes: [
      'The printer is using its own built-in font. In printing preferences, choose "Print as image / graphics" (wording varies by driver).',
    ],
  },
];

export function PrinterSetup({ shopDefault }: { shopDefault: ShopSize }) {
  const { settings, status } = useDevices();
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [symptom, setSymptom] = useState<string | null>(null);
  const size = effectivePaperSize(settings.paperSize, shopDefault);

  function printTest() {
    // must open the window inside the click, or the browser blocks it
    const win = openPrintWindow(`/devices/test-print?size=${size}&auto=1`);
    if (!win) {
      toast.error('The browser blocked the print window. Click the pop-up icon in the address bar and choose "Always allow", then try again.');
      saveDeviceCheck('printer', 'problem', 'Pop-ups are blocked, so receipts cannot open for printing.');
      return;
    }
    setSymptom(null);
    setWaitingForAnswer(true);
  }

  function answer(ok: boolean, id?: string) {
    setWaitingForAnswer(false);
    if (ok) {
      setSymptom(null);
      saveDeviceCheck('printer', 'ok', `Test page printed correctly on ${size}.`);
      logDeviceEvent('print-test', `Confirmed OK on ${size}`, true);
      toast.success('Printer is ready.');
      return;
    }
    const found = SYMPTOMS.find((s) => s.id === id);
    setSymptom(id ?? null);
    saveDeviceCheck('printer', 'problem', `${found?.label ?? 'Problem'} (${size}).`);
    logDeviceEvent('print-test', `Problem: ${found?.label ?? 'unknown'} · ${size}`, false);
  }

  const activeSymptom = SYMPTOMS.find((s) => s.id === symptom);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-5 w-5" />
          Receipt printer
        </CardTitle>
        <CardDescription>
          Install the printer in Windows first (it should appear in Settings → Printers). The app prints through
          the browser, so any printer Windows can use will work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Paper in this counter&apos;s printer</Label>
          <RadioGroup
            value={settings.paperSize}
            onValueChange={(value) => {
              saveDeviceSettings({ paperSize: value as DevicePaperSize });
              logDeviceEvent('settings', `Paper size set to ${value === 'shop' ? `shop default (${shopDefault})` : value}`);
            }}
            className="grid gap-2 sm:grid-cols-2"
          >
            {(['shop', '58mm', '80mm', 'a4'] as const).map((value) => (
              <Label
                key={value}
                htmlFor={`paper-${value}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem id={`paper-${value}`} value={value} />
                <span>
                  {value === 'shop' ? (
                    <>
                      Shop default <span className="text-muted-foreground">({SIZE_LABELS[shopDefault]})</span>
                    </>
                  ) : (
                    SIZE_LABELS[value]
                  )}
                </span>
              </Label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Saved on this computer only, so each counter can have a different printer.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="auto-print">Print the receipt automatically after each sale</Label>
            <p className="text-sm text-muted-foreground">
              The receipt opens and the print window appears by itself. Pop-ups must be allowed for this site.
            </p>
          </div>
          <Switch
            id="auto-print"
            checked={settings.autoPrint}
            onCheckedChange={(checked) => {
              saveDeviceSettings({ autoPrint: checked });
              logDeviceEvent('settings', `Auto-print after sale ${checked ? 'on' : 'off'}`);
            }}
          />
        </div>

        <div className="space-y-3 rounded-lg bg-muted/50 p-4">
          <p className="text-sm">
            Print a test receipt on <strong>{SIZE_LABELS[size]}</strong>. When the print window opens, choose your
            receipt printer and press Print.
          </p>
          <Button onClick={printTest}>
            <Printer data-icon="inline-start" />
            Print Test Receipt
          </Button>
        </div>

        {(waitingForAnswer || symptom) && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">Did the test receipt print correctly?</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => answer(true)}>
                <CircleCheck data-icon="inline-start" />
                Yes, everything is clear
              </Button>
              {SYMPTOMS.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={symptom === s.id ? 'destructive' : 'outline'}
                  onClick={() => answer(false, s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            {activeSymptom && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                  How to fix: {activeSymptom.label.toLowerCase()}
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-6 text-muted-foreground">
                  {activeSymptom.fixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ol>
                <p className="mt-2">Then print the test receipt again.</p>
              </div>
            )}
          </div>
        )}

        {status.printer && !waitingForAnswer && !symptom && (
          <p
            className={cn(
              'flex items-center gap-2 text-sm',
              status.printer.result === 'ok' ? 'text-success' : 'text-destructive'
            )}
          >
            {status.printer.result === 'ok' ? <CircleCheck className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
            Last check: {status.printer.detail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

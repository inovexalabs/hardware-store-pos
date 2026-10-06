import { requireProfile } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { DeviceStatusCards } from '@/components/devices/device-status';
import { ScannerTest } from '@/components/devices/scanner-test';
import { PrinterSetup } from '@/components/devices/printer-setup';
import { DeviceLog } from '@/components/devices/device-log';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Devices' };

const HELP: { q: string; a: string[] }[] = [
  {
    q: 'A "not connected" warning appears at the top of the screen',
    a: [
      'It only appears for a scanner or printer you linked above, when the browser sees it unplugged (or the printer switched off).',
      'You can keep working: sales, purchases and products all save normally. Search products by name or type the barcode; reprint receipts later from the invoice.',
      'Plug the cable back in (try another USB port, without a hub). The warning goes away by itself and a "connected again" message appears.',
      'If the device is plugged in but still shows as not connected, press Unlink and link it again.',
    ],
  },
  {
    q: 'The scanner beeps but nothing appears on the sale screen',
    a: [
      'Run the scanner test above — it shows whether the scanner sends Enter after the code and whether the barcode belongs to a product.',
      'If the test says "Not found", add the barcode to the product (Products → Edit → Barcode).',
      'Wireless scanners: make sure the USB receiver is plugged in and the scanner is charged.',
    ],
  },
  {
    q: 'The scanner does not beep or light up',
    a: [
      'USB scanners: try another USB port, without a hub. Wireless: charge it and re-pair it with its receiver (see the manual).',
      'Open Notepad and scan — if nothing appears there either, the scanner or cable is faulty.',
    ],
  },
  {
    q: 'Scanned numbers have wrong characters or symbols',
    a: [
      'Set the Windows keyboard to "English (US)" (click the language name next to the clock).',
      'Turn Caps Lock off.',
      'Scan the "restore factory defaults" code in the scanner manual, then the "USB keyboard" code.',
    ],
  },
  {
    q: 'Print without the print window every time (silent printing)',
    a: [
      'Chrome or Edge can print straight to the default printer: make the receipt printer the Windows default printer.',
      'Create a desktop shortcut for the browser and add  --kiosk-printing  to the end of its "Target" field, then always open the shop from that shortcut.',
      'Then turn on "Print the receipt automatically after each sale" above.',
    ],
  },
  {
    q: 'Receipts open but the print window never appears',
    a: [
      'The browser is blocking pop-ups: click the blocked pop-up icon at the right end of the address bar and choose "Always allow pop-ups from this site".',
      'The device log below records every blocked print window with the time.',
    ],
  },
  {
    q: 'Cash drawer does not open',
    a: [
      'Most cash drawers plug into the receipt printer and open when it prints. In the printer’s Windows printing preferences, set "Cash drawer: open before/after printing".',
    ],
  },
];

/** Scanner + printer setup and diagnostics for THIS computer. Open to all staff. */
export default async function DevicesPage() {
  const { profile } = await requireProfile();
  const settings = await getShopSettings();
  const canCreateProduct = hasPermission(profile.role, 'products.write');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Devices"
        description="Connect and test the barcode scanner and receipt printer on this computer. If something stops working, start here."
      />

      <DeviceStatusCards />

      <div className="grid gap-6 lg:grid-cols-2">
        <ScannerTest canCreateProduct={canCreateProduct} />
        <PrinterSetup shopDefault={settings.receipt_size} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Common problems</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {HELP.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    {item.a.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <DeviceLog shopDefault={settings.receipt_size} />
    </div>
  );
}

import { formatDateTime, formatRs } from '@/utils/format';
import type { ShopSettings } from '@/types/database';

type Size = '58mm' | '80mm' | 'a4';

/** Characters per line at the receipt font size — what a correctly set-up printer shows in full. */
const LINE_CHARS: Record<Size, number> = { '58mm': 32, '80mm': 48, a4: 80 };

function ruler(width: number) {
  let line = '';
  for (let i = 1; i <= width; i++) line += i % 10 === 0 ? String((i / 10) % 10) : i % 5 === 0 ? '+' : '-';
  return line;
}

/**
 * A receipt designed to show printer problems at a glance:
 * width ruler (cut-off text), alignment, bold, Nepali text (font
 * support), money formatting and the cut line (paper feed).
 */
export function TestReceipt({ settings, size }: { settings: ShopSettings; size: Size }) {
  const width = LINE_CHARS[size];
  const body = (
    <>
      <div className="rc-center">
        <p className="rc-shop">{settings.shop_name}</p>
        <p className="rc-line rc-strong">*** PRINTER TEST ***</p>
        <p className="rc-line">{formatDateTime(new Date())}</p>
        <p className="rc-line">Paper: {size === 'a4' ? 'A4 page' : `${size} thermal`}</p>
      </div>

      <div className="rc-rule" />
      <p className="rc-line rc-strong">1. Width — both ends must be visible</p>
      <pre className="rc-ruler">{ruler(width)}</pre>
      <p className="rc-line rc-sub">
        Should end with {width % 10 === 0 ? String((width / 10) % 10) : '-'} at the right edge ({width}{' '}
        characters).
      </p>

      <div className="rc-rule" />
      <p className="rc-line rc-strong">2. Alignment</p>
      <p className="rc-line">LEFT</p>
      <p className="rc-line rc-center">CENTRE</p>
      <p className="rc-line" style={{ textAlign: 'right' }}>
        RIGHT
      </p>

      <div className="rc-rule" />
      <p className="rc-line rc-strong">3. Text</p>
      <p className="rc-line">Normal text 0123456789</p>
      <p className="rc-line rc-strong">BOLD TEXT 0123456789</p>
      <p className="rc-line rc-sub">Small text — fine print</p>
      <p className="rc-line">नेपाली: धन्यवाद, फेरि आउनुहोला</p>

      <div className="rc-rule" />
      <p className="rc-line rc-strong">4. A sample bill</p>
      <div className="rc-row">
        <span>LED Bulb 9W × 2</span>
        <span>{formatRs(240)}</span>
      </div>
      <div className="rc-row">
        <span>PVC Pipe 1 inch × 10</span>
        <span>{formatRs(2450)}</span>
      </div>
      <div className="rc-row rc-strong">
        <span>TOTAL</span>
        <span>{formatRs(123456.78)}</span>
      </div>

      <div className="rc-rule" />
      <p className="rc-center rc-line">If every line above is clear and complete,</p>
      <p className="rc-center rc-line">your printer is set up correctly.</p>
      <p className="rc-center rc-line rc-sub">- - - - - - cut here - - - - - -</p>
    </>
  );

  if (size === 'a4') {
    return <div className="a4-invoice receipt-a4-test">{body}</div>;
  }
  return <div className={`receipt receipt-${size}`}>{body}</div>;
}

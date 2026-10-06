import type { ReactNode } from 'react';
import type { ShopSettings } from '@/types/database';
import { formatDateTime } from '@/utils/format';

interface Props {
  settings: ShopSettings;
  /** Big title on the right, e.g. "PURCHASE BILL" or "SALES REPORT" */
  title: string;
  /** Lines under the title (number, date range, …) */
  meta?: ReactNode;
  cancelled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A4 page with the shop letterhead. Used for purchase bills, returns,
 * statements and reports so every printout looks the same.
 */
export function PrintDocument({ settings, title, meta, cancelled, children, footer }: Props) {
  return (
    <div className="a4-invoice">
      <header className="a4-header">
        <div>
          <h1>{settings.shop_name}</h1>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Phone: {settings.phone}</p>}
          {settings.pan_vat && <p>PAN/VAT: {settings.pan_vat}</p>}
        </div>
        <div className="a4-title">
          <h2>{title}</h2>
          {meta}
          {cancelled && <p className="a4-cancelled">CANCELLED</p>}
        </div>
      </header>

      <div className="a4-body">{children}</div>

      <footer className="a4-footer">
        {footer}
        <p className="a4-sub">Printed {formatDateTime(new Date())} · Powered by Inovexa Labs</p>
      </footer>
    </div>
  );
}

/** Label/value pairs in the right-hand summary box. */
export function PrintSummary({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <section className="a4-summary">
      <div>
        {rows.map((row) => (
          <p key={row.label} className={row.strong ? 'a4-total' : undefined}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

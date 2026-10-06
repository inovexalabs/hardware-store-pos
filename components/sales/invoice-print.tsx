import { formatRs, formatQty, formatDateTime, paymentMethodLabel } from '@/utils/format';
import type { SaleDetail } from '@/services/sales';
import type { ShopSettings } from '@/types/database';

export type PrintSize = '58mm' | '80mm' | 'a4';

interface Props {
  detail: SaleDetail;
  settings: ShopSettings;
  size: PrintSize;
}


/**
 * One component, three paper sizes. Thermal widths are handled in CSS
 * (see globals.css @page rules); A4 gets a proper letterhead layout.
 */
export function InvoicePrint({ detail, settings, size }: Props) {
  const { sale, items } = detail;
  const thermal = size === '58mm' || size === '80mm';

  if (thermal) {
    return (
      <div className={`receipt receipt-${size}`}>
        <div className="rc-center">
          <p className="rc-shop">{settings.shop_name}</p>
          {settings.address && <p className="rc-line">{settings.address}</p>}
          {settings.phone && <p className="rc-line">Ph: {settings.phone}</p>}
          {settings.pan_vat && <p className="rc-line">PAN/VAT: {settings.pan_vat}</p>}
        </div>

        <div className="rc-rule" />
        <p className="rc-center rc-strong">TAX INVOICE</p>
        <div className="rc-rule" />

        <div className="rc-row">
          <span>Invoice</span>
          <span>{sale.invoice_number}</span>
        </div>
        <div className="rc-row">
          <span>Date</span>
          <span>{formatDateTime(sale.created_at)}</span>
        </div>
        <div className="rc-row">
          <span>Customer</span>
          <span>{sale.customer?.name ?? 'Walk-in'}</span>
        </div>

        <div className="rc-rule" />

        <table className="rc-table">
          <thead>
            <tr>
              <th colSpan={2}>Item</th>
              <th className="rc-num">Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td colSpan={2}>
                  {item.product.name}
                  <br />
                  <span className="rc-sub">
                    {formatQty(item.quantity, item.product.unit?.name)} ×{' '}
                    {formatRs(item.unit_price)}
                    {Number(item.discount_amount) > 0
                      ? ` · less ${formatRs(item.discount_amount)}`
                      : ''}
                  </span>
                </td>
                <td className="rc-num">{formatRs(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rc-rule" />

        <div className="rc-row">
          <span>Subtotal</span>
          <span>{formatRs(sale.subtotal)}</span>
        </div>
        {Number(sale.discount_amount) > 0 && (
          <div className="rc-row">
            <span>Discount</span>
            <span>-{formatRs(sale.discount_amount)}</span>
          </div>
        )}
        {Number(sale.tax_amount) > 0 && (
          <div className="rc-row">
            <span>VAT</span>
            <span>{formatRs(sale.tax_amount)}</span>
          </div>
        )}
        <div className="rc-row rc-strong">
          <span>TOTAL</span>
          <span>{formatRs(sale.total)}</span>
        </div>
        <div className="rc-row">
          <span>Paid ({paymentMethodLabel(sale.payment_method)})</span>
          <span>{formatRs(sale.paid_amount)}</span>
        </div>
        {Number(sale.due_amount) > 0 && (
          <div className="rc-row rc-strong">
            <span>DUE</span>
            <span>{formatRs(sale.due_amount)}</span>
          </div>
        )}

        <div className="rc-rule" />
        <div className="rc-center">
          <p className="rc-line">{settings.invoice_footer || 'Thank you — please visit again!'}</p>
          <p className="rc-line rc-sub">Powered by Inovexa Labs</p>
        </div>
      </div>
    );
  }

  // ---------------- A4 ----------------
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
          <h2>TAX INVOICE</h2>
          <p>
            <strong>{sale.invoice_number}</strong>
          </p>
          <p>{formatDateTime(sale.created_at)}</p>
          {sale.status === 'cancelled' && <p className="a4-cancelled">CANCELLED</p>}
        </div>
      </header>

      <section className="a4-parties">
        <div>
          <h3>Billed To</h3>
          <p>
            <strong>{sale.customer?.name ?? 'Walk-in customer'}</strong>
          </p>
          {sale.customer?.phone && <p>{sale.customer.phone}</p>}
          {sale.customer?.address && <p>{sale.customer.address}</p>}
        </div>
        <div>
          <h3>Served By</h3>
          <p>{sale.profile?.full_name ?? '—'}</p>
          <p>Payment: {paymentMethodLabel(sale.payment_method)}</p>
        </div>
      </section>

      <table className="a4-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th className="a4-num">Qty</th>
            <th className="a4-num">Rate</th>
            <th className="a4-num">Discount</th>
            <th className="a4-num">VAT</th>
            <th className="a4-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>
                {item.product.name}
                <span className="a4-sub"> · {item.product.sku}</span>
              </td>
              <td className="a4-num">{formatQty(item.quantity, item.product.unit?.name)}</td>
              <td className="a4-num">{formatRs(item.unit_price)}</td>
              <td className="a4-num">
                {Number(item.discount_amount) > 0 ? formatRs(item.discount_amount) : '—'}
              </td>
              <td className="a4-num">
                {Number(item.tax_amount) > 0 ? formatRs(item.tax_amount) : '—'}
              </td>
              <td className="a4-num">{formatRs(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="a4-summary">
        <div>
          <p>
            <span>Subtotal</span>
            <span>{formatRs(sale.subtotal)}</span>
          </p>
          <p>
            <span>Discount</span>
            <span>-{formatRs(sale.discount_amount)}</span>
          </p>
          <p>
            <span>VAT</span>
            <span>{formatRs(sale.tax_amount)}</span>
          </p>
          <p className="a4-total">
            <span>Total</span>
            <span>{formatRs(sale.total)}</span>
          </p>
          <p>
            <span>Paid</span>
            <span>{formatRs(sale.paid_amount)}</span>
          </p>
          <p>
            <span>Due</span>
            <span>{formatRs(sale.due_amount)}</span>
          </p>
        </div>
      </section>

      <footer className="a4-footer">
        <p>{settings.invoice_footer || 'Thank you for your business!'}</p>
        <p className="a4-sub">Powered by Inovexa Labs</p>
      </footer>
    </div>
  );
}

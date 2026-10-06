import { PrintDocument, PrintSummary } from '@/components/shared/print-document';
import { formatDateTime, formatQty, formatRs, paymentMethodLabel } from '@/utils/format';
import type { PurchaseDetail } from '@/services/purchases';
import type { ShopSettings } from '@/types/database';

interface Props {
  detail: PurchaseDetail;
  settings: ShopSettings;
}

/** A4 copy of a purchase bill, for the shop's files. */
export function PurchasePrint({ detail, settings }: Props) {
  const { purchase, items } = detail;
  const supplier = purchase.supplier;

  return (
    <PrintDocument
      settings={settings}
      title="PURCHASE BILL"
      cancelled={purchase.status === 'cancelled'}
      meta={
        <>
          <p>
            <strong>{purchase.purchase_number}</strong>
          </p>
          <p>{formatDateTime(purchase.created_at)}</p>
          {purchase.supplier_invoice_no && <p>Supplier bill: {purchase.supplier_invoice_no}</p>}
        </>
      }
      footer={purchase.notes ? <p>Note: {purchase.notes}</p> : undefined}
    >
      <section className="a4-parties">
        <div>
          <h3>Supplier</h3>
          <p>
            <strong>{supplier?.company ?? supplier?.name ?? '—'}</strong>
          </p>
          {supplier?.company && <p>Attn: {supplier.name}</p>}
          {supplier?.phone && <p>{supplier.phone}</p>}
          {supplier?.address && <p>{supplier.address}</p>}
          {supplier?.pan_vat && <p>PAN/VAT: {supplier.pan_vat}</p>}
        </div>
        <div>
          <h3>Received By</h3>
          <p>{purchase.profile?.full_name ?? '—'}</p>
          <p>Payment: {paymentMethodLabel(purchase.payment_method)}</p>
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
              <td className="a4-num">
                {formatQty(item.quantity, item.unit?.name)}
                {Number(item.base_quantity) !== Number(item.quantity) && (
                  <span className="a4-sub">
                    <br />= {formatQty(item.base_quantity, item.product.unit?.name)}
                  </span>
                )}
              </td>
              <td className="a4-num">{formatRs(item.unit_price)}</td>
              <td className="a4-num">
                {Number(item.discount_amount) > 0 ? formatRs(item.discount_amount) : '—'}
              </td>
              <td className="a4-num">{formatRs(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PrintSummary
        rows={[
          { label: 'Subtotal', value: formatRs(purchase.subtotal) },
          { label: 'Discount', value: `-${formatRs(purchase.discount_amount)}` },
          { label: 'VAT / tax', value: formatRs(purchase.tax_amount) },
          { label: 'Total', value: formatRs(purchase.total), strong: true },
          { label: 'Paid', value: formatRs(purchase.paid_amount) },
          { label: 'Due', value: formatRs(purchase.due_amount) },
        ]}
      />
    </PrintDocument>
  );
}

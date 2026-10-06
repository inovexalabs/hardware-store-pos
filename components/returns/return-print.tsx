import { PrintDocument, PrintSummary } from '@/components/shared/print-document';
import { formatDateTime, formatQty, formatRs } from '@/utils/format';
import type { ReturnDetail } from '@/services/returns';
import type { ShopSettings } from '@/types/database';

interface Props {
  detail: ReturnDetail;
  settings: ShopSettings;
}

/** Credit note for a customer return, or a debit note for goods sent back to a supplier. */
export function ReturnPrint({ detail, settings }: Props) {
  const isSales = detail.kind === 'sales';

  return (
    <PrintDocument
      settings={settings}
      title={isSales ? 'CREDIT NOTE' : 'DEBIT NOTE'}
      meta={
        <>
          <p>
            <strong>{detail.return_number}</strong>
          </p>
          <p>{formatDateTime(detail.created_at)}</p>
          {detail.source && (
            <p>
              Against {isSales ? 'invoice' : 'purchase'} {detail.source.number}
            </p>
          )}
        </>
      }
      footer={detail.reason ? <p>Reason: {detail.reason}</p> : undefined}
    >
      <section className="a4-parties">
        <div>
          <h3>{isSales ? 'Customer' : 'Supplier'}</h3>
          <p>
            <strong>{detail.party?.name ?? (isSales ? 'Walk-in customer' : '—')}</strong>
          </p>
          {detail.party?.phone && <p>{detail.party.phone}</p>}
          {detail.party?.address && <p>{detail.party.address}</p>}
        </div>
        <div>
          <h3>Processed By</h3>
          <p>{detail.made_by ?? '—'}</p>
        </div>
      </section>

      <table className="a4-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th className="a4-num">Qty</th>
            <th className="a4-num">Rate</th>
            <th className="a4-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {detail.items.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>
                {item.product_name}
                <span className="a4-sub"> · {item.sku}</span>
              </td>
              <td className="a4-num">{formatQty(item.quantity, item.unit_name ?? undefined)}</td>
              <td className="a4-num">{formatRs(item.unit_price)}</td>
              <td className="a4-num">{formatRs(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PrintSummary
        rows={
          isSales
            ? [
                { label: 'Goods value', value: formatRs(detail.subtotal) },
                { label: 'VAT refunded', value: formatRs(detail.tax_amount) },
                { label: 'Total refund', value: formatRs(detail.total), strong: true },
              ]
            : [{ label: 'Total return value', value: formatRs(detail.total), strong: true }]
        }
      />
    </PrintDocument>
  );
}

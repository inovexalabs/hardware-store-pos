'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import { parseOrThrow, saleSchema, cancelSchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';
import type { CreateSaleResult } from '@/types/database';

function revalidateSales() {
  revalidatePath('/dashboard');
  revalidatePath('/sales');
  revalidatePath('/products');
}

/** POS checkout — all rules live in the database function. */
export async function createSale(input: unknown): Promise<ActionResult<CreateSaleResult>> {
  return safe(async () => {
    await assertPermission('sales.create');
    const values = parseOrThrow(saleSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('create_sale', {
      p_customer_id: values.customer_id,
      p_items: values.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount ?? 0,
      })),
      p_discount: values.discount,
      p_paid: values.paid,
      p_payment_method: values.payment_method,
      p_notes: values.notes,
    });

    if (error) throw new Error(error.message);
    revalidateSales();
    return ok(data as CreateSaleResult);
  });
}

/** Cancelling keeps the history and puts the stock back. */
export async function cancelSale(saleId: string, reason: unknown): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('sales.cancel');
    const { reason: cleanReason } = parseOrThrow(cancelSchema, { reason });
    const supabase = await createClient();

    const { error } = await supabase.rpc('cancel_sale', {
      p_sale_id: saleId,
      p_reason: cleanReason,
    });
    if (error) throw new Error(error.message);

    revalidateSales();
    revalidatePath(`/sales/${saleId}`);
    return ok({ id: saleId });
  });
}

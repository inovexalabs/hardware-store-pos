'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import { parseOrThrow, purchaseSchema, cancelSchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';
import { searchPurchaseProducts, type PurchaseProduct } from '@/services/purchases';
import type { CreatePurchaseResult } from '@/types/database';

function revalidatePurchases() {
  revalidatePath('/dashboard');
  revalidatePath('/purchases');
  revalidatePath('/products');
  revalidatePath('/suppliers');
}

/** Purchase entry — increases stock and supplier balance atomically. */
export async function createPurchase(input: unknown): Promise<ActionResult<CreatePurchaseResult>> {
  return safe(async () => {
    await assertPermission('purchases.write');
    const values = parseOrThrow(purchaseSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('create_purchase', {
      p_supplier_id: values.supplier_id,
      p_items: values.items.map((item) => ({
        product_id: item.product_id,
        unit_id: item.unit_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount ?? 0,
      })),
      p_supplier_invoice_no: values.supplier_invoice_no,
      p_discount: values.discount,
      p_tax: values.tax,
      p_paid: values.paid,
      p_payment_method: values.payment_method,
      p_notes: values.notes,
    });

    if (error) throw new Error(error.message);
    revalidatePurchases();
    return ok(data as CreatePurchaseResult);
  });
}

export async function cancelPurchase(purchaseId: string, reason: unknown): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('purchases.cancel');
    const { reason: cleanReason } = parseOrThrow(cancelSchema, { reason });
    const supabase = await createClient();

    const { error } = await supabase.rpc('cancel_purchase', {
      p_purchase_id: purchaseId,
      p_reason: cleanReason,
    });
    if (error) throw new Error(error.message);

    revalidatePurchases();
    revalidatePath(`/purchases/${purchaseId}`);
    return ok({ id: purchaseId });
  });
}

/** Product search for the purchase screen — includes the units you can buy in. */
export async function purchaseProductSearch(term: string): Promise<ActionResult<PurchaseProduct[]>> {
  return safe(async () => {
    await assertPermission('purchases.write');
    return ok(await searchPurchaseProducts(term));
  });
}

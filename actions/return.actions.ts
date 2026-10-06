'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import { parseOrThrow, salesReturnSchema, purchaseReturnSchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';
import type { CreateReturnResult } from '@/types/database';

export async function createSalesReturn(input: unknown): Promise<ActionResult<CreateReturnResult>> {
  return safe(async () => {
    await assertPermission('returns.process');
    const values = parseOrThrow(salesReturnSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('create_sales_return', {
      p_sale_id: values.sale_id,
      p_items: values.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
      p_reason: values.reason,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/dashboard');
    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/returns');
    revalidatePath(`/sales/${values.sale_id}`);
    return ok(data as CreateReturnResult);
  });
}

export async function createPurchaseReturn(input: unknown): Promise<ActionResult<CreateReturnResult>> {
  return safe(async () => {
    await assertPermission('returns.process');
    const values = parseOrThrow(purchaseReturnSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('create_purchase_return', {
      p_purchase_id: values.purchase_id,
      p_items: values.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
      p_reason: values.reason,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/dashboard');
    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/returns');
    revalidatePath('/suppliers');
    revalidatePath(`/purchases/${values.purchase_id}`);
    return ok(data as CreateReturnResult);
  });
}

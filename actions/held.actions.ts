'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { safe } from './safe';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';

const heldItemsSchema = z.array(
  z.object({
    product_id: z.string().min(1),
    name: z.string().min(1),
    sku: z.string().min(1),
    unit: z.string().min(1),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    discount: z.number().min(0),
    stock: z.number().min(0),
    tax_rate: z.number().min(0).max(100).optional().default(0),
  })
);

const heldSaleSchema = z.object({
  title: z.string().trim().max(80).default(''),
  customer_id: z
    .string()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  items: heldItemsSchema.min(1, 'The cart is empty.'),
});

export async function saveHeldSale(
  input: unknown,
  heldId?: string
): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('sales.create');
    const values = heldSaleSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Your session has ended. Please sign in again.');

    let id = heldId;
    if (heldId) {
      const { error } = await supabase
        .from('held_sales')
        .update({
          title: values.title || 'Held sale',
          customer_id: values.customer_id,
          items: values.items,
        })
        .eq('id', heldId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from('held_sales')
        .insert({
          title: values.title || 'Held sale',
          customer_id: values.customer_id,
          items: values.items,
          user_id: user.id,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }

    revalidatePath('/sales/new');
    return ok({ id: id! });
  });
}

export async function deleteHeldSale(heldId: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('sales.create');
    const supabase = await createClient();
    const { error } = await supabase.from('held_sales').delete().eq('id', heldId);
    if (error) throw new Error(error.message);
    revalidatePath('/sales/new');
    return ok({ id: heldId });
  });
}

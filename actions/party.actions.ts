'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import { parseOrThrow, customerSchema, supplierSchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';

export async function saveCustomer(input: unknown, customerId?: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('customers.write');
    const values = parseOrThrow(customerSchema, input);
    const supabase = await createClient();

    let id = customerId;
    if (customerId) {
      const { error } = await supabase.from('customers').update(values).eq('id', customerId);
      if (error) throw new Error(error.message);
    } else {
      // new customers are always active; is_active is not insertable
      const { is_active: _customerActive, ...insertable } = values;
      const { data, error } = await supabase
        .from('customers')
        .insert(insertable)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }

    revalidatePath('/customers');
    if (id) revalidatePath(`/customers/${id}`);
    return ok({ id: id! });
  });
}

export async function setCustomerActive(customerId: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('customers.write');
    const supabase = await createClient();
    const { error } = await supabase
      .from('customers')
      .update({ is_active: active })
      .eq('id', customerId);
    if (error) throw new Error(error.message);
    revalidatePath('/customers');
    return ok({ id: customerId });
  });
}

export async function saveSupplier(input: unknown, supplierId?: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('suppliers.write');
    const values = parseOrThrow(supplierSchema, input);
    const supabase = await createClient();

    let id = supplierId;
    if (supplierId) {
      const { error } = await supabase.from('suppliers').update(values).eq('id', supplierId);
      if (error) throw new Error(error.message);
    } else {
      const { is_active: _supplierActive, ...insertable } = values;
      const { data, error } = await supabase
        .from('suppliers')
        .insert(insertable)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }

    revalidatePath('/suppliers');
    if (id) revalidatePath(`/suppliers/${id}`);
    return ok({ id: id! });
  });
}

export async function setSupplierActive(supplierId: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('suppliers.write');
    const supabase = await createClient();
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: active })
      .eq('id', supplierId);
    if (error) throw new Error(error.message);
    revalidatePath('/suppliers');
    return ok({ id: supplierId });
  });
}

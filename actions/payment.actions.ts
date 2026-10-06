'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import { parseOrThrow, paymentSchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';
import type { PaymentResult } from '@/types/database';

/** Money received from a customer (optionally against an invoice). */
export async function recordCustomerPayment(input: unknown): Promise<ActionResult<PaymentResult>> {
  return safe(async () => {
    await assertPermission('payments.record');
    const values = parseOrThrow(paymentSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('record_customer_payment', {
      p_customer_id: values.party_id,
      p_amount: values.amount,
      p_method: values.method,
      p_notes: values.notes,
      p_sale_id: values.invoice_id,
      p_reference: values.reference,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/dashboard');
    revalidatePath('/customers');
    revalidatePath('/reports');
    if (values.invoice_id) revalidatePath(`/sales/${values.invoice_id}`);
    return ok(data as PaymentResult);
  });
}

/** Money paid to a supplier (optionally against a purchase bill). */
export async function recordSupplierPayment(input: unknown): Promise<ActionResult<PaymentResult>> {
  return safe(async () => {
    await assertPermission('payments.record');
    const values = parseOrThrow(paymentSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('record_supplier_payment', {
      p_supplier_id: values.party_id,
      p_amount: values.amount,
      p_method: values.method,
      p_notes: values.notes,
      p_purchase_id: values.invoice_id,
      p_reference: values.reference,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/dashboard');
    revalidatePath('/suppliers');
    revalidatePath('/reports');
    if (values.invoice_id) revalidatePath(`/purchases/${values.invoice_id}`);
    return ok(data as PaymentResult);
  });
}

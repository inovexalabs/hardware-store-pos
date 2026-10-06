'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { safe } from './safe';
import { parseOrThrow, expenseSchema, expenseCategorySchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fail, ok, type ActionResult } from '@/lib/result';
import { MAX_RECEIPT_BYTES, RECEIPT_BUCKET, RECEIPT_TYPES } from '@/lib/receipts';
import { todayInShopTimezone } from '@/utils/format';

function revalidateExpenses(id?: string) {
  revalidatePath('/expenses');
  if (id) revalidatePath(`/expenses/${id}`);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

/** Best effort: a leftover file is harmless, so never fail the action over it. */
async function removeReceiptFile(path: string | null | undefined) {
  if (!path) return;
  try {
    await createAdminClient().storage.from(RECEIPT_BUCKET).remove([path]);
  } catch (error) {
    console.error('[receipt] could not remove', path, error);
  }
}

export async function saveExpense(input: unknown, expenseId?: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    const ctx = await assertPermission('expenses.write');
    const values = parseOrThrow(expenseSchema, input);
    const supabase = await createClient();

    let id = expenseId;
    if (expenseId) {
      const { data: previous } = await supabase
        .from('expenses')
        .select('receipt_url')
        .eq('id', expenseId)
        .maybeSingle();

      const { error } = await supabase.from('expenses').update(values).eq('id', expenseId);
      if (error) throw new Error(error.message);

      // receipt replaced or removed → delete the old file
      if (previous?.receipt_url && previous.receipt_url !== values.receipt_url) {
        await removeReceiptFile(previous.receipt_url);
      }
    } else {
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...values, user_id: ctx.userId })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }

    revalidateExpenses(id);
    return ok({ id: id! });
  });
}

export async function deleteExpense(expenseId: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('expenses.write');
    const supabase = await createClient();
    const { data: previous } = await supabase
      .from('expenses')
      .select('receipt_url')
      .eq('id', expenseId)
      .maybeSingle();

    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) throw new Error(error.message);

    await removeReceiptFile(previous?.receipt_url);
    revalidateExpenses();
    return ok({ id: expenseId });
  });
}

/**
 * Store a receipt photo or PDF. Returns the private storage path,
 * which is then saved on the expense with saveExpense().
 */
export async function uploadExpenseReceipt(formData: FormData): Promise<ActionResult<{ path: string }>> {
  return safe(async () => {
    await assertPermission('expenses.write');

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail('Choose a photo or PDF of the receipt first.');
    }
    const ext = RECEIPT_TYPES[file.type];
    if (!ext) {
      return fail('Only photos (JPG, PNG, WEBP) or PDF files can be attached as a receipt.');
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      return fail('The file is too large. Choose one smaller than 4 MB.');
    }

    const admin = createAdminClient();
    // private bucket: receipts are only shown through signed links
    await admin.storage
      .createBucket(RECEIPT_BUCKET, {
        public: false,
        fileSizeLimit: MAX_RECEIPT_BYTES,
        allowedMimeTypes: Object.keys(RECEIPT_TYPES),
      })
      .catch(() => undefined);

    const path = `receipts/${todayInShopTimezone().slice(0, 7)}/${randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(RECEIPT_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);

    return ok({ path });
  });
}

/** Add a new expense heading (e.g. "Generator fuel"). */
export async function createExpenseCategory(
  input: unknown
): Promise<ActionResult<{ id: string; name: string }>> {
  return safe(async () => {
    await assertPermission('expenses.write');
    const { name } = parseOrThrow(expenseCategorySchema, input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ name })
      .select('id, name')
      .single();
    if (error) throw new Error(error.message);
    revalidatePath('/expenses');
    return ok(data as { id: string; name: string });
  });
}

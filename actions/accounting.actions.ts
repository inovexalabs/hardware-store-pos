'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import { accountSchema, journalEntrySchema, parseOrThrow, reverseEntrySchema } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ok, type ActionResult } from '@/lib/result';

interface EntryResult {
  entry_id: string;
  entry_number: string;
}

function revalidateBooks() {
  revalidatePath('/accounting', 'layout');
  revalidatePath('/reports');
}

/** A manual journal entry (capital, drawings, bank deposit, loan, …). */
export async function createJournalEntry(input: unknown): Promise<ActionResult<EntryResult>> {
  return safe(async () => {
    await assertPermission('accounting.write');
    const values = parseOrThrow(journalEntrySchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('create_journal_entry', {
      p_entry_date: values.entry_date,
      p_narration: values.narration,
      p_reference: values.reference,
      p_lines: values.lines
        .filter((line) => line.debit > 0 || line.credit > 0)
        .map((line) => ({
          account_id: line.account_id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
        })),
    });
    if (error) throw new Error(error.message);

    revalidateBooks();
    return ok(data as EntryResult);
  });
}

/** Undo a manual entry with an opposite entry dated today. */
export async function reverseJournalEntry(
  entryId: string,
  input: unknown
): Promise<ActionResult<EntryResult>> {
  return safe(async () => {
    await assertPermission('accounting.write');
    const { reason } = parseOrThrow(reverseEntrySchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('reverse_journal_entry', {
      p_entry_id: entryId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);

    revalidateBooks();
    return ok(data as EntryResult);
  });
}

/** Add an account, or edit one (leave `accountId` empty to add). */
export async function saveAccount(
  input: unknown,
  accountId?: string
): Promise<ActionResult<{ account_id: string }>> {
  return safe(async () => {
    await assertPermission('accounting.write');
    const values = parseOrThrow(accountSchema, input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('save_account', {
      p_id: accountId ?? null,
      p_code: values.code,
      p_name: values.name,
      p_type: values.type,
      p_description: values.description,
      p_is_active: values.is_active,
    });
    if (error) throw new Error(error.message);

    revalidateBooks();
    return ok(data as { account_id: string });
  });
}

/** Bring the Stock account in line with the products' stock value. */
export async function postStockRevaluation(): Promise<ActionResult<EntryResult & { difference: number }>> {
  return safe(async () => {
    await assertPermission('accounting.write');
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('post_stock_revaluation');
    if (error) throw new Error(error.message);

    revalidateBooks();
    return ok(data as EntryResult & { difference: number });
  });
}

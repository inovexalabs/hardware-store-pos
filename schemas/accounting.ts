import { z } from 'zod';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

/** One row of a manual journal entry. Empty rows are dropped before saving. */
export const journalLineSchema = z.object({
  account_id: z.guid('Choose an account for every line that has an amount.'),
  debit: z.coerce.number({ message: 'Enter the debit as a number.' }).min(0, 'Amounts cannot be negative.').default(0),
  credit: z.coerce.number({ message: 'Enter the credit as a number.' }).min(0, 'Amounts cannot be negative.').default(0),
  memo: optionalText(200),
});

export const journalEntrySchema = z
  .object({
    entry_date: z
      .string()
      .min(1, 'Choose the date of the entry.')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.'),
    narration: z
      .string()
      .trim()
      .min(1, 'Write what this entry is for (the narration).')
      .max(300, 'The narration is too long (300 characters at most).'),
    reference: optionalText(60),
    lines: z.array(journalLineSchema),
  })
  .superRefine((value, ctx) => {
    const used = value.lines.filter((line) => line.debit > 0 || line.credit > 0);
    if (used.some((line) => line.debit > 0 && line.credit > 0)) {
      ctx.addIssue({ code: 'custom', message: 'Each line needs either a debit or a credit amount, not both.' });
      return;
    }
    const debit = used.reduce((sum, line) => sum + line.debit, 0);
    const credit = used.reduce((sum, line) => sum + line.credit, 0);
    if (used.length < 2 || debit === 0 || credit === 0) {
      ctx.addIssue({ code: 'custom', message: 'An entry needs at least two lines: one debit and one credit.' });
      return;
    }
    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      ctx.addIssue({ code: 'custom', message: 'Debits and credits must be equal before you can save.' });
    }
  });

export type JournalEntryInput = z.input<typeof journalEntrySchema>;

export const accountSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z.-]{1,12}$/, 'Enter an account code of up to 12 letters or numbers (for example 5210).'),
  name: z.string().trim().min(1, 'Enter the account name.').max(80, 'The account name is too long.'),
  type: z.enum(ACCOUNT_TYPES, { message: 'Choose the account type.' }),
  description: optionalText(200),
  is_active: z.boolean().default(true),
});

export type AccountInput = z.input<typeof accountSchema>;

export const reverseEntrySchema = z.object({
  reason: z.string().trim().min(3, 'Please write a short reason (at least 3 characters).').max(200),
});

import { z } from 'zod';

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `This field cannot be longer than ${max} characters.`)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const phone = z
  .string()
  .trim()
  .max(25, 'Phone number is too long.')
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

/** Empty is fine; anything typed must look like an email. */
const optionalEmail = z
  .string()
  .trim()
  .max(120, 'Email is too long.')
  .nullish()
  .refine((v) => !v || z.email().safeParse(v).success, 'Enter a valid email address.')
  .transform((v) => (v && v.length > 0 ? v : null));

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Enter the customer name.').max(120),
  phone: phone,
  address: optionalText(200),
  email: optionalEmail,
  credit_limit: z.coerce
    .number({ message: 'Credit limit must be a number.' })
    .min(0, 'Credit limit cannot be negative.')
    .default(0),
  notes: optionalText(500),
  is_active: z.boolean().default(true),
});

export type CustomerInput = z.input<typeof customerSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Enter the contact person name.').max(120),
  company: optionalText(150),
  phone: phone,
  address: optionalText(200),
  email: optionalEmail,
  pan_vat: optionalText(30),
  notes: optionalText(500),
  is_active: z.boolean().default(true),
});

export type SupplierInput = z.input<typeof supplierSchema>;

export const paymentSchema = z.object({
  party_id: z.string().min(1, 'Choose who the payment is for.'),
  amount: z.coerce
    .number({ message: 'Enter the amount as a number.' })
    .positive('Enter an amount greater than zero.'),
  method: z.enum(['cash', 'bank', 'wallet'], {
    message: 'Choose how the payment was made.',
  }),
  reference: optionalText(60),
  notes: optionalText(300),
  /** Link to a specific invoice (optional) */
  invoice_id: z
    .string()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type PaymentInput = z.input<typeof paymentSchema>;

export const userSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the person's name.").max(120),
  email: z.string().trim().min(1, 'Enter an email address.').email('Enter a valid email address.'),
  role: z.enum(['owner', 'manager', 'cashier', 'inventory'], {
    message: 'Choose what this person is allowed to do.',
  }),
  is_active: z.boolean().default(true),
});

export type UserInput = z.input<typeof userSchema>;

export const userCreateSchema = userSchema.extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(100, 'Password is too long.'),
});

export type UserCreateInput = z.input<typeof userCreateSchema>;

export const userProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name.').max(120),
  phone: phone,
});

export const shopSettingsSchema = z.object({
  shop_name: z.string().trim().min(1, 'Enter the shop name.').max(120),
  address: optionalText(250),
  phone: phone,
  email: optionalEmail,
  pan_vat: optionalText(30),
  invoice_footer: z.string().trim().max(300, 'Footer message is too long.').default(''),
});

export const invoiceSettingsSchema = z.object({
  invoice_prefix: z
    .string()
    .trim()
    .min(1, 'Enter a short invoice prefix, e.g. INV.')
    .max(10, 'Prefix can be at most 10 characters.')
    .regex(/^[A-Za-z0-9-]+$/, 'Use only letters, numbers or dashes (e.g. INV-).'),
  purchase_prefix: z
    .string()
    .trim()
    .min(1, 'Enter a short purchase prefix, e.g. PUR.')
    .max(10, 'Prefix can be at most 10 characters.')
    .regex(/^[A-Za-z0-9-]+$/, 'Use only letters, numbers or dashes (e.g. PUR-).'),
  receipt_size: z.enum(['58mm', '80mm', 'a4'], { message: 'Choose the receipt size.' }),
});

export const taxSettingsSchema = z.object({
  tax_enabled: z.boolean().default(true),
  tax_rate: z.coerce
    .number({ message: 'Tax rate must be a number.' })
    .min(0, 'Tax rate cannot be negative.')
    .max(100, 'Tax rate cannot be more than 100%.'),
  allow_negative_stock: z.boolean().default(false),
});

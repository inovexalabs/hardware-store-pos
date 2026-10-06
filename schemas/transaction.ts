import { z } from 'zod';
import { RECEIPT_PATH_PATTERN } from '@/lib/receipts';

/** One line in the POS cart / purchase cart. */
export const cartItemSchema = z.object({
  product_id: z.string().min(1, 'Choose a product.'),
  /** display only — the database reads the real name/unit from the product */
  name: z.string().nullish(),
  sku: z.string().nullish(),
  unit: z.string().nullish(),
  quantity: z.coerce
    .number({ message: 'Quantity must be a number.' })
    .positive('Quantity must be more than zero.'),
  unit_price: z.coerce
    .number({ message: 'Price must be a number.' })
    .min(0, 'Price cannot be negative.'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative.').default(0),
  /** available stock, used for friendly warnings */
  stock: z.coerce.number().default(0),
  /** VAT % for this product */
  tax_rate: z.coerce.number().min(0).max(100).default(0),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const saleSchema = z.object({
  customer_id: z
    .string()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  items: z.array(cartItemSchema).min(1, 'The cart is empty. Add at least one product.'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative.').default(0),
  paid: z.coerce.number().min(0, 'Paid amount cannot be negative.'),
  payment_method: z.enum(['cash', 'bank', 'wallet', 'credit'], {
    message: 'Choose how the customer is paying.',
  }),
  notes: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type SaleInput = z.input<typeof saleSchema>;

/** A purchase line — quantity is entered in the chosen unit. */
export const purchaseItemSchema = z.object({
  product_id: z.string().min(1, 'Choose a product.'),
  name: z.string().min(1),
  sku: z.string().min(1),
  unit_id: z.string().min(1, 'Choose the unit you bought in.'),
  unit: z.string().min(1),
  quantity: z.coerce
    .number({ message: 'Quantity must be a number.' })
    .positive('Quantity must be more than zero.'),
  unit_price: z.coerce
    .number({ message: 'Purchase price must be a number.' })
    .min(0, 'Purchase price cannot be negative.'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative.').default(0),
  base_unit: z.string().min(1),
  conversion_factor: z.coerce.number().positive().default(1),
});

export type PurchaseCartItem = z.infer<typeof purchaseItemSchema>;

export const purchaseSchema = z.object({
  supplier_id: z.string().min(1, 'Choose a supplier for this purchase.'),
  supplier_invoice_no: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  items: z.array(purchaseItemSchema).min(1, 'Add at least one product.'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative.').default(0),
  tax: z.coerce.number().min(0, 'Tax cannot be negative.').default(0),
  paid: z.coerce.number().min(0, 'Paid amount cannot be negative.'),
  payment_method: z.enum(['cash', 'bank', 'wallet', 'credit'], {
    message: 'Choose how you are paying.',
  }),
  notes: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type PurchaseInput = z.input<typeof purchaseSchema>;

export const salesReturnSchema = z.object({
  sale_id: z.string().min(1, 'Choose the invoice.'),
  reason: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.coerce.number().positive('Enter how many are being returned.'),
      })
    )
    .min(1, 'Choose at least one product to return.'),
});

export type SalesReturnInput = z.input<typeof salesReturnSchema>;

export const purchaseReturnSchema = z.object({
  purchase_id: z.string().min(1, 'Choose the purchase.'),
  reason: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.coerce.number().positive('Enter how many are being returned.'),
      })
    )
    .min(1, 'Choose at least one product to return.'),
});

export type PurchaseReturnInput = z.input<typeof purchaseReturnSchema>;

export const expenseSchema = z.object({
  category_id: z.string().min(1, 'Choose an expense category.'),
  amount: z.coerce
    .number({ message: 'Enter the amount as a number.' })
    .positive('Enter an amount greater than zero.'),
  spent_on: z
    .string()
    .min(1, 'Choose the date.')
    .refine((v) => !isNaN(Date.parse(v)), 'Choose a valid date.'),
  method: z.enum(['cash', 'bank', 'wallet'], {
    message: 'Choose how you paid.',
  }),
  description: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  /** storage path of the uploaded receipt photo/PDF; empty = no receipt */
  receipt_url: z
    .string()
    .nullish()
    .refine((v) => !v || RECEIPT_PATH_PATTERN.test(v), 'The receipt file is not valid. Upload it again.')
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type ExpenseInput = z.input<typeof expenseSchema>;

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'Enter the category name.').max(60, 'Category name is too long.'),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(3, 'Please write a short reason (at least 3 characters).').max(300),
});

/** Turn a ZodError into one friendly sentence for a toast. */
export function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Please check the form and try again.';
  const path = issue.path.join('.');
  if (path) return `${issue.message}`;
  return issue.message;
}

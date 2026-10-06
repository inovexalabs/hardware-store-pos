import { z } from 'zod';

/** Empty optional strings become null before hitting the database. */
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `This field cannot be longer than ${max} characters.`)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalId = z
  .string()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Enter the product name.').max(150, 'Name is too long.'),
  sku: z
    .string()
    .trim()
    .min(1, 'Enter an item code (SKU), e.g. ELE-012.')
    .max(60, 'Item code is too long.'),
  barcode: z
    .string()
    .trim()
    .max(60, 'Barcode is too long.')
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  category_id: optionalId,
  brand_id: optionalId,
  unit_id: z.string().min(1, 'Choose the unit (Piece, Box, Kg...).'),
  supplier_id: optionalId,
  purchase_price: z.coerce
    .number({ message: 'Purchase price must be a number.' })
    .min(0, 'Purchase price cannot be negative.'),
  selling_price: z.coerce
    .number({ message: 'Selling price must be a number.' })
    .min(0, 'Selling price cannot be negative.'),
  wholesale_price: z.coerce
    .number({ message: 'Wholesale price must be a number.' })
    .min(0, 'Wholesale price cannot be negative.')
    .default(0),
  opening_stock: z.coerce
    .number({ message: 'Opening stock must be a number.' })
    .min(0, 'Opening stock cannot be negative.')
    .default(0),
  min_stock: z.coerce
    .number({ message: 'Minimum stock must be a number.' })
    .min(0, 'Minimum stock cannot be negative.')
    .default(0),
  rack: optionalText(40),
  tax_rate: z.coerce
    .number({ message: 'Tax rate must be a number.' })
    .min(0, 'Tax rate cannot be negative.')
    .max(100, 'Tax rate cannot be more than 100%.'),
  image_url: optionalText(500),
  description: optionalText(1000),
  is_active: z.boolean().default(true),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter the category name.').max(60),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1, 'Enter the brand name.').max(60),
});

export const stockAdjustSchema = z.object({
  product_id: z.string().min(1, 'Choose the product.'),
  new_stock: z.coerce
    .number({ message: 'Enter the new stock quantity as a number.' })
    .min(0, 'Stock cannot be less than zero.'),
  movement_type: z.enum(['adjustment', 'damage', 'lost', 'initial'], {
    message: 'Choose a reason for the stock change.',
  }),
  reason: z
    .string()
    .trim()
    .max(300, 'Reason is too long.')
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type StockAdjustInput = z.input<typeof stockAdjustSchema>;

/** Reason must be filled for anything except "initial stock". */
export function validateStockAdjustReason(values: {
  movement_type: string;
  reason: string | null;
}): string | null {
  if (values.movement_type !== 'initial' && !values.reason) {
    return 'Please write a reason for this stock change.';
  }
  return null;
}

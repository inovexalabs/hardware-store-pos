'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { safe } from './safe';
import { parseOrThrow, productSchema, categorySchema, brandSchema, stockAdjustSchema, validateStockAdjustReason } from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { Product } from '@/types/database';

const PRODUCT_WRITE_COLUMNS = {
  name: true,
  sku: true,
  barcode: true,
  category_id: true,
  brand_id: true,
  unit_id: true,
  supplier_id: true,
  purchase_price: true,
  selling_price: true,
  wholesale_price: true,
  min_stock: true,
  rack: true,
  tax_rate: true,
  image_url: true,
  description: true,
  is_active: true,
} as const;

/** Create or update a product. Stock always starts at 0 and only
 *  changes through the database functions (adjust_stock). */
export async function saveProduct(input: unknown, productId?: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('products.write');
    const values = parseOrThrow(productSchema, input);
    const supabase = await createClient();

    const payload = Object.fromEntries(
      Object.entries(values).filter(([key]) => key in PRODUCT_WRITE_COLUMNS && key !== 'opening_stock')
    );

    let id = productId;

    if (productId) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', productId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;

      // record the opening stock as a proper stock movement
      if (values.opening_stock > 0) {
        const { error: adjustError } = await supabase.rpc('adjust_stock', {
          p_product_id: id,
          p_new_stock: values.opening_stock,
          p_movement_type: 'initial',
          p_reason: null,
        });
        if (adjustError) throw new Error(adjustError.message);
      }
    }

    revalidatePath('/products');
    if (id) revalidatePath(`/products/${id}`);
    return ok({ id: id! });
  });
}

/** Soft delete — products are deactivated, never removed. */
export async function setProductActive(productId: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('products.write');
    const supabase = await createClient();
    const { error } = await supabase
      .from('products')
      .update({ is_active: active })
      .eq('id', productId);
    if (error) throw new Error(error.message);
    revalidatePath('/products');
    return ok({ id: productId });
  });
}

export async function createCategory(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  return safe(async () => {
    await assertPermission('products.write');
    const value = parseOrThrow(categorySchema, { name });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: value.name })
      .select('id, name')
      .single();
    if (error) throw new Error(error.message);
    revalidatePath('/products');
    return ok(data as { id: string; name: string });
  });
}

export async function createBrand(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  return safe(async () => {
    await assertPermission('products.write');
    const value = parseOrThrow(brandSchema, { name });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('brands')
      .insert({ name: value.name })
      .select('id, name')
      .single();
    if (error) throw new Error(error.message);
    revalidatePath('/products');
    return ok(data as { id: string; name: string });
  });
}

/** Manual stock change with a required reason (damage/lost/adjust). */
export async function adjustStock(input: unknown): Promise<ActionResult<{ previous_stock: number; new_stock: number }>> {
  return safe(async () => {
    await assertPermission('stock.adjust');
    const values = parseOrThrow(stockAdjustSchema, input);

    const reasonError = validateStockAdjustReason(values);
    if (reasonError) return fail(reasonError);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_product_id: values.product_id,
      p_new_stock: values.new_stock,
      p_movement_type: values.movement_type,
      p_reason: values.reason,
    });
    if (error) throw new Error(error.message);

    const result = data as { previous_stock: number; new_stock: number };
    revalidatePath('/products');
    revalidatePath(`/products/${values.product_id}`);
    revalidatePath('/dashboard');
    return ok(result);
  });
}

/**
 * Unit conversions (1 Box = 100 Piece) live on the product page.
 * They tell the system how a purchase unit relates to the base unit.
 */
export async function addUnitConversion(
  productId: string,
  fromUnitId: string,
  factor: number
): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('products.write');
    if (!Number.isFinite(factor) || factor <= 0) {
      return fail('Enter how many units make one of the chosen unit (greater than zero).');
    }

    const supabase = await createClient();
    const product = await supabase
      .from('products')
      .select('unit_id')
      .eq('id', productId)
      .single();
    if (product.error) throw new Error(product.error.message);

    if (product.data.unit_id === fromUnitId) {
      return fail('That is already the product\u2019s own unit. Choose a different unit.');
    }

    const { error } = await supabase
      .from('unit_conversions')
      .upsert(
        {
          product_id: productId,
          from_unit_id: fromUnitId,
          to_unit_id: product.data.unit_id,
          factor: factor,
        },
        { onConflict: 'product_id,from_unit_id,to_unit_id' }
      );
    if (error) throw new Error(error.message);

    revalidatePath(`/products/${productId}`);
    return ok({ id: productId });
  });
}

export async function removeUnitConversion(conversionId: string, productId: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('products.write');
    const supabase = await createClient();
    const { error } = await supabase
      .from('unit_conversions')
      .delete()
      .eq('id', conversionId);
    if (error) throw new Error(error.message);
    revalidatePath(`/products/${productId}`);
    return ok({ id: conversionId });
  });
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Upload a product photo (type + size checked on the server). */
export async function uploadProductImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return safe(async () => {
    await assertPermission('products.write');

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail('Choose an image first.');
    }
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      return fail('Only JPG, PNG, WEBP or GIF images can be uploaded.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return fail('The image is too large. Choose one smaller than 2 MB.');
    }

    const admin = createAdminClient();
    const ext = ALLOWED_IMAGE_TYPES[file.type];
    const path = `products/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // make sure the bucket exists (public: product photos are not sensitive)
    await admin.storage.createBucket('product-images', { public: true }).catch(() => undefined);

    const { error } = await admin.storage
      .from('product-images')
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);

    const { data } = admin.storage.from('product-images').getPublicUrl(path);
    return ok({ url: data.publicUrl });
  });
}

export type { Product };

export interface ScannedProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  stock: number;
  selling_price: number;
  is_active: boolean;
  matched_by: 'barcode' | 'sku';
}

/** Exact barcode (or item code) lookup — used by scanning and the scanner test. */
export async function lookupBarcode(code: string): Promise<ActionResult<ScannedProduct | null>> {
  return safe<ScannedProduct | null>(async () => {
    await assertPermission('products.view');
    const clean = String(code ?? '').trim().slice(0, 60);
    if (!clean) return ok(null);
    const supabase = await createClient();
    const columns = 'id, name, sku, barcode, stock, selling_price, is_active';

    const { data: byBarcode, error } = await supabase
      .from('products')
      .select(columns)
      .eq('barcode', clean)
      .order('is_active', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    if (byBarcode?.[0]) return ok({ ...(byBarcode[0] as Omit<ScannedProduct, 'matched_by'>), matched_by: 'barcode' });

    const { data: bySku } = await supabase
      .from('products')
      .select(columns)
      .ilike('sku', clean.replace(/[%_\\]/g, ''))
      .order('is_active', { ascending: false })
      .limit(1);
    if (bySku?.[0]) return ok({ ...(bySku[0] as Omit<ScannedProduct, 'matched_by'>), matched_by: 'sku' });

    return ok(null);
  });
}

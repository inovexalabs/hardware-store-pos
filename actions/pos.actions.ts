'use server';

import { safe } from './safe';
import { assertPermission } from '@/lib/auth/guards';
import { searchPosProducts, type PosProduct } from '@/services/products';
import { ok, type ActionResult } from '@/lib/result';

/**
 * Product search for the POS screen. Barcode scanners type the code and
 * press Enter — exact barcode matches come back first.
 */
export async function posSearch(term: string): Promise<ActionResult<PosProduct[]>> {
  return safe(async () => {
    await assertPermission('sales.create');
    const rows = await searchPosProducts(term, 12);
    return ok(rows);
  });
}

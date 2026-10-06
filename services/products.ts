import { createClient } from '@/lib/supabase/server';
import type {
  Brand,
  Category,
  Product,
  ProductListItem,
  StockMovementWithDetails,
  Unit,
  UnitConversion,
} from '@/types/database';

const PRODUCT_JOINS = `
  *,
  category:categories(id, name),
  brand:brands(id, name),
  unit:units(id, name, allow_decimal),
  supplier:suppliers(id, name, company)
`;

/** Remove characters that would break PostgREST's or() filter syntax. */
function sanitizeSearch(value: string): string {
  return value.replace(/[,%()\\]/g, ' ').trim().slice(0, 80);
}

export type StockStatusFilter = 'all' | 'in' | 'low' | 'out';
export type ProductSort = 'name' | 'stock' | 'selling_price' | 'newest';

export interface ProductListParams {
  search?: string;
  category_id?: string;
  brand_id?: string;
  stock?: StockStatusFilter;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
}

export async function listProducts(params: ProductListParams = {}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('products')
    .select(PRODUCT_JOINS, { count: 'exact' });

  const search = params.search ? sanitizeSearch(params.search) : '';
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`
    );
  }
  if (params.category_id) query = query.eq('category_id', params.category_id);
  if (params.brand_id) query = query.eq('brand_id', params.brand_id);
  if (params.stock === 'in') query = query.filter('stock', 'gt', 0).gt('min_stock', 0);
  if (params.stock === 'low') query = query.filter('stock', 'gt', 0).filter('stock', 'lte', 'min_stock');
  if (params.stock === 'out') query = query.lte('stock', 0);

  const sort = params.sort ?? 'name';
  if (sort === 'name') query = query.order('name');
  else if (sort === 'stock') query = query.order('stock', { ascending: false });
  else if (sort === 'selling_price') query = query.order('selling_price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, count, error } = await query.range(from, from + perPage - 1);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as ProductListItem[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

export async function getProduct(id: string): Promise<ProductListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_JOINS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as unknown as ProductListItem) ?? null;
}

export type UnitConversionWithUnits = UnitConversion & {
  from_unit: Pick<Unit, 'id' | 'name'> | null;
  to_unit: Pick<Unit, 'id' | 'name'> | null;
};

export async function getProductConversions(
  productId: string
): Promise<UnitConversionWithUnits[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('unit_conversions')
    .select('*, from_unit:units!unit_conversions_from_unit_id_fkey(id, name), to_unit:units!unit_conversions_to_unit_id_fkey(id, name)')
    .eq('product_id', productId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UnitConversionWithUnits[];
}

export async function getProductMovements(
  productId: string,
  limit = 50
): Promise<StockMovementWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, product:products(id, name, sku), profile:profiles(id, full_name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StockMovementWithDetails[];
}

/** Products a cashier can sell — used by POS search and barcode lookup. */
export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  selling_price: number;
  wholesale_price: number;
  stock: number;
  min_stock: number;
  tax_rate: number;
  unit: { name: string; allow_decimal: boolean } | null;
  category: { name: string } | null;
}

/** Runs on the server (route handler) so large catalogues stay fast. */
export async function searchPosProducts(
  term: string,
  limit = 20
): Promise<PosProduct[]> {
  const supabase = await createClient();
  const search = sanitizeSearch(term);
  if (!search) return [];

  // exact barcode match first (USB scanners type the code + Enter)
  const { data: byBarcode } = await supabase
    .from('products')
    .select('id, name, sku, barcode, selling_price, wholesale_price, stock, min_stock, tax_rate, unit:units(name, allow_decimal), category:categories(name)')
    .eq('barcode', term.trim())
    .eq('is_active', true)
    .limit(1);

  if (byBarcode && byBarcode.length > 0) {
    return byBarcode as unknown as PosProduct[];
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, barcode, selling_price, wholesale_price, stock, min_stock, tax_rate, unit:units(name, allow_decimal), category:categories(name)')
    .eq('is_active', true)
    .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
    .order('name')
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PosProduct[];
}

// -------------------------------------------------------------
//  Reference data for forms and filters
// -------------------------------------------------------------

export async function listCategories(includeInactive = false): Promise<Category[]> {
  const supabase = await createClient();
  let query = supabase.from('categories').select('*').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

export async function listBrands(includeInactive = false): Promise<Brand[]> {
  const supabase = await createClient();
  let query = supabase.from('brands').select('*').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Brand[];
}

export async function listUnits(): Promise<Unit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Unit[];
}

/** Lightweight product picker for purchase/return forms. */
export async function listProductsMinimal(): Promise<
  Pick<Product, 'id' | 'name' | 'sku' | 'unit_id' | 'purchase_price' | 'stock'>[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, unit_id, purchase_price, stock')
    .eq('is_active', true)
    .order('name')
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Product, 'id' | 'name' | 'sku' | 'unit_id' | 'purchase_price' | 'stock'>[];
}

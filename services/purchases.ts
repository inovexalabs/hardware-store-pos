import { createClient } from '@/lib/supabase/server';
import type {
  Profile,
  Purchase,
  PurchaseItemWithProduct,
  PurchaseReturn,
  Supplier,
  SupplierPayment,
  Unit,
} from '@/types/database';

function sanitizeSearch(value: string): string {
  return value.replace(/[,%()\\]/g, ' ').trim().slice(0, 80);
}

export interface PurchaseListParams {
  search?: string;
  from?: string;
  to?: string;
  status?: 'all' | 'completed' | 'cancelled';
  supplier_id?: string;
  page?: number;
  perPage?: number;
}

export type PurchaseListRow = Purchase & {
  supplier: Pick<Supplier, 'id' | 'name' | 'company'> | null;
  profile: Pick<Profile, 'id' | 'full_name'> | null;
};

export async function listPurchases(params: PurchaseListParams = {}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('purchases')
    .select(
      `*,
       supplier:suppliers(id, name, company),
       profile:profiles!purchases_user_id_fkey(id, full_name)`,
      { count: 'exact' }
    );

  const search = params.search ? sanitizeSearch(params.search) : '';
  if (search) {
    const { data: matchedSuppliers } = await supabase
      .from('suppliers')
      .select('id')
      .or(`name.ilike.%${search}%,company.ilike.%${search}%`)
      .limit(10);

    const clauses = [
      `purchase_number.ilike.%${search}%`,
      `supplier_invoice_no.ilike.%${search}%`,
    ];
    if (matchedSuppliers && matchedSuppliers.length > 0) {
      clauses.push(`supplier_id.in.(${matchedSuppliers.map((s) => s.id).join(',')})`);
    }
    query = query.or(clauses.join(','));
  }
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.supplier_id) query = query.eq('supplier_id', params.supplier_id);
  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+05:45`);
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59+05:45`);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as PurchaseListRow[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

export interface PurchaseDetail {
  purchase: Purchase & {
    supplier: Supplier | null;
    profile: Pick<Profile, 'id' | 'full_name'> | null;
  };
  items: PurchaseItemWithProduct[];
  returns: PurchaseReturn[];
  payments: (SupplierPayment & { profile: Pick<Profile, 'full_name'> | null })[];
}

export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  const supabase = await createClient();

  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('*, supplier:suppliers(*), profile:profiles!purchases_user_id_fkey(id, full_name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!purchase) return null;

  const [
    { data: items, error: itemsError },
    { data: returns, error: returnsError },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from('purchase_items')
      .select(
        '*, product:products(id, name, sku, unit:units(name)), unit:units(name, allow_decimal)'
      )
      .eq('purchase_id', id)
      .order('created_at'),
    supabase
      .from('purchase_returns')
      .select('*')
      .eq('purchase_id', id)
      .order('created_at', { ascending: false }),
    // needs suppliers.view; staff without it simply see no payments here
    supabase
      .from('supplier_payments')
      .select('*, profile:profiles(full_name)')
      .eq('purchase_id', id)
      .order('created_at', { ascending: false }),
  ]);
  if (itemsError) throw new Error(itemsError.message);
  if (returnsError) throw new Error(returnsError.message);

  return {
    purchase: purchase as unknown as PurchaseDetail['purchase'],
    items: (items ?? []) as unknown as PurchaseItemWithProduct[],
    returns: (returns ?? []) as PurchaseReturn[],
    payments: (payments ?? []) as PurchaseDetail['payments'],
  };
}

// -------------------------------------------------------------
//  Product search for the purchase screen (with buying units)
// -------------------------------------------------------------
export interface PurchaseUnitOption {
  unit_id: string;
  name: string;
  allow_decimal: boolean;
  /** 1 of this unit = factor × base unit */
  factor: number;
}

export interface PurchaseProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  purchase_price: number;
  stock: number;
  base_unit: Pick<Unit, 'id' | 'name' | 'allow_decimal'>;
  units: PurchaseUnitOption[];
}

interface RawPurchaseProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  purchase_price: number;
  stock: number;
  unit: Pick<Unit, 'id' | 'name' | 'allow_decimal'>;
  conversions: {
    factor: number;
    from_unit: Pick<Unit, 'id' | 'name' | 'allow_decimal'> | null;
    to_unit: Pick<Unit, 'id' | 'name' | 'allow_decimal'> | null;
  }[];
}

const PURCHASE_PRODUCT_COLUMNS = `
  id, name, sku, barcode, purchase_price, stock,
  unit:units(id, name, allow_decimal),
  conversions:unit_conversions(
    factor,
    from_unit:units!unit_conversions_from_unit_id_fkey(id, name, allow_decimal),
    to_unit:units!unit_conversions_to_unit_id_fkey(id, name, allow_decimal)
  )
`;

/**
 * The same conversion rules the database uses in create_purchase:
 * "1 Box = 100 Piece" lets you buy in Box; the reverse direction
 * ("1 Piece = 0.5 Box") works too.
 */
function toPurchaseProduct(raw: RawPurchaseProduct): PurchaseProduct {
  const base = raw.unit;
  const units: PurchaseUnitOption[] = [
    { unit_id: base.id, name: base.name, allow_decimal: base.allow_decimal, factor: 1 },
  ];
  for (const conversion of raw.conversions ?? []) {
    const factor = Number(conversion.factor);
    if (!factor || factor <= 0) continue;
    if (conversion.to_unit?.id === base.id && conversion.from_unit) {
      units.push({
        unit_id: conversion.from_unit.id,
        name: conversion.from_unit.name,
        allow_decimal: conversion.from_unit.allow_decimal,
        factor,
      });
    } else if (conversion.from_unit?.id === base.id && conversion.to_unit) {
      units.push({
        unit_id: conversion.to_unit.id,
        name: conversion.to_unit.name,
        allow_decimal: conversion.to_unit.allow_decimal,
        factor: Math.round((1 / factor) * 1e6) / 1e6,
      });
    }
  }
  const unique = units.filter(
    (option, index) => units.findIndex((u) => u.unit_id === option.unit_id) === index
  );
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.sku,
    barcode: raw.barcode,
    purchase_price: Number(raw.purchase_price),
    stock: Number(raw.stock),
    base_unit: base,
    units: unique,
  };
}

export async function searchPurchaseProducts(term: string, limit = 12): Promise<PurchaseProduct[]> {
  const supabase = await createClient();
  const search = sanitizeSearch(term);
  if (!search) return [];

  const { data: byBarcode } = await supabase
    .from('products')
    .select(PURCHASE_PRODUCT_COLUMNS)
    .eq('barcode', term.trim())
    .eq('is_active', true)
    .limit(1);
  if (byBarcode && byBarcode.length > 0) {
    return (byBarcode as unknown as RawPurchaseProduct[]).map(toPurchaseProduct);
  }

  const { data, error } = await supabase
    .from('products')
    .select(PURCHASE_PRODUCT_COLUMNS)
    .eq('is_active', true)
    .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
    .order('name')
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawPurchaseProduct[]).map(toPurchaseProduct);
}

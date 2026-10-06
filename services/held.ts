import { createClient } from '@/lib/supabase/server';
import type { HeldSale } from '@/types/database';

export async function listHeldSales(): Promise<HeldSale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('held_sales')
    .select('*, customer:customers(id, name)')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HeldSale[];
}

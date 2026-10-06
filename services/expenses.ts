import { createClient } from '@/lib/supabase/server';
import type { ExpenseCategory, ExpenseWithCategory, Profile } from '@/types/database';

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category_id?: string;
  search?: string;
}

export interface ExpenseListParams extends ExpenseFilters {
  page?: number;
  perPage?: number;
}

export type ExpenseDetail = ExpenseWithCategory & {
  profile: Pick<Profile, 'id' | 'full_name'> | null;
};

const EXPENSE_COLUMNS = '*, category:expense_categories(id, name), profile:profiles(id, full_name)';

type Client = Awaited<ReturnType<typeof createClient>>;

/** Not async on purpose: a query builder is "thenable", so awaiting it would run it. */
function filteredExpenses(supabase: Client, filters: ExpenseFilters, count?: 'exact') {
  let query = supabase.from('expenses').select(EXPENSE_COLUMNS, count ? { count } : undefined);

  if (filters.from) query = query.gte('spent_on', filters.from);
  if (filters.to) query = query.lte('spent_on', filters.to);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.search) {
    const search = filters.search.replace(/[,%()\\]/g, ' ').trim();
    if (search) query = query.ilike('description', `%${search}%`);
  }

  return query.order('spent_on', { ascending: false }).order('created_at', { ascending: false });
}

export async function listExpenses(params: ExpenseListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 20));
  const rangeStart = (page - 1) * perPage;

  const supabase = await createClient();
  const { data, count, error } = await filteredExpenses(supabase, params, 'exact').range(
    rangeStart,
    rangeStart + perPage - 1
  );
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as ExpenseDetail[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

/** Every expense matching the filters — for the period total and CSV export. */
export async function listAllExpenses(filters: ExpenseFilters = {}): Promise<ExpenseDetail[]> {
  const supabase = await createClient();
  const { data, error } = await filteredExpenses(supabase, filters).range(0, 9999);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ExpenseDetail[];
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseCategory[];
}

export async function getExpense(id: string): Promise<ExpenseDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ExpenseDetail) ?? null;
}

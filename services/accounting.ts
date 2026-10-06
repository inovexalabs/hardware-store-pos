import { createClient } from '@/lib/supabase/server';
import { sourceFilterTypes } from '@/lib/accounting';
import type {
  Account,
  AccountAmountRow,
  AccountBalanceRow,
  AccountingOverview,
  JournalEntry,
  JournalEntryWithLines,
  LedgerRow,
  Profile,
  TrialBalanceRow,
} from '@/types/database';

type Client = Awaited<ReturnType<typeof createClient>>;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Overview & statements ----------
export const getAccountingOverview = (from: string, to: string) =>
  rpc<AccountingOverview>('accounting_overview', { p_from: from, p_to: to });

/** Every account with its balance (up to `asOf`, or everything). */
export const getAccountBalances = (asOf?: string | null) =>
  rpc<AccountBalanceRow[]>('report_account_balances', { p_as_of: asOf ?? null });

export const getTrialBalance = (from: string, to: string) =>
  rpc<TrialBalanceRow[]>('report_trial_balance', { p_from: from, p_to: to });

export const getIncomeStatement = (from: string, to: string) =>
  rpc<AccountAmountRow[]>('report_income_statement', { p_from: from, p_to: to });

export const getBalanceSheet = (asOf: string) =>
  rpc<AccountAmountRow[]>('report_balance_sheet', { p_as_of: asOf });

export const getAccountLedger = (accountId: string, from: string, to: string) =>
  rpc<LedgerRow[]>('report_account_ledger', { p_account_id: accountId, p_from: from, p_to: to });

// ---------- Accounts ----------
export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Account) ?? null;
}

/** All accounts, for pickers (ledger account switcher). */
export async function listAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').select('*').order('code');
  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

/** Accounts a person may use in a manual entry. */
export async function listPostingAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .eq('allow_manual', true)
    .order('code');
  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

// ---------- Journal ----------
export interface JournalFilters {
  from?: string;
  to?: string;
  /** a SOURCE_FILTERS value */
  source?: string;
  search?: string;
}

export type JournalListRow = JournalEntry & {
  profile: Pick<Profile, 'id' | 'full_name'> | null;
};

/** Not async on purpose: a query builder is "thenable", so awaiting it would run it. */
function filteredEntries(supabase: Client, filters: JournalFilters, columns: string, count?: 'exact') {
  let query = supabase.from('journal_entries').select(columns, count ? { count } : undefined);

  if (filters.from) query = query.gte('entry_date', filters.from);
  if (filters.to) query = query.lte('entry_date', filters.to);
  const types = sourceFilterTypes(filters.source);
  if (types) query = query.in('source_type', types);
  if (filters.search) {
    const search = filters.search.replace(/[,%()\\]/g, ' ').trim();
    if (search) {
      query = query.or(
        `narration.ilike.%${search}%,entry_number.ilike.%${search}%,reference.ilike.%${search}%`
      );
    }
  }

  return query
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('entry_number', { ascending: false });
}

export async function listJournalEntries(params: JournalFilters & { page?: number; perPage?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(5, params.perPage ?? 25));
  const rangeStart = (page - 1) * perPage;

  const supabase = await createClient();
  const { data, count, error } = await filteredEntries(
    supabase,
    params,
    '*, profile:profiles(id, full_name)',
    'exact'
  ).range(rangeStart, rangeStart + perPage - 1);
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as JournalListRow[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

const ENTRY_WITH_LINES = `*, profile:profiles(id, full_name),
  lines:journal_lines(*, account:accounts(id, code, name, type),
    customer:customers(id, name), supplier:suppliers(id, name, company))`;

function sortLines<T extends { lines: { line_no: number }[] }>(entry: T): T {
  entry.lines.sort((a, b) => a.line_no - b.line_no);
  return entry;
}

/** Entries with their lines, for the day-book CSV (newest first, capped). */
export async function listJournalEntriesWithLines(filters: JournalFilters): Promise<JournalEntryWithLines[]> {
  const supabase = await createClient();
  const { data, error } = await filteredEntries(supabase, filters, ENTRY_WITH_LINES).range(0, 4999);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as JournalEntryWithLines[]).map(sortLines);
}

export interface JournalEntryDetail extends JournalEntryWithLines {
  /** the entry that undid this one, if any */
  reversedBy: Pick<JournalEntry, 'id' | 'entry_number' | 'entry_date'> | null;
  /** product behind a stock entry (for the link back) */
  productId: string | null;
}

export async function getJournalEntry(id: string): Promise<JournalEntryDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select(ENTRY_WITH_LINES)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const entry = sortLines(data as unknown as JournalEntryWithLines);

  const [reversal, movement] = await Promise.all([
    entry.source_type === 'manual'
      ? supabase
          .from('journal_entries')
          .select('id, entry_number, entry_date')
          .eq('source_type', 'reversal')
          .eq('source_id', entry.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    entry.source_type === 'stock_adjustment' && entry.source_id
      ? supabase.from('stock_movements').select('product_id').eq('id', entry.source_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...entry,
    reversedBy: (reversal.data as JournalEntryDetail['reversedBy']) ?? null,
    productId: (movement.data as { product_id: string } | null)?.product_id ?? null,
  };
}

/** The entries a document (sale, purchase, return, expense…) produced. */
export async function listEntriesForSource(sourceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_number, entry_date, source_type, total')
    .eq('source_id', sourceId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<JournalEntry, 'id' | 'entry_number' | 'entry_date' | 'source_type' | 'total'>[];
}

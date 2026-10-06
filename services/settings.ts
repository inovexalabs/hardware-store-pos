import { createClient } from '@/lib/supabase/server';
import type { AuditLogWithUser, Permission, Profile, ShopSettings, UserRole } from '@/types/database';

export async function getShopSettings(): Promise<ShopSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shop_settings')
    .select('*')
    .eq('id', true)
    .single();
  if (error) throw new Error(error.message);
  return data as ShopSettings;
}

/** Safe to call from any signed-in page (settings are not secret). */
export async function getShopSettingsOrNull(): Promise<ShopSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('shop_settings').select('*').eq('id', true).maybeSingle();
  return (data as ShopSettings) ?? null;
}

export async function listUsers(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function getUser(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export async function listRolePermissions(): Promise<{ role: UserRole; permission_code: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('role_permissions').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as { role: UserRole; permission_code: string }[];
}

export interface AuditLogParams {
  page?: number;
  perPage?: number;
  entity?: string;
  search?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export async function listAuditLogs(params: AuditLogParams = {}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(10, params.perPage ?? 25));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('audit_logs')
    .select('*, profile:profiles(id, full_name, email)', { count: 'exact' });

  if (params.entity) query = query.eq('entity', params.entity);
  if (params.userId) query = query.eq('user_id', params.userId);
  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+05:45`);
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59+05:45`);
  if (params.search) {
    const search = params.search.replace(/[,%()\\]/g, ' ').trim();
    if (search) query = query.ilike('action', `%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as AuditLogWithUser[],
    count: count ?? 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  };
}

export type { Permission };

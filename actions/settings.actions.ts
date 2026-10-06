'use server';

import { revalidatePath } from 'next/cache';
import { safe } from './safe';
import {
  parseOrThrow,
  shopSettingsSchema,
  invoiceSettingsSchema,
  taxSettingsSchema,
  userCreateSchema,
} from '@/schemas';
import { assertPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fail, ok, type ActionResult } from '@/lib/result';

export async function updateShopSettings(input: unknown): Promise<ActionResult> {
  return safe(async () => {
    await assertPermission('settings.manage');
    const values = parseOrThrow(shopSettingsSchema, input);
    const supabase = await createClient();
    const { error } = await supabase
      .from('shop_settings')
      .update({ ...values, updated_by: null })
      .eq('id', true);
    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
    return ok({});
  });
}

export async function updateInvoiceSettings(input: unknown): Promise<ActionResult> {
  return safe(async () => {
    await assertPermission('settings.manage');
    const values = parseOrThrow(invoiceSettingsSchema, input);
    const supabase = await createClient();
    const { error } = await supabase.from('shop_settings').update(values).eq('id', true);
    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
    return ok({});
  });
}

export async function updateTaxSettings(input: unknown): Promise<ActionResult> {
  return safe(async () => {
    await assertPermission('settings.manage');
    const values = parseOrThrow(taxSettingsSchema, input);
    const supabase = await createClient();
    const { error } = await supabase.from('shop_settings').update(values).eq('id', true);
    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
    return ok({});
  });
}

export async function setOnboardingDone(done: boolean): Promise<ActionResult> {
  return safe(async () => {
    await assertPermission('settings.manage');
    const supabase = await createClient();
    const { error } = await supabase
      .from('shop_settings')
      .update({ onboarding_done: done })
      .eq('id', true);
    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
    return ok({});
  });
}

/** Owner creates a login for a staff member. */
export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    const ctx = await assertPermission('users.manage');
    const values = parseOrThrow(userCreateSchema, input);

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: values.email,
      password: values.password,
      email_confirm: true,
      user_metadata: { full_name: values.full_name },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('The account could not be created. Please try again.');

    // the profile was created by the database trigger as a cashier;
    // now give the person the role the owner chose (runs as the owner)
    const supabase = await createClient();
    const { error: roleError } = await supabase.rpc('update_user', {
      p_user_id: data.user.id,
      p_role: values.role,
      p_is_active: values.is_active,
      p_full_name: values.full_name,
    });
    if (roleError) throw new Error(roleError.message);

    void ctx;
    revalidatePath('/settings/users');
    return ok({ id: data.user.id });
  });
}

export async function changeUserRole(
  userId: string,
  role: string,
  isActive: boolean,
  fullName?: string
): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    await assertPermission('users.manage');
    const supabase = await createClient();
    const { error } = await supabase.rpc('update_user', {
      p_user_id: userId,
      p_role: role,
      p_is_active: isActive,
      p_full_name: fullName ?? null,
    });
    if (error) throw new Error(error.message);
    revalidatePath('/settings/users');
    revalidatePath(`/settings/users/${userId}`);
    return ok({ id: userId });
  });
}

export async function resetUserPassword(userId: string, password: unknown): Promise<ActionResult> {
  return safe(async () => {
    await assertPermission('users.manage');
    const clean = String(password ?? '');
    if (clean.length < 8) {
      return fail('The new password must be at least 8 characters.');
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: clean });
    if (error) throw new Error(error.message);
    return ok({});
  });
}

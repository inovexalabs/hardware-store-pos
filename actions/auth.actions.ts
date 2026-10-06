'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { UserRole } from '@/types/database';

export async function login(
  email: unknown,
  password: unknown
): Promise<ActionResult<{ role: UserRole }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email ?? '').trim(),
      password: String(password ?? ''),
    });

    if (error) return fail(friendlyError(error));
    if (!data.user) return fail('Could not sign in. Please try again.');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut().catch(() => undefined);
      return fail('This account has been deactivated. Ask the shop owner to reactivate it.');
    }

    // audit trail: who signed in and when
    await supabase
      .from('audit_logs')
      .insert({
        user_id: data.user.id,
        action: 'auth.login',
        entity: 'session',
        entity_id: data.user.id,
        metadata: { email: data.user.email ?? '' },
      })
      .then(({ error: auditError }) => {
        if (auditError) console.error('[audit] login log failed', auditError.message);
      });

    revalidatePath('/', 'layout');
    return ok({ role: profile.role as UserRole });
  } catch (error) {
    console.error('[login]', error);
    return fail(friendlyError(error));
  }
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => undefined);
  revalidatePath('/', 'layout');
  redirect('/login');
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { Profile } from '@/types/database';

export interface SessionContext {
  userId: string;
  profile: Profile;
}

/**
 * Returns the signed-in user + profile, or redirects to /login.
 * Inactive (deactivated) users are signed out immediately.
 */
export async function requireProfile(): Promise<SessionContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut().catch(() => undefined);
    redirect('/login');
  }

  return { userId: user.id, profile: profile as Profile };
}

/**
 * Page guard: signed in AND allowed to use this area.
 * Unauthorized visitors land on a friendly "not allowed" page —
 * never on a broken screen.
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const ctx = await requireProfile();
  if (!hasPermission(ctx.profile.role, permission)) {
    redirect('/not-authorized');
  }
  return ctx;
}

/** For actions: returns null instead of redirecting (actions never redirect). */
export async function getProfileOrNull(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) return null;
  return { userId: user.id, profile: profile as Profile };
}

/** For actions: throws a friendly error when the user may not do this. */
export async function assertPermission(permission: Permission): Promise<SessionContext> {
  const ctx = await getProfileOrNull();
  if (!ctx) {
    throw new Error('Your session has ended. Please sign in again.');
  }
  if (!hasPermission(ctx.profile.role, permission)) {
    throw new Error('You do not have permission to do this. Ask the shop owner to help.');
  }
  return ctx;
}

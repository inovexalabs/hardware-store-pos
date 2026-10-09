import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { Profile } from '@/types/database';

export interface SessionContext {
  userId: string;
  profile: Profile;
}

/**
 * The signed-in user and their profile, read once per request: the
 * layout, the page and its guards all share this one lookup.
 */
const loadSession = cache(async (): Promise<{ userId: string | null; profile: Profile | null }> => {
  const supabase = await createClient();

  // Checks the login token's signature with the project's signing keys
  // (cached in memory), so it does not ask Supabase Auth on every page.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  if (!userId) return { userId: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return { userId, profile: (profile as Profile | null) ?? null };
});

/**
 * Returns the signed-in user + profile, or redirects to /login.
 * Inactive (deactivated) users are signed out immediately.
 */
export async function requireProfile(): Promise<SessionContext> {
  const { userId, profile } = await loadSession();

  if (!userId) {
    redirect('/login');
  }

  if (!profile || !profile.is_active) {
    const supabase = await createClient();
    await supabase.auth.signOut().catch(() => undefined);
    redirect('/login');
  }

  return { userId, profile };
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
  const { userId, profile } = await loadSession();
  if (!userId || !profile || !profile.is_active) return null;
  return { userId, profile };
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

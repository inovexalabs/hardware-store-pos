import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * ADMIN client — uses the service role key.
 *
 * NEVER import this from a Client Component and never expose the
 * service key to the browser.  Used only on the server for:
 *   - creating/renaming user accounts (Settings → Users)
 *   - uploading product images to storage
 *
 * It bypasses RLS, so only call it AFTER a permission check.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('The admin client can only be used on the server.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured. Copy .env.example to .env.local and add your keys.');
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

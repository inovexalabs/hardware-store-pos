'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for the browser.
 * Only safe, public values live here (anon key + project URL).
 * All data access still passes through Row Level Security.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

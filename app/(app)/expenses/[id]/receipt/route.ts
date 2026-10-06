import { NextResponse, type NextRequest } from 'next/server';
import { getProfileOrNull } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RECEIPT_BUCKET, RECEIPT_PATH_PATTERN } from '@/lib/receipts';
import { isUuid } from '@/utils/format';

/**
 * Opens an expense's receipt. Receipts are private: the viewer must be
 * allowed to see expenses, and the link we redirect to expires in 5 minutes.
 * Add ?download=1 to save the file instead of viewing it.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getProfileOrNull();
  if (!session) return new Response('Please sign in again.', { status: 401 });
  if (!hasPermission(session.profile.role, 'expenses.view')) {
    return new Response('You do not have permission to see receipts.', { status: 403 });
  }
  if (!isUuid(id)) return new Response('Receipt not found.', { status: 404 });

  // read through RLS so the database confirms access too
  const supabase = await createClient();
  const { data: expense } = await supabase
    .from('expenses')
    .select('receipt_url')
    .eq('id', id)
    .maybeSingle();
  const path = expense?.receipt_url;
  if (!path || !RECEIPT_PATH_PATTERN.test(path)) {
    return new Response('This expense has no receipt attached.', { status: 404 });
  }

  const download = request.nextUrl.searchParams.get('download') === '1';
  const { data, error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .createSignedUrl(path, 300, download ? { download: path.split('/').pop() } : undefined);
  if (error || !data?.signedUrl) {
    console.error('[receipt] signed url failed', error);
    return new Response('The receipt file could not be opened. Try again in a moment.', { status: 502 });
  }

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

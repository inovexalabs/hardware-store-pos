import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  // First-ever sign-in? Offer to create the shop owner's account.
  let firstRun = false;
  try {
    const { data } = await supabase.rpc('first_run');
    firstRun = Boolean(data);
  } catch {
    firstRun = false;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="text-2xl font-bold">I</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstRun ? 'Set up your shop' : 'Sign in to your shop'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inovexa POS — Inventory &amp; billing for hardware shops
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <LoginForm firstRun={firstRun} />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Built by <span className="font-medium text-foreground">Inovexa Labs</span>
        </p>
      </div>
    </main>
  );
}

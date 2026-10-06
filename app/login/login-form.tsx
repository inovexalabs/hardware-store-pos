'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { login } from '@/actions/auth.actions';
import { friendlyError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

interface Props {
  firstRun: boolean;
}

export function LoginForm({ firstRun }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>(firstRun ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showName = mode === 'signup';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Enter your name.');
      return;
    }

    startTransition(async () => {
      try {
        if (mode === 'signin') {
          const result = await login(email.trim(), password);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push('/dashboard');
          router.refresh();
          return;
        }

        // First-time setup: create the owner account directly.
        const supabase = createClient();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });

        if (signUpError) {
          setError(friendlyError(signUpError));
          return;
        }

        if (data.session) {
          toast.success('Shop account created. Welcome!');
          router.push('/setup');
          router.refresh();
          return;
        }

        setInfo('Account created. Check your email inbox for the confirmation link, then sign in.');
      } catch (err) {
        setError(friendlyError(err));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@shop.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </div>

      {showName && (
        <div className="space-y-2">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="e.g. Ramesh Shrestha"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-sm font-medium">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-lg bg-primary-subtle px-3 py-2 text-sm">
          {info}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : mode === 'signup' ? (
          <UserPlus data-icon="inline-start" />
        ) : (
          <LogIn data-icon="inline-start" />
        )}
        {mode === 'signup' ? 'Create shop account' : 'Sign in'}
      </Button>

      {!firstRun && (
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
        >
          {mode === 'signin' ? 'First time here? Create the owner account' : 'Back to sign in'}
        </button>
      )}
    </form>
  );
}

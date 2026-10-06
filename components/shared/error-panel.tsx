'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';

/** Friendly "something went wrong" screen used by the error boundaries. */
export function ErrorPanel({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-subtle">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold">Something went wrong.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen could not load. Nothing was saved from it. Check your internet connection and
          try again. If it keeps happening, tell the shop owner
          {error.digest ? ` and mention code ${error.digest}` : ''}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCw data-icon="inline-start" />
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <Home data-icon="inline-start" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

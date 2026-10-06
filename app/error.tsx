'use client';

import { ErrorPanel } from '@/components/shared/error-panel';

/** Errors outside the app shell (sign-in page, or the shell itself failing to load). */
export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <ErrorPanel {...props} />
    </main>
  );
}

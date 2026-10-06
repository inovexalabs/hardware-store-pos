import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, SearchX } from 'lucide-react';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">We couldn&apos;t find that.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page or record does not exist, or it may have been removed. Check the link or go back
          to the dashboard.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/dashboard">
            <Home data-icon="inline-start" />
            Go to Dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
}

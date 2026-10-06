import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  basePath: string;
  /** Current filters that must survive page changes */
  query?: Record<string, string | undefined>;
}

function hrefFor(
  basePath: string,
  query: Record<string, string | undefined> | undefined,
  page: number
) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ page, totalPages, basePath, query }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" asChild>
            <Link href={hrefFor(basePath, query, page - 1)}>
              <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" asChild>
            <Link href={hrefFor(basePath, query, page + 1)}>
              Next
              <ChevronRight className="h-4 w-4" data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Next
            <ChevronRight className="h-4 w-4" data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}

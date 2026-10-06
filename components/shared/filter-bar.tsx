'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

export interface FilterSelect {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

interface Props {
  searchPlaceholder?: string;
  /** current value of the search parameter (default "q") */
  searchValue?: string;
  selects?: FilterSelect[];
  /** extra controls (e.g. date inputs) rendered between selects and buttons */
  children?: React.ReactNode;
  showClear?: boolean;
}

/**
 * One bar with search + dropdown filters.  Everything updates the
 * URL, so results come from the server and stay shareable.
 */
export function FilterBar({
  searchPlaceholder = 'Search…',
  searchValue = '',
  selects = [],
  children,
  showClear = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchValue);

  const apply = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      });
      params.delete('page'); // back to page 1 on any filter change
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const hasFilters =
    Boolean(searchValue) || selects.some((select) => Boolean(select.value));

  return (
    <form
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: term.trim() || null });
      }}
      className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 min-w-[12rem]">
        <label htmlFor="filter-search" className="mb-1 block text-xs font-medium text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="filter-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      {selects.map((select) => (
        <div key={select.name} className="min-w-[10rem]">
          <label
            htmlFor={`filter-${select.name}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {select.label}
          </label>
          <select
            id={`filter-${select.name}`}
            value={select.value}
            onChange={(e) => apply({ [select.name]: e.target.value || null })}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {children}

      <div className="flex items-center gap-2">
        <Button type="submit">Search</Button>
        {showClear && hasFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTerm('');
              const params = new URLSearchParams(searchParams.toString());
              params.delete('q');
              selects.forEach((select) => params.delete(select.name));
              params.delete('page');
              const qs = params.toString();
              router.push(qs ? `${pathname}?${qs}` : pathname);
            }}
          >
            <X className="h-4 w-4" data-icon="inline-start" />
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}

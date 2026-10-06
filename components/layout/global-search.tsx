'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { Search, Package, Users, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Result {
  kind: 'product' | 'customer' | 'supplier';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

function clean(value: string): string {
  return value.replace(/[,%()\\]/g, ' ').trim().slice(0, 60);
}

/** Products, customers and suppliers matching the query (RLS hides what the role can't see). */
async function searchEverything(query: string): Promise<Result[]> {
  const supabase = createClient();
  const pattern = `%${query}%`;

  const [products, customers, suppliers] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, barcode')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('customers')
      .select('id, name, phone')
      .or(`name.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(4),
    supabase
      .from('suppliers')
      .select('id, name, company, phone')
      .or(`name.ilike.${pattern},company.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(4),
  ]);

  const rows: Result[] = [
    ...(products.data ?? []).map((p) => ({
      kind: 'product' as const,
      id: p.id,
      title: p.name,
      subtitle: `Item ${p.sku}${p.barcode ? ` · ${p.barcode}` : ''}`,
      href: `/products/${p.id}`,
    })),
    ...(customers.data ?? []).map((c) => ({
      kind: 'customer' as const,
      id: c.id,
      title: c.name,
      subtitle: c.phone ?? 'Customer',
      href: `/customers/${c.id}`,
    })),
    ...(suppliers.data ?? []).map((s) => ({
      kind: 'supplier' as const,
      id: s.id,
      title: s.company || s.name,
      subtitle: s.phone ?? 'Supplier',
      href: `/suppliers/${s.id}`,
    })),
  ];
  return rows.slice(0, 10);
}

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const { results, searching: loading } = useDebouncedSearch(term, searchEverything, {
    delayMs: 300,
    normalize: clean,
  });
  const boxRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function go(result: Result) {
    setOpen(false);
    setTerm('');
    router.push(result.href);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && results[0]) go(results[0]);
          }}
          placeholder="Search products, customers, suppliers…"
          aria-label="Search products, customers and suppliers"
          className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {open && (term.trim().length > 0 || loading) && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          {loading && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Nothing found for “{term.trim()}”.
            </p>
          )}
          {!loading &&
            results.map((result) => (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                onClick={() => go(result)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span className="shrink-0 text-muted-foreground">
                  {result.kind === 'product' ? (
                    <Package className="h-4 w-4" />
                  ) : result.kind === 'customer' ? (
                    <Users className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.subtitle}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    'bg-primary-subtle'
                  )}
                >
                  {result.kind === 'product'
                    ? 'Product'
                    : result.kind === 'customer'
                      ? 'Customer'
                      : 'Supplier'}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

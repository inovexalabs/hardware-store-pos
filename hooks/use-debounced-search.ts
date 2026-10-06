'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebounce } from './use-debounce';

interface Options {
  delayMs?: number;
  /** turn the typed text into the query sent to the server (default: trim) */
  normalize?: (value: string) => string;
}

/**
 * Search-as-you-type. Results only ever belong to the text currently in
 * the box: while typing (or right after the box is cleared) `results` is
 * empty, so pressing Enter can never pick a stale match — important for
 * barcode scanners that type fast and press Enter immediately.
 */
export function useDebouncedSearch<T>(
  term: string,
  search: (query: string) => Promise<T[]>,
  { delayMs = 250, normalize = (value) => value.trim() }: Options = {}
) {
  const current = normalize(term);
  const query = normalize(useDebounce(term, delayMs));
  const [found, setFound] = useState<{ query: string; rows: T[] }>({ query: '', rows: [] });

  // always call the latest search function without re-running the effect
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    searchRef
      .current(query)
      .catch(() => [] as T[])
      .then((rows) => {
        if (!cancelled) setFound({ query, rows });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const settled = Boolean(current) && current === query && found.query === query;
  return {
    results: settled ? found.rows : ([] as T[]),
    searching: Boolean(current) && !settled,
  };
}

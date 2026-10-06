'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface Props {
  /** Names of the URL params to control (e.g. ['from', 'to']) */
  fromName?: string;
  toName?: string;
  fromLabel?: string;
  toLabel?: string;
}

/** Two date pickers that update the URL so server results refresh. */
export function DateRangeFilter({
  fromName = 'from',
  toName = 'to',
  fromLabel = 'From date',
  toLabel = 'To date',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

  return (
    <>
      <div className="min-w-[10rem]">
        <label
          htmlFor={`filter-${fromName}`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {fromLabel}
        </label>
        <input
          id={`filter-${fromName}`}
          type="date"
          defaultValue={searchParams.get(fromName) ?? ''}
          onBlur={(e) => apply(fromName, e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="min-w-[10rem]">
        <label
          htmlFor={`filter-${toName}`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {toLabel}
        </label>
        <input
          id={`filter-${toName}`}
          type="date"
          defaultValue={searchParams.get(toName) ?? ''}
          onBlur={(e) => apply(toName, e.target.value)}
          className={inputClass}
        />
      </div>
    </>
  );
}
